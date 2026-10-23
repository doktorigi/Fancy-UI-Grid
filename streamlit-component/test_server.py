import sqlite3
import tempfile
import unittest
from pathlib import Path
from fancy_ui_grid.server import SQLiteDataSource


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "rows.db"
        with sqlite3.connect(self.path) as connection:
            connection.execute('CREATE TABLE items (id INTEGER PRIMARY KEY, region TEXT, status TEXT, amount REAL, active INTEGER, date TEXT)')
            connection.executemany('INSERT INTO items VALUES (?, ?, ?, ?, ?, ?)', [
                (1, "CA", "Open", 10, 1, "2026-10-01"), (2, "CA", "Closed", 20, 0, "2026-10-02"),
                (3, "NY", "Open", 60, 1, "2026-10-03"), (4, None, "Open", 30, 1, "2026-09-01"),
            ])
        connection.close()
        self.source = SQLiteDataSource(self.path, "items", [
            {"field": "id"}, {"field": "region"}, {"field": "status"},
            {"field": "amount", "editable": True, "filterType": "number", "validation": {"required": True, "min": 0}},
            {"field": "active", "editable": True, "editor": "boolean"}, {"field": "date", "editable": True, "editor": "date"},
        ])
        self.request = {"startRow": 0, "endRow": 2, "groupKeys": [], "rowGroupColumns": [], "sortModel": [], "filterModel": {}, "globalFilter": "", "pivotMode": False, "pivotColumns": [], "valueColumns": [{"field": "amount", "aggregate": "sum"}, {"field": "amount", "aggregate": "avg"}]}

    def tearDown(self):
        self.directory.cleanup()

    def test_pages_include_full_dataset_totals(self):
        result = self.source.get_rows(self.request)
        self.assertEqual(len(result["rows"]), 2)
        self.assertEqual(result["rowCount"], 4)
        self.assertEqual(result["aggregates"]["amount"], {"sum": 120, "avg": 30})
        self.assertIs(result["rows"][0]["data"]["active"], True)

    def test_custom_primary_key_maps_to_grid_ids_for_reads_and_saves(self):
        connection = sqlite3.connect(self.path)
        try:
            connection.execute('CREATE VIEW custom_items AS SELECT id AS item_key, region, amount FROM items')
            connection.execute('CREATE TABLE custom_orders AS SELECT id AS order_key, amount FROM items')
            connection.commit()
        finally:
            connection.close()
        source = SQLiteDataSource(self.path, "custom_items", [{"field": "item_key"}, {"field": "region"}, {"field": "amount"}], id_field="item_key")
        result = source.get_rows(self.request)
        self.assertEqual(result["rows"][0]["data"]["id"], 1)
        grouped = source.get_rows({**self.request, "rowGroupColumns": ["region"]})
        self.assertTrue(all(row["data"]["id"].startswith("__group__") for row in grouped["rows"]))
        pivoted = source.get_rows({**self.request, "pivotMode": True, "rowGroupColumns": ["region"]})
        self.assertTrue(all(row["data"]["id"].startswith("__pivot__") for row in pivoted["rows"]))
        writable = SQLiteDataSource(self.path, "custom_orders", [{"field": "order_key"}, {"field": "amount", "editable": True, "editor": "number"}], id_field="order_key")
        self.assertEqual(writable.save_edits([{"rowId": 1, "field": "amount", "oldValue": 10, "value": 15}]), {})
        self.assertEqual(writable.get_rows(self.request)["rows"][0]["data"]["amount"], 15)

    def test_lazy_groups_and_null_paths(self):
        result = self.source.get_rows({**self.request, "rowGroupColumns": ["region"], "endRow": 10})
        self.assertEqual(result["rowCount"], 3)
        ca = next(row for row in result["rows"] if row["group"]["key"] == "CA")
        self.assertEqual(ca["group"]["aggregates"]["amount"]["sum"], 30)
        child = self.source.get_rows({**self.request, "rowGroupColumns": ["region"], "groupKeys": [None]})
        self.assertEqual(child["rows"][0]["data"]["id"], 4)

    def test_pivot_schema_and_weighted_grand_totals_are_stable_across_blocks(self):
        query = {**self.request, "pivotMode": True, "rowGroupColumns": ["region"], "pivotColumns": ["status"], "endRow": 1}
        first = self.source.get_rows(query)
        second = self.source.get_rows({**query, "startRow": 1, "endRow": 2})
        self.assertEqual(first["pivotResultColumns"], second["pivotResultColumns"])
        self.assertEqual(first["grandTotalValues"]["__total_1"], 30)
        self.assertEqual(first["rowCount"], 3)
        self.assertEqual(second["rows"][0]["data"]["__total_0"], 30)

    def test_filters_multi_sort_and_sql_values(self):
        request = {**self.request, "filterModel": {"amount": {"type": "number", "operator": ">", "value": 15}}, "sortModel": [{"field": "amount", "direction": "desc"}]}
        result = self.source.get_rows(request)
        self.assertEqual([r["data"]["id"] for r in result["rows"]], [3, 4])
        self.assertEqual(result["aggregates"]["amount"]["sum"], 110)
        injected = self.source.get_rows({**self.request, "globalFilter": "' OR 1=1 --"})
        self.assertEqual(injected["rowCount"], 0)
        with self.assertRaises(ValueError):
            self.source.get_rows({**self.request, "rowGroupColumns": ['region"; DROP TABLE items; --']})

    def test_atomic_save_and_conflicts(self):
        rejected = self.source.save_edits([
            {"rowId": 1, "field": "amount", "oldValue": 10, "value": 15},
            {"rowId": 2, "field": "amount", "oldValue": 999, "value": 25},
        ])
        self.assertTrue(rejected["errors"])
        self.assertEqual(self.source.get_rows(self.request)["rows"][0]["data"]["amount"], 10)
        self.assertEqual(self.source.save_edits([{"rowId": 1, "field": "amount", "oldValue": 10, "value": 15}]), {})
        self.assertEqual(self.source.get_rows(self.request)["rows"][0]["data"]["amount"], 15)

    def test_invalid_cells_and_row_rules_reject_all_updates(self):
        result = self.source.save_edits([{"rowId": 1, "field": "amount", "oldValue": 10, "value": -1}])
        self.assertTrue(result["errors"])
        result = self.source.save_edits([{"rowId": 1, "field": "amount", "oldValue": 10, "value": 100}], lambda row: {"amount": "Budget exceeded"} if row["amount"] > 50 else None)
        self.assertEqual(result["errors"][0]["message"], "Budget exceeded")
        self.assertEqual(self.source.get_rows(self.request)["rows"][0]["data"]["amount"], 10)

    def test_date_boolean_and_empty_pivots(self):
        result = self.source.get_rows({**self.request, "filterModel": {"date": {"type": "date-tree", "selected": ["2026-10"]}, "active": {"type": "boolean", "value": True}}})
        self.assertEqual(result["rowCount"], 2)
        result = self.source.get_rows({**self.request, "pivotMode": True, "pivotColumns": ["status"], "globalFilter": "missing"})
        self.assertEqual(result["rows"], [])
        self.assertEqual(result["rowCount"], 0)


if __name__ == "__main__":
    unittest.main()
