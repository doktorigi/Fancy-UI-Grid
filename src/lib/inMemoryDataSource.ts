/** Reference adapter for demos/tests. Database-backed applications should use an HTTP datasource. */
import type { ColumnDefinition, GridDataSource, GroupKey, HierarchicalData, PivotValueConfig, ProcessedRow, ServerAggregates, ServerRow } from '@/types/data-grid';
import { filterRows, sortRows } from './gridProcessing';
import { buildPivotTable } from './pivotTable';

const wrap = <T extends HierarchicalData<T>>(row: T): ProcessedRow<T> => ({ originalRow: row, id: row.id, level: 0, hasChildren: false });
function totals<T extends HierarchicalData<T>>(rows: T[], metrics: PivotValueConfig<T>[]): ServerAggregates {
  const result: ServerAggregates = {};
  for (const metric of metrics) {
    const numbers = rows.map(row => row[metric.field]).filter(value => typeof value === 'number' && Number.isFinite(value)) as number[];
    const sum = numbers.reduce((n, value) => n + value, 0);
    const value = metric.aggregate === 'count' ? rows.length : !numbers.length ? null
      : metric.aggregate === 'sum' ? sum : metric.aggregate === 'avg' ? sum / numbers.length
        : metric.aggregate === 'min' ? numbers.reduce((a, b) => Math.min(a, b), Infinity) : numbers.reduce((a, b) => Math.max(a, b), -Infinity);
    (result[metric.field] ??= {})[metric.aggregate] = value;
  }
  return result;
}
export function createInMemoryDataSource<T extends HierarchicalData<T>>(getData: () => T[], columns: ColumnDefinition<T>[], delay = 100): GridDataSource<T> {
  return { async getRows(request, signal) {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
      const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delay);
      signal.addEventListener('abort', abort, { once: true });
    });
    const rows = filterRows({ rows: getData().map(wrap), columns, visibleColumns: columns.map(c => c.field),
      globalFilter: request.globalFilter, globalFilterFields: request.globalFilterFields as (keyof T & string)[], columnFilters: request.filterModel })
      .filter(row => request.groupKeys.every((key, index) => Object.is(row.originalRow[request.rowGroupColumns[index]] ?? null, key)));
    if (request.pivotMode) {
      const pivot = buildPivotTable({ rows, columns, rowGroupFields: request.rowGroupColumns, pivotFields: request.pivotColumns, valueConfigs: request.valueColumns, showRowTotals: true });
      const sorted = sortRows(pivot.rows, new Map(pivot.columns.map(c => [c.field, c])), request.sortModel, [], false);
      return { rows: sorted.slice(request.startRow, request.endRow).map(row => ({ data: row.originalRow })), rowCount: sorted.length,
        pivotResultColumns: pivot.columns, grandTotalValues: pivot.grandTotalValues };
    }
    const aggregates = totals(rows.map(row => row.originalRow), request.valueColumns);
    let serverRows: ServerRow<T>[];
    if (request.groupKeys.length < request.rowGroupColumns.length) {
      const field = request.rowGroupColumns[request.groupKeys.length];
      const buckets = new Map<GroupKey, T[]>();
      for (const row of rows) {
        const key = row.originalRow[field] ?? null;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(row.originalRow);
      }
      serverRows = Array.from(buckets, ([key, items]) => {
        const groupTotals = totals(items, request.valueColumns);
        const values = Object.fromEntries(Object.entries(groupTotals).map(([field, metrics]) => [field, Object.values(metrics)[0]]));
        const nextField = request.rowGroupColumns[request.groupKeys.length + 1];
        return { data: { ...values, [field]: key, id: `__group__${JSON.stringify([...request.groupKeys, key])}` } as T,
          group: { key, leafCount: items.length, childCount: nextField ? new Set(items.map(row => row[nextField] ?? null)).size : items.length, aggregates: groupTotals } };
      });
      const sorted = sortRows(serverRows.map(row => wrap(row.data)), new Map(columns.map(c => [c.field, c])), request.sortModel.length ? request.sortModel : [{ field, direction: 'asc' }], [], false);
      const byId = new Map(serverRows.map(row => [row.data.id, row]));
      serverRows = sorted.map(row => byId.get(row.id)!);
    } else {
      serverRows = sortRows(rows, new Map(columns.map(c => [c.field, c])), request.sortModel, [], false).map(row => ({ data: row.originalRow }));
    }
    return { rows: serverRows.slice(request.startRow, request.endRow), rowCount: serverRows.length, aggregates };
  } };
}
