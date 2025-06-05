
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
  editable?: boolean; // Default false
  pinned?: 'left' | 'right' | null; // For column pinning
  groupable?: boolean; // Default true, whether column can be dragged to grouping panel
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

// TData items can optionally have children for tree data
export interface HierarchicalData<TData = any> {
  id: string | number;
  children?: HierarchicalData<TData>[];
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
  isTreeData?: boolean;
  treeColumn?: keyof TData & string; // Specifies which column shows tree controls
  enableGroupingPanel?: boolean; // To enable the grouping panel
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
