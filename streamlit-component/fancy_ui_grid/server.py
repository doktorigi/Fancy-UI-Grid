"""SQLite reference adapter for the grid's JSON datasource and atomic batch protocol.

SQL identifiers are selected from server-owned column definitions; request values
are bound parameters. Supply authentication/authorization in your HTTP host.
"""
import json
import math
import re
import sqlite3
from contextlib import contextmanager
from datetime import date, timedelta


def _identifier(value):
    return '"' + value.replace('"', '""') + '"'


class SQLiteDataSource:
    def __init__(self, database, table, columns, *, id_field="id", max_pivot_keys=50):
        self.database = str(database)
        self.table = _identifier(table)
        self.columns = {column["field"]: column for column in columns}
        self.id_field = id_field
        self.max_pivot_keys = max_pivot_keys
        self._field(id_field)

    def _field(self, name):
        if name not in self.columns:
            raise ValueError(f"Unknown column: {name}")
        return _identifier(name)

    @contextmanager
    def _connect(self):
        connection = sqlite3.connect(self.database, timeout=15)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _where(self, request, group_keys):
        clauses, params = [], []
        for field, key in zip(request.get("rowGroupColumns", []), group_keys):
            clauses.append(f"{self._field(field)} IS ?")
            params.append(key)
        for field, rule in request.get("filterModel", {}).items():
            column = self._field(field)
            kind, value = rule["type"], rule.get("value")
            if kind == "text":
                clauses.append(f"instr(lower(CAST({column} AS TEXT)), lower(?)) > 0")
                params.append(str(value or ""))
            elif kind == "number":
                operator = rule.get("operator", "=")
                if operator == "between":
                    clauses.append(f"{column} BETWEEN ? AND ?")
                    params.extend([value, rule.get("value2")])
                elif operator in ("=", "!=", "<", "<=", ">", ">="):
                    clauses.append(f"{column} {operator} ?")
                    params.append(value)
                else:
                    raise ValueError("Unknown numeric filter operator")
            elif kind == "boolean":
                if value is not None:
                    if not isinstance(value, bool):
                        raise ValueError("Boolean filters require true or false")
                    clauses.append(f"{column} = ?")
                    params.append(value)
            elif kind == "select":
                values = value if isinstance(value, list) else [value]
                if values:
                    clauses.append(f"CAST({column} AS TEXT) IN ({','.join('?' for _ in values)})")
                    params.extend(str(v) for v in values)
            elif kind == "date-tree":
                values = rule.get("selected", [])
                if values:
                    clauses.append(f"substr({column}, 1, 7) IN ({','.join('?' for _ in values)})")
                    params.extend(values)
            elif kind == "date":
                preset = rule.get("preset", "custom")
                today = date.today()
                first = today.replace(day=1)
                bounds = {
                    "today": (today, today), "yesterday": (today - timedelta(days=1), today - timedelta(days=1)),
                    "last7days": (today - timedelta(days=6), today), "last30days": (today - timedelta(days=29), today),
                    "thisMonth": (first, (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)),
                    "lastMonth": ((first - timedelta(days=1)).replace(day=1), first - timedelta(days=1)),
                }
                if preset == "all":
                    continue
                if preset == "custom":
                    lower, upper = str(value or "")[:10], str(rule.get("value2") or value or "")[:10]
                elif preset in bounds:
                    lower, upper = map(str, bounds[preset])
                else:
                    raise ValueError("Unknown date preset")
                clauses.append(f"substr({column}, 1, 10) BETWEEN ? AND ?")
                params.extend([lower, upper])
            else:
                raise ValueError("Unknown filter type")
        search = request.get("globalFilter", "")
        if search:
            fields = request.get("globalFilterFields") or list(self.columns)
            clauses.append("(" + " OR ".join(f"instr(lower(CAST({self._field(f)} AS TEXT)), lower(?)) > 0" for f in fields) + ")")
            params.extend([search] * len(fields))
        return " AND ".join(clauses) or "1 = 1", params

    def _metrics(self, request):
        metrics = request.get("valueColumns", [])
        if len(metrics) > 30:
            raise ValueError("At most 30 aggregate metrics are supported")
        for metric in metrics:
            self._field(metric["field"])
            if metric["aggregate"] not in ("sum", "avg", "min", "max", "count"):
                raise ValueError("Unknown aggregate function")
        return metrics

    def _aggregate_expression(self, metric, condition=None):
        field, function = self._field(metric["field"]), metric["aggregate"].upper()
        if condition:
            return f"SUM(CASE WHEN {condition} THEN 1 ELSE 0 END)" if function == "COUNT" else f"{function}(CASE WHEN {condition} THEN {field} END)"
        return "COUNT(*)" if function == "COUNT" else f"{function}({field})"

    def _totals(self, connection, where, params, metrics):
        if not metrics:
            return {}
        expressions = [f"{self._aggregate_expression(metric)} AS m{i}" for i, metric in enumerate(metrics)]
        record = connection.execute(f"SELECT {','.join(expressions)} FROM {self.table} WHERE {where}", params).fetchone()
        totals = {}
        for i, metric in enumerate(metrics):
            totals.setdefault(metric["field"], {})[metric["aggregate"]] = record[f"m{i}"]
        return totals

    @staticmethod
    def _order(request, allowed, fallback):
        order, seen = [], set()
        for sort in request.get("sortModel", []):
            if sort["direction"] not in ("asc", "desc"):
                raise ValueError("Invalid sort direction")
            if sort["field"] in allowed:
                order.append(f"{allowed[sort['field']]} {sort['direction'].upper()}")
                seen.add(sort["field"])
        order.extend(expression for field, expression in fallback if field not in seen)
        return " ORDER BY " + ",".join(order) if order else ""

    def get_rows(self, request):
        start, end = request.get("startRow", 0), request.get("endRow", 100)
        if type(start) is not int or type(end) is not int or start < 0 or end <= start or end - start > 1000:
            raise ValueError("Request a range of 1 to 1000 rows")
        groups, keys = request.get("rowGroupColumns", []), request.get("groupKeys", [])
        if len(keys) > len(groups) or len(groups) > 8:
            raise ValueError("Invalid group path")
        for field in groups + request.get("pivotColumns", []):
            self._field(field)
        for sort in request.get("sortModel", []):
            if not request.get("pivotMode"):
                self._field(sort["field"])
        metrics = self._metrics(request)
        where, params = self._where(request, keys)
        with self._connect() as connection:
            if request.get("pivotMode"):
                if keys:
                    raise ValueError("Pivot requests use the root group path")
                return self._pivot(connection, request, where, params, metrics, start, end)
            totals = self._totals(connection, where, params, metrics)
            if len(keys) < len(groups):
                field = groups[len(keys)]
                quoted = self._field(field)
                row_count = connection.execute(f"SELECT COUNT(*) FROM (SELECT {quoted} FROM {self.table} WHERE {where} GROUP BY {quoted})", params).fetchone()[0]
                expressions = [f"{self._aggregate_expression(metric)} AS m{i}" for i, metric in enumerate(metrics)]
                select = [f"{quoted} AS group_key", "COUNT(*) AS leaf_count", *expressions]
                allowed = {field: quoted}
                for i, metric in enumerate(metrics):
                    allowed.setdefault(metric["field"], f"m{i}")
                order = self._order(request, allowed, [(field, quoted)])
                records = connection.execute(f"SELECT {','.join(select)} FROM {self.table} WHERE {where} GROUP BY {quoted}{order} LIMIT ? OFFSET ?", [*params, end-start, start]).fetchall()
                rows = []
                for record in records:
                    aggregates = {}
                    for i, metric in enumerate(metrics):
                        aggregates.setdefault(metric["field"], {})[metric["aggregate"]] = record[f"m{i}"]
                    path = [*keys, record["group_key"]]
                    group = {"key": record["group_key"], "leafCount": record["leaf_count"], "aggregates": aggregates}
                    if len(path) == len(groups):
                        group["childCount"] = record["leaf_count"]
                    rows.append({"data": {field: record["group_key"], "id": "__group__" + json.dumps(path)}, "group": group})
            else:
                row_count = connection.execute(f"SELECT COUNT(*) FROM {self.table} WHERE {where}", params).fetchone()[0]
                allowed = {field: self._field(field) for field in self.columns}
                order = self._order(request, allowed, [(self.id_field, self._field(self.id_field))])
                records = connection.execute(f"SELECT {','.join(allowed.values())} FROM {self.table} WHERE {where}{order} LIMIT ? OFFSET ?", [*params, end-start, start]).fetchall()
                rows = [{"data": self._record(record)} for record in records]
            return {"rows": rows, "rowCount": row_count, "aggregates": totals}

    def _record(self, record):
        result = dict(record)
        result["id"] = result[self.id_field]
        for field, column in self.columns.items():
            if column.get("editor") == "boolean" or column.get("filterType") == "boolean":
                if result.get(field) is not None:
                    result[field] = bool(result[field])
        return result

    def _pivot(self, connection, request, where, params, metrics, start, end):
        groups, pivots = request.get("rowGroupColumns", []), request.get("pivotColumns", [])
        if not metrics:
            raise ValueError("Choose at least one pivot value")
        if len(pivots) > 4:
            raise ValueError("At most four pivot dimensions are supported")
        group_sql = [self._field(field) for field in groups]
        if pivots:
            pivot_sql = ','.join(self._field(field) for field in pivots)
            combinations = connection.execute(f"SELECT DISTINCT {pivot_sql} FROM {self.table} WHERE {where} ORDER BY {pivot_sql} LIMIT ?", [*params, self.max_pivot_keys + 1]).fetchall()
        else:
            combinations = [()]
        if len(combinations) > self.max_pivot_keys or len(combinations) * len(metrics) > 200:
            raise ValueError("Too many pivot columns. Filter the dataset or choose fewer dimensions.")
        expressions, expression_params, columns = [], [], []
        for field in groups:
            columns.append({"field": field, "headerText": self.columns[field].get("headerText", field), "sortable": True, "pinned": "left"})
        aliases = []
        for combo_index, combo in enumerate(combinations):
            condition = ' AND '.join(f"{self._field(field)} IS ?" for field in pivots) or None
            label = ' / '.join('(blank)' if value is None else str(value) for value in combo) or 'All'
            for metric_index, metric in enumerate(metrics):
                alias = f"__pivot_{combo_index}_{metric_index}"
                expressions.append(f"{self._aggregate_expression(metric, condition)} AS {_identifier(alias)}")
                expression_params.extend(list(combo))
                aliases.append(alias)
                columns.append({"field": alias, "headerText": f"{metric['aggregate']} {self.columns[metric['field']].get('headerText', metric['field'])}", "group": label, "sortable": True, "aggregate": metric["aggregate"], "filterType": "number"})
        for i, metric in enumerate(metrics):
            alias = f"__total_{i}"
            expressions.append(f"{self._aggregate_expression(metric)} AS {_identifier(alias)}")
            aliases.append(alias)
            columns.append({"field": alias, "headerText": f"{metric['aggregate']} {metric['field']}", "group": "Row totals", "sortable": True, "aggregate": metric["aggregate"], "filterType": "number"})
        group_clause = ' GROUP BY ' + ','.join(group_sql) if groups else ''
        count_sql = f"SELECT COUNT(*) FROM (SELECT 1 FROM {self.table} WHERE {where}{group_clause})" if groups else f"SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM {self.table} WHERE {where}"
        count = connection.execute(count_sql, params).fetchone()[0]
        allowed = {field: self._field(field) for field in groups}
        allowed.update({alias: _identifier(alias) for alias in aliases})
        order = self._order(request, allowed, [(field, self._field(field)) for field in groups])
        select = ','.join([*group_sql, *expressions])
        records = connection.execute(f"SELECT {select} FROM {self.table} WHERE {where}{group_clause}{order} LIMIT ? OFFSET ?", [*expression_params, *params, end-start, start]).fetchall() if count else []
        rows = []
        for record in records:
            data = dict(record)
            data["id"] = '__pivot__' + json.dumps([data[field] for field in groups])
            rows.append({"data": data})
        grand = connection.execute(f"SELECT {','.join(expressions)} FROM {self.table} WHERE {where}", [*expression_params, *params]).fetchone()
        return {"rows": rows, "rowCount": count, "pivotResultColumns": columns, "grandTotalValues": dict(grand)}

    def save_edits(self, edits, validate_row=None):
        """All-or-nothing write with old-value checks and validation inside one transaction."""
        if not isinstance(edits, list) or len(edits) > 10000:
            raise ValueError("Submit at most 10,000 cell changes")
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            rows, changed, errors = {}, {}, []
            for edit in edits:
                row_id, field = edit["rowId"], edit["field"]
                if field == self.id_field or field not in self.columns or not self.columns[field].get("editable"):
                    errors.append({"rowId": row_id, "field": field, "message": "This column is not editable."})
                    continue
                if row_id not in rows:
                    record = connection.execute(f"SELECT * FROM {self.table} WHERE {self._field(self.id_field)} = ?", [row_id]).fetchone()
                    rows[row_id] = self._record(record) if record else None
                row = rows[row_id]
                if row is None:
                    errors.append({"rowId": row_id, "field": field, "message": "This row no longer exists."})
                elif row[field] != edit.get("oldValue"):
                    errors.append({"rowId": row_id, "field": field, "message": "This value changed on the server. Refresh and retry."})
                else:
                    changed.setdefault(row_id, {})[field] = edit.get("value")
            for row_id, updates in changed.items():
                candidate = {**rows[row_id], **updates}
                for field, value in updates.items():
                    message = self._validate(self.columns[field], value)
                    if message:
                        errors.append({"rowId": row_id, "field": field, "message": message})
                result = validate_row(candidate) if validate_row else None
                if isinstance(result, str) and result:
                    errors.append({"rowId": row_id, "message": result})
                elif isinstance(result, dict):
                    errors.extend({"rowId": row_id, "field": field, "message": message} for field, message in result.items() if message)
            if errors:
                connection.rollback()
                return {"errors": errors}
            for row_id, updates in changed.items():
                assignments = ','.join(f"{self._field(field)} = ?" for field in updates)
                connection.execute(f"UPDATE {self.table} SET {assignments} WHERE {self._field(self.id_field)} = ?", [*updates.values(), row_id])
        return {}

    @staticmethod
    def _validate(column, value):
        rules = column.get("validation", {})
        if value is None or value == "":
            return "A value is required." if rules.get("required") else None
        kind = column.get("editor", column.get("filterType", "text"))
        if kind == "number":
            if type(value) not in (float, int) or not math.isfinite(value):
                return "Enter a valid number."
            if "min" in rules and value < rules["min"]:
                return f"Minimum is {rules['min']}."
            if "max" in rules and value > rules["max"]:
                return f"Maximum is {rules['max']}."
        if kind == "boolean" and type(value) is not bool:
            return "Choose true or false."
        if kind in ("date", "date-tree"):
            try:
                if date.fromisoformat(str(value)).isoformat() != value:
                    return "Enter a valid date."
            except ValueError:
                return "Enter a valid date."
        if kind == "select" and column.get("editorOptions") and not any(option["value"] == value for option in column["editorOptions"]):
            return "Choose a value from the list."
        if "minLength" in rules and len(str(value)) < rules["minLength"]:
            return "Value is too short."
        if "maxLength" in rules and len(str(value)) > rules["maxLength"]:
            return "Value is too long."
        if rules.get("pattern") and not re.search(rules["pattern"], str(value)):
            return "Value does not match the required format."
        return None
