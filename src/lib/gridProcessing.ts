import { endOfDay, endOfMonth, isValid, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns';
import type {
  ActiveFilters,
  ColumnDefinition,
  DateFilterValue,
  DateTreeFilterValue,
  HierarchicalData,
  NumberFilterValue,
  ProcessedRow,
  SortConfig,
} from '@/types/data-grid';
import { getCellValue } from './utils';

export interface FilterRowsOptions<TData extends HierarchicalData<TData>> {
  rows: ProcessedRow<TData>[];
  columns: ColumnDefinition<TData>[];
  visibleColumns: (keyof TData & string)[];
  globalFilter?: string;
  globalFilterFields?: (keyof TData & string)[];
  columnFilters?: ActiveFilters<TData>;
  now?: Date;
}

// Extracts { year, month } straight from a 'YYYY-MM-...' string without going through
// Date parsing, so local-timezone shifting can never move a value into the wrong bucket.
export function dateTreeKeyOf(value: any): { year: string; month: string } | null {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})/);
  return match ? { year: match[1], month: match[2] } : null;
}

function matchesNumberFilter(cellValue: any, filter: NumberFilterValue): boolean {
  if (filter.value === undefined && (filter.operator !== 'between' || filter.value2 === undefined)) return true;

  const numCell = parseFloat(String(cellValue));
  if (isNaN(numCell)) return false;

  if (filter.operator === 'between') {
    if (typeof filter.value === 'number' && typeof filter.value2 === 'number') {
      return numCell >= filter.value && numCell <= filter.value2;
    }
    if (typeof filter.value === 'number') return numCell >= filter.value;
    if (typeof filter.value2 === 'number') return numCell <= filter.value2;
    return true;
  }

  if (filter.value === undefined) return true;

  switch (filter.operator) {
    case '=':
      return numCell === filter.value;
    case '!=':
      return numCell !== filter.value;
    case '<':
      return numCell < filter.value;
    case '>':
      return numCell > filter.value;
    case '<=':
      return numCell <= filter.value;
    case '>=':
      return numCell >= filter.value;
    default:
      return true;
  }
}

function matchesDateFilter(cellValue: any, filter: DateFilterValue, now: Date): boolean {
  const cellDate = new Date(String(cellValue));
  if (!isValid(cellDate)) return false;

  const cellDateTime = startOfDay(cellDate).getTime();
  if (filter.preset === 'all' || !filter.preset) return true;

  if (filter.preset === 'custom') {
    if (!filter.value && !filter.value2) return true;
    const startDate = filter.value ? startOfDay(filter.value).getTime() : -Infinity;
    const endDate = filter.value2 ? endOfDay(filter.value2).getTime() : Infinity;
    return cellDateTime >= startDate && cellDateTime <= endDate;
  }

  let lowerBound: Date | null = null;
  let upperBound: Date | null = null;

  switch (filter.preset) {
    case 'today':
      lowerBound = startOfDay(now);
      upperBound = endOfDay(now);
      break;
    case 'yesterday':
      lowerBound = startOfDay(subDays(now, 1));
      upperBound = endOfDay(subDays(now, 1));
      break;
    case 'last7days':
      lowerBound = startOfDay(subDays(now, 6));
      upperBound = endOfDay(now);
      break;
    case 'last30days':
      lowerBound = startOfDay(subDays(now, 29));
      upperBound = endOfDay(now);
      break;
    case 'thisMonth':
      lowerBound = startOfMonth(now);
      upperBound = endOfMonth(now);
      break;
    case 'lastMonth':
      lowerBound = startOfMonth(subMonths(now, 1));
      upperBound = endOfMonth(lowerBound);
      break;
  }

  if (lowerBound && upperBound) {
    return cellDateTime >= lowerBound.getTime() && cellDateTime <= upperBound.getTime();
  }

  return true;
}

export function filterRows<TData extends HierarchicalData<TData>>({
  rows,
  columns,
  visibleColumns,
  globalFilter = '',
  globalFilterFields,
  columnFilters = {},
  now = new Date(),
}: FilterRowsOptions<TData>): ProcessedRow<TData>[] {
  let dataToFilter = [...rows];

  if (globalFilter) {
    const lowerGlobalFilter = globalFilter.toLowerCase();
    dataToFilter = dataToFilter.filter(row =>
      columns.some(col => {
        if (globalFilterFields && globalFilterFields.length > 0 && !globalFilterFields.includes(col.field)) return false;
        if (!visibleColumns.includes(col.field)) return false;
        const cellValue = getCellValue(row, col.field);
        return String(cellValue).toLowerCase().includes(lowerGlobalFilter);
      })
    );
  }

  Object.entries(columnFilters).forEach(([field, filter]) => {
    if (!filter) return;

    const typedField = field as keyof TData & string;
    const colDef = columns.find(col => col.field === typedField);
    if (!colDef || !visibleColumns.includes(colDef.field)) return;

    dataToFilter = dataToFilter.filter(row => {
      const cellValue = getCellValue(row, typedField);

      if (cellValue === undefined || cellValue === null) {
        if (filter.type === 'boolean' && filter.value === undefined) return true;
        if (filter.type === 'date' && filter.preset === 'all') return true;
        if (filter.type === 'date-tree' && !(filter as DateTreeFilterValue).selected?.length) return true;
        return false;
      }

      switch (filter.type) {
        case 'text':
          return String(cellValue).toLowerCase().includes(String(filter.value).toLowerCase());
        case 'number':
          return matchesNumberFilter(cellValue, filter);
        case 'date':
          return matchesDateFilter(cellValue, filter, now);
        case 'date-tree': {
          const treeFilter = filter as DateTreeFilterValue;
          if (!treeFilter.selected || treeFilter.selected.length === 0) return true;
          const parts = dateTreeKeyOf(cellValue);
          if (!parts) return false;
          return treeFilter.selected.includes(`${parts.year}-${parts.month}`);
        }
        case 'select':
          // Multi-select stores string[]; a single string is legacy single-select.
          if (Array.isArray(filter.value)) {
            return filter.value.length === 0 || filter.value.includes(String(cellValue));
          }
          return String(cellValue) === filter.value;
        case 'boolean':
          if (filter.value === undefined) return true;
          return Boolean(cellValue) === filter.value;
        default:
          return true;
      }
    });
  });

  return dataToFilter;
}

function compareValues(
  valA: any,
  valB: any,
  direction: 'asc' | 'desc',
  isDateLike = false
): number {
  if (valA === valB) return 0;
  if (valA === null || valA === undefined) return direction === 'asc' ? 1 : -1;
  if (valB === null || valB === undefined) return direction === 'asc' ? -1 : 1;

  if (typeof valA === 'number' && typeof valB === 'number') {
    return direction === 'asc' ? valA - valB : valB - valA;
  }

  if (isDateLike) {
    const dateA = new Date(String(valA)).getTime();
    const dateB = new Date(String(valB)).getTime();
    if (!isNaN(dateA) && !isNaN(dateB)) {
      return direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
  }

  if (typeof valA === 'string' && typeof valB === 'string') {
    return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  }

  return direction === 'asc'
    ? String(valA).localeCompare(String(valB))
    : String(valB).localeCompare(String(valA));
}

function looksLikeIsoDate(value: any): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(String(value));
}

export function sortRows<TData extends HierarchicalData<TData>>(
  rows: ProcessedRow<TData>[],
  columnDefinitions: ReadonlyMap<keyof TData & string, ColumnDefinition<TData>>,
  sortConfig: SortConfig<TData> | null,
  groupedBy: (keyof TData & string)[] = [],
  isTreeData = false
): ProcessedRow<TData>[] {
  const dataToSort = [...rows];

  dataToSort.sort((a, b) => {
    if (groupedBy.length > 0 && !isTreeData) {
      for (const groupField of groupedBy) {
        const groupColDef = columnDefinitions.get(groupField);
        const valA = getCellValue(a, groupField);
        const valB = getCellValue(b, groupField);
        const result = compareValues(valA, valB, 'asc', groupColDef?.filterType === 'date');

        if (result !== 0) return result;
      }
    }

    if (!sortConfig) return 0;

    const { field, direction } = sortConfig;
    const colDef = columnDefinitions.get(field);
    if (!colDef) return 0;

    const valA = getCellValue(a, field);
    const valB = getCellValue(b, field);
    const isDateLike = colDef.filterType === 'date' || (looksLikeIsoDate(valA) && looksLikeIsoDate(valB));

    return compareValues(valA, valB, direction, isDateLike);
  });

  return dataToSort;
}

export function computeAggregate<TData extends HierarchicalData<TData>>(
  items: ProcessedRow<TData>[],
  col: ColumnDefinition<TData>
): string {
  if (col.aggregate === 'count') return String(items.length);

  const nums = items
    .map(item => parseFloat(String(getCellValue(item, col.field))))
    .filter(n => !isNaN(n));

  if (nums.length === 0) return '';

  let result: number;
  switch (col.aggregate) {
    case 'sum':
      result = nums.reduce((a, b) => a + b, 0);
      break;
    case 'avg':
      result = nums.reduce((a, b) => a + b, 0) / nums.length;
      break;
    case 'min':
      result = Math.min(...nums);
      break;
    case 'max':
      result = Math.max(...nums);
      break;
    default:
      return '';
  }

  return result.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
