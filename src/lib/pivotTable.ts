import type {
  AggregateFunction,
  ColumnDefinition,
  HierarchicalData,
  PivotValueConfig,
  ProcessedRow,
} from '@/types/data-grid';
import { compareValues } from './gridProcessing';
import { getCellValue } from './utils';

export interface BuildPivotTableOptions<TData extends HierarchicalData<TData>> {
  rows: ProcessedRow<TData>[];
  columns: ColumnDefinition<TData>[];
  rowGroupFields: (keyof TData & string)[];
  pivotFields: (keyof TData & string)[];
  valueConfigs?: PivotValueConfig<TData>[];
  showRowTotals?: boolean;
}

export interface PivotTableResult<TData extends HierarchicalData<TData>> {
  columns: ColumnDefinition<TData>[];
  rows: ProcessedRow<TData>[];
  pivotKeys: string[];
  effectiveRowGroupFields: (keyof TData & string)[];
  effectiveValueConfigs: PivotValueConfig<TData>[];
  grandTotalValues: Record<string, number | null>;
}

const AGG_LABELS: Record<AggregateFunction, string> = {
  sum: 'Sum',
  avg: 'Avg',
  min: 'Min',
  max: 'Max',
  count: 'Count',
};

export function deriveDefaultPivotValues<TData extends HierarchicalData<TData>>(
  columns: ColumnDefinition<TData>[]
): PivotValueConfig<TData>[] {
  const configs: PivotValueConfig<TData>[] = [];
  for (const col of columns) {
    if (!col.aggregate) continue;
    const aggs = Array.isArray(col.aggregate) ? col.aggregate : [col.aggregate];
    for (const agg of aggs) {
      configs.push({
        field: col.field,
        aggregate: agg,
        headerText: col.headerText,
      });
    }
  }
  if (configs.length === 0 && columns.length > 0) {
    const fallbackCol =
      columns.find(c => c.filterType === 'number') || columns[columns.length - 1];
    configs.push({
      field: fallbackCol.field,
      aggregate: fallbackCol.filterType === 'number' ? 'sum' : 'count',
      headerText: fallbackCol.headerText,
    });
  }
  return configs;
}

export function computeNumericAggregate<TData extends HierarchicalData<TData>>(
  items: ProcessedRow<TData>[],
  field: keyof TData & string,
  aggregate: AggregateFunction
): number | null {
  if (items.length === 0) return null;
  if (aggregate === 'count') return items.length;

  const nums = items
    .map(item => parseFloat(String(getCellValue(item, field))))
    .filter(n => !isNaN(n));

  if (nums.length === 0) return null;

  switch (aggregate) {
    case 'sum': {
      const sum = nums.reduce((a, b) => a + b, 0);
      return Math.round(sum * 100) / 100;
    }
    case 'avg': {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      return Math.round(avg * 100) / 100;
    }
    case 'min':
      return Math.min(...nums);
    case 'max':
      return Math.max(...nums);
    default:
      return null;
  }
}

export function formatPivotMetricValue(
  value: number | null | undefined,
  aggregate: AggregateFunction
): string {
  if (value === null || value === undefined) return '—';
  if (aggregate === 'count') return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function buildPivotTable<TData extends HierarchicalData<TData>>({
  rows,
  columns,
  rowGroupFields,
  pivotFields,
  valueConfigs,
  showRowTotals = true,
}: BuildPivotTableOptions<TData>): PivotTableResult<TData> {
  const dataRows = rows.filter(r => !r.isGroupHeader);
  const colMap = new Map<keyof TData & string, ColumnDefinition<TData>>(
    columns.map(c => [c.field, c])
  );

  const effectiveValueConfigs =
    valueConfigs && valueConfigs.length > 0
      ? valueConfigs
      : deriveDefaultPivotValues(columns);

  // Exclude pivotFields from rowGroupFields so the same field isn't both a row and column axis
  const effectiveRowGroupFields = rowGroupFields.filter(f => !pivotFields.includes(f));

  // Collect and sort unique pivot column tuples
  const pivotTupleMap = new Map<string, any[]>();
  if (pivotFields.length > 0) {
    for (const row of dataRows) {
      const tuple = pivotFields.map(pf => getCellValue(row, pf) ?? '(Blank)');
      const key = tuple.map(v => String(v)).join(' › ');
      if (!pivotTupleMap.has(key)) {
        pivotTupleMap.set(key, tuple);
      }
    }
  }

  const sortedPivotEntries = Array.from(pivotTupleMap.entries()).sort((a, b) => {
    for (let i = 0; i < pivotFields.length; i++) {
      const pf = pivotFields[i];
      const colDef = colMap.get(pf);
      const cmp = compareValues(a[1][i], b[1][i], 'asc', colDef?.filterType === 'date');
      if (cmp !== 0) return cmp;
    }
    return 0;
  });

  const pivotKeys = sortedPivotEntries.map(([key]) => key);

  // Build dynamic column definitions
  const pivotColumnDefs: ColumnDefinition<TData>[] = [];

  if (effectiveRowGroupFields.length > 0) {
    for (const rf of effectiveRowGroupFields) {
      const orig = colMap.get(rf);
      pivotColumnDefs.push({
        field: rf,
        headerText: orig?.headerText || String(rf),
        sortable: true,
        filterable: false,
        pinned: 'left',
        defaultWidth: orig?.defaultWidth || '160px',
        hideable: false,
        group: 'Row Groups',
      });
    }
  } else {
    pivotColumnDefs.push({
      field: '__pivot_all_rows__' as keyof TData & string,
      headerText: 'Summary',
      sortable: false,
      filterable: false,
      pinned: 'left',
      defaultWidth: '150px',
      hideable: false,
      group: 'Row Groups',
    });
  }

  const isMultiValue = effectiveValueConfigs.length > 1;
  const pivotHeaderGroupLabel = pivotFields
    .map(pf => colMap.get(pf)?.headerText || String(pf))
    .join(' / ');

  const makeValueCellRenderer = (
    origCol: ColumnDefinition<TData> | undefined,
    agg: AggregateFunction
  ): ((value: any, row: TData) => any) => {
    return (value: any, row: TData) => {
      if (value === null || value === undefined || value === '') {
        return '—';
      }
      if (agg !== 'count' && origCol?.cellRenderer) {
        return origCol.cellRenderer(value, row);
      }
      return formatPivotMetricValue(typeof value === 'number' ? value : Number(value), agg);
    };
  };

  // For each unique pivot column key, create value column(s)
  for (const pivotKey of pivotKeys) {
    for (const vc of effectiveValueConfigs) {
      const origCol = colMap.get(vc.field);
      const colHeader = vc.headerText || origCol?.headerText || String(vc.field);
      const aggLabel = AGG_LABELS[vc.aggregate];
      const dynamicField = `__pivot_col__${pivotKey}__${vc.field}__${vc.aggregate}` as keyof TData & string;

      pivotColumnDefs.push({
        field: dynamicField,
        headerText: isMultiValue ? `${aggLabel} ${colHeader}` : pivotKey,
        group: isMultiValue
          ? pivotKey
          : `${pivotHeaderGroupLabel} (${aggLabel} ${colHeader})`,
        sortable: true,
        filterable: false,
        filterType: 'number',
        defaultWidth: isMultiValue ? '135px' : '125px',
        aggregate: vc.aggregate === 'count' ? 'sum' : vc.aggregate,
        cellRenderer: makeValueCellRenderer(origCol, vc.aggregate),
      });
    }
  }

  // Row Totals column(s)
  if (showRowTotals || pivotKeys.length === 0) {
    for (const vc of effectiveValueConfigs) {
      const origCol = colMap.get(vc.field);
      const colHeader = vc.headerText || origCol?.headerText || String(vc.field);
      const aggLabel = AGG_LABELS[vc.aggregate];
      const totalField = `__pivot_total__${vc.field}__${vc.aggregate}` as keyof TData & string;

      pivotColumnDefs.push({
        field: totalField,
        headerText: isMultiValue ? `${aggLabel} ${colHeader}` : `Total (${aggLabel} ${colHeader})`,
        group: 'Row Totals',
        sortable: true,
        filterable: false,
        filterType: 'number',
        defaultWidth: '140px',
        aggregate: vc.aggregate === 'count' ? 'sum' : vc.aggregate,
        cellRenderer: makeValueCellRenderer(origCol, vc.aggregate),
      });
    }
  }

  // Group rows by effectiveRowGroupFields and bucket by pivotKey
  interface RowGroupBucket {
    rowKey: string;
    groupValues: Record<string, any>;
    allItems: ProcessedRow<TData>[];
    byPivotKey: Map<string, ProcessedRow<TData>[]>;
  }

  const rowGroupsMap = new Map<string, RowGroupBucket>();

  for (const row of dataRows) {
    const groupValues: Record<string, any> = {};
    let rowKey: string;
    if (effectiveRowGroupFields.length > 0) {
      const parts: string[] = [];
      for (const rf of effectiveRowGroupFields) {
        const val = getCellValue(row, rf) ?? '(Blank)';
        groupValues[rf] = val;
        parts.push(`${String(rf)}:${String(val)}`);
      }
      rowKey = parts.join('|');
    } else {
      rowKey = '__all__';
      groupValues['__pivot_all_rows__'] = 'All Rows';
    }

    let bucket = rowGroupsMap.get(rowKey);
    if (!bucket) {
      bucket = {
        rowKey,
        groupValues,
        allItems: [],
        byPivotKey: new Map(),
      };
      rowGroupsMap.set(rowKey, bucket);
    }
    bucket.allItems.push(row);

    if (pivotFields.length > 0) {
      const pKey = pivotFields.map(pf => String(getCellValue(row, pf) ?? '(Blank)')).join(' › ');
      const list = bucket.byPivotKey.get(pKey);
      if (list) {
        list.push(row);
      } else {
        bucket.byPivotKey.set(pKey, [row]);
      }
    }
  }

  // Build ProcessedRow<TData>[] for the pivoted table
  const pivotRows: ProcessedRow<TData>[] = [];
  let idx = 0;
  for (const bucket of rowGroupsMap.values()) {
    const syntheticOriginal: Record<string, any> = {
      id: `pivot-row-${idx++}-${bucket.rowKey}`,
      ...bucket.groupValues,
    };

    for (const pivotKey of pivotKeys) {
      const cellItems = bucket.byPivotKey.get(pivotKey) || [];
      for (const vc of effectiveValueConfigs) {
        const dynamicField = `__pivot_col__${pivotKey}__${vc.field}__${vc.aggregate}`;
        syntheticOriginal[dynamicField] = computeNumericAggregate(cellItems, vc.field, vc.aggregate);
      }
    }

    if (showRowTotals || pivotKeys.length === 0) {
      for (const vc of effectiveValueConfigs) {
        const totalField = `__pivot_total__${vc.field}__${vc.aggregate}`;
        syntheticOriginal[totalField] = computeNumericAggregate(bucket.allItems, vc.field, vc.aggregate);
      }
    }

    pivotRows.push({
      id: syntheticOriginal.id,
      originalRow: syntheticOriginal as TData,
      level: 0,
      hasChildren: false,
      isExpanded: false,
    });
  }

  // Compute exact column grand totals across all dataRows
  const grandTotalValues: Record<string, number | null> = {};
  if (pivotFields.length > 0) {
    const globalByPivotKey = new Map<string, ProcessedRow<TData>[]>();
    for (const row of dataRows) {
      const pKey = pivotFields.map(pf => String(getCellValue(row, pf) ?? '(Blank)')).join(' › ');
      const list = globalByPivotKey.get(pKey);
      if (list) list.push(row);
      else globalByPivotKey.set(pKey, [row]);
    }
    for (const pivotKey of pivotKeys) {
      const items = globalByPivotKey.get(pivotKey) || [];
      for (const vc of effectiveValueConfigs) {
        const dynamicField = `__pivot_col__${pivotKey}__${vc.field}__${vc.aggregate}`;
        grandTotalValues[dynamicField] = computeNumericAggregate(items, vc.field, vc.aggregate);
      }
    }
  }

  if (showRowTotals || pivotKeys.length === 0) {
    for (const vc of effectiveValueConfigs) {
      const totalField = `__pivot_total__${vc.field}__${vc.aggregate}`;
      grandTotalValues[totalField] = computeNumericAggregate(dataRows, vc.field, vc.aggregate);
    }
  }

  return {
    columns: pivotColumnDefs,
    rows: pivotRows,
    pivotKeys,
    effectiveRowGroupFields,
    effectiveValueConfigs,
    grandTotalValues,
  };
}
