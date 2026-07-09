
import type { LucideIcon } from 'lucide-react';

export type FilterType = 'text' | 'number' | 'date' | 'select' | 'boolean';
export type AggregateFunction = 'sum' | 'avg' | 'min' | 'max' | 'count';
export type NumberFilterOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'between';
export const numberFilterOperators: NumberFilterOperator[] = ['=', '!=', '<', '>', '<=', '>=', 'between'];

export type DateRangePreset = 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';

export const dateRangePresetOptions: { label: string; value: DateRangePreset }[] = [
  { label: 'Any Date', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last7days' },
  { label: 'Last 30 Days', value: 'last30days' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Custom Range', value: 'custom' },
];


export interface ColumnDefinition<TData = any> {
  field: keyof TData & string;
  headerText: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: FilterType;
  hideable?: boolean; // Default true
  editable?: boolean; // Default false
  pinned?: 'left' | 'right' | null; // For column pinning
  groupable?: boolean; // Default true, whether column can be dragged to grouping panel
  headerRenderer?: () => React.ReactNode;
  cellRenderer?: (value: any, row: TData) => React.ReactNode; // Custom cell content; takes precedence over built-in rendering
  aggregate?: AggregateFunction; // Shown in group header rows when grouping is active
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
  value?: number; // For 'between', this is the lower bound
  value2?: number; // For 'between', this is the upper bound
  operator: NumberFilterOperator;
}
export interface DateFilterValue extends BaseFilterValue {
  type: 'date';
  preset?: DateRangePreset;
  value?: Date; // For 'custom' range, this is the start date
  value2?: Date; // For 'custom' range, this is the end date
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

// TData items can optionally have children for tree data
export interface HierarchicalData<TData = any> {
  id: string | number;
  children?: TData[];
  // Other properties of TData
  [key: string]: any;
}

export interface ProcessedRow<TData extends HierarchicalData<TData>> {
  originalRow: TData;
  id: string | number;
  level: number;
  hasChildren: boolean;
  isExpanded?: boolean; // Optional, can be derived from expandedRows set
  isGroupHeader?: boolean; // True if this row is a group header
  groupField?: keyof TData & string; // Field used for grouping if this is a group header
  groupValue?: any; // Value of the group field if this is a group header
  groupKey?: string; // e.g., "City: New York"
  groupItems?: ProcessedRow<TData>[]; // Items within this group if it's a group header
  // Allow direct access to originalRow properties
  [key: string]: any;
}


export interface DataGridProps<TData extends HierarchicalData<TData>> {
  data: TData[];
  columnDefs: ColumnDefinition<TData>[];
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  enableRowSelection?: boolean;
  onCellEdit?: (rowId: string | number, field: keyof TData & string, value: any) => void;
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  isTreeData?: boolean;
  treeColumn?: keyof TData & string; // Specifies which column shows tree controls
  enableGroupingPanel?: boolean; // To enable the grouping panel
  storageKey?: string; // localStorage key for state persistence; set a unique key per grid instance
  virtualized?: boolean;
  rowHeight?: number;
}

export interface DataGridState<TData extends HierarchicalData<TData>> {
  currentPage: number;
  pageSize: number;
  sortConfig: SortConfig<TData> | null;
  globalFilter: string;
  columnFilters: ActiveFilters<TData>;
  visibleColumns: (keyof TData & string)[];
  selectedRows: Set<string | number>;
  columnOrder: (keyof TData & string)[];
  columnWidths: Record<keyof TData & string, string | number>;
  draggedColumn: (keyof TData & string) | null; // For reordering
  draggedOverColumn: (keyof TData & string) | null; // For reordering
  editingCell?: { rowId: string | number; field: keyof TData & string } | null;
  editInputValue?: any;
  pinnedColumns: {
    left: (keyof TData & string)[];
    right: (keyof TData & string)[];
  };
  expandedRows: Set<string | number>; // For tree data
  focusedCell: { rowId: string | number; colField: keyof TData & string } | null; // For keyboard navigation
  groupedBy: (keyof TData & string)[]; // For column grouping
  expandedGroups: Set<string>; // Tracks expanded group keys
}
