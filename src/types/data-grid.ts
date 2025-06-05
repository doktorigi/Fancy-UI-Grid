
import type { LucideIcon } from 'lucide-react';

export type FilterType = 'text' | 'number' | 'date' | 'select' | 'boolean';
export type NumberFilterOperator = '=' | '!=' | '<' | '>' | '<=' | '>=';
export const numberFilterOperators: NumberFilterOperator[] = ['=', '!=', '<', '>', '<=', '>='];

export interface ColumnDefinition<TData = any> {
  field: keyof TData & string;
  headerText: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: FilterType;
  hideable?: boolean; // Default true
  headerRenderer?: () => React.ReactNode;
  defaultWidth?: string | number;
  minWidth?: string | number; // Minimum width for resizing
  resizable?: boolean; // Default true
  reorderable?: boolean; // Default true
  filterOptions?: { label: string; value: any }[];
  iconName?: string;
}

export interface SortConfig<TData = any> {
  field: keyof TData & string;
  direction: 'asc' | 'desc';
}

export interface BaseFilterValue {
  type: FilterType;
}
export interface TextFilterValue extends BaseFilterValue {
  type: 'text';
  value: string;
}
export interface NumberFilterValue extends BaseFilterValue {
  type: 'number';
  value?: number;
  operator: NumberFilterOperator;
}
export interface DateFilterValue extends BaseFilterValue {
  type: 'date';
  value?: Date;
}
export interface SelectFilterValue extends BaseFilterValue {
  type: 'select';
  value: string | string[];
}
export interface BooleanFilterValue extends BaseFilterValue {
  type: 'boolean';
  value?: boolean;
}

export type FilterValue = TextFilterValue | NumberFilterValue | DateFilterValue | SelectFilterValue | BooleanFilterValue;

export interface ActiveFilters<TData = any> {
  [field: string]: FilterValue;
}

export interface DataGridProps<TData = any> {
  data: TData[];
  columnDefs: ColumnDefinition<TData>[];
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  enableRowSelection?: boolean;
}

export interface DataGridState<TData = any> {
  currentPage: number;
  pageSize: number;
  sortConfig: SortConfig<TData> | null;
  globalFilter: string;
  columnFilters: ActiveFilters<TData>;
  visibleColumns: (keyof TData & string)[];
  selectedRows: Set<string | number>;
  columnOrder: (keyof TData & string)[]; // For reordering
  columnWidths: Record<keyof TData & string, string | number>; // For resizing
  draggedColumn: (keyof TData & string) | null; // For reordering visual
  draggedOverColumn: (keyof TData & string) | null; // For reordering visual feedback
}

