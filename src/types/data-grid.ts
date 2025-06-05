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
  // cellRenderer?: (row: TData, field: keyof TData) => React.ReactNode; // Removed for serializability
  headerRenderer?: () => React.ReactNode;
  defaultWidth?: string | number;
  minWidth?: string | number;
  filterOptions?: { label: string; value: any }[]; // For 'select' filterType if pre-defined or dynamically generated
  iconName?: string; // Changed from icon: LucideIcon
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
  value?: Date; // Single date, or from part of range
  // to?: Date; // Optional 'to' for date range
}
export interface SelectFilterValue extends BaseFilterValue {
  type: 'select';
  value: string | string[]; // Single or multiple select
}
export interface BooleanFilterValue extends BaseFilterValue {
  type: 'boolean';
  value?: boolean; // true, false, or undefined for 'Any'
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
  selectedRows: Set<string | number>; // Assuming rows have a unique 'id' field or using index
}
