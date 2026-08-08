
import type { LucideIcon } from 'lucide-react';

export type FilterType = 'text' | 'number' | 'date' | 'date-tree' | 'select' | 'boolean';

export interface SparklineColumnOptions<TData = any> {
  type?: 'line' | 'area' | 'bar' | 'winloss'; // Default 'line'
  values?: (row: TData) => number[]; // Derive the series; defaults to the cell value (must be number[])
  width?: number; // px, default 120
  height?: number; // px, default 28
  color?: string; // line/area stroke and bar positive fill. Default: theme primary / --sparkline-positive.
  negativeColor?: string; // bar/winloss negative fill. Default: --sparkline-negative.
  labels?: string[] | ((row: TData) => string[]); // per-point tooltip labels (e.g. months)
  format?: (value: number) => string; // tooltip value formatting
}
export type AggregateFunction = 'sum' | 'avg' | 'min' | 'max' | 'count';
export type NumberFilterOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'between';
export const numberFilterOperators: NumberFilterOperator[] = ['=', '!=', '<', '>', '<=', '>=', 'between'];

export type ConditionalFormatOperator =
  | '='
  | '!='
  | '<'
  | '>'
  | '<='
  | '>='
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'between';

export interface ConditionalFormatRule<TData = any> {
  field?: keyof TData & string;
  operator?: ConditionalFormatOperator;
  value?: any;
  value2?: any;
  style?: React.CSSProperties;
  className?: string;
  colorScale?: {
    min?: number;
    max?: number;
    minColor: string;
    maxColor: string;
  };
  dataBar?: {
    min?: number;
    max?: number;
    color?: string;
  };
}

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
  pivotable?: boolean; // Whether column can be pivoted
  headerRenderer?: () => React.ReactNode;
  cellRenderer?: (value: any, row: TData) => React.ReactNode; // Custom cell content; takes precedence over built-in rendering
  aggregate?: AggregateFunction | AggregateFunction[]; // Single function or list of aggregate metrics shown in group header
  defaultWidth?: string | number;
  minWidth?: string | number; // Minimum width for resizing
  resizable?: boolean; // Default true
  reorderable?: boolean; // Default true
  filterOptions?: { label: string; value: any }[];
  dateTreeBuckets?: DateTreeBucket[]; // Auto-derived for filterType 'date-tree' if not supplied
  iconName?: string;
  group?: string; // Header group label; contiguous columns sharing a label render under one spanning header
  sparkline?: SparklineColumnOptions<TData>; // Render the cell as an inline mini chart; cellRenderer takes precedence
  conditionalFormats?: ConditionalFormatRule<TData>[]; // Conditional formatting rules specific to this column
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
export interface DateTreeFilterValue extends BaseFilterValue {
  type: 'date-tree';
  selected: string[]; // 'YYYY-MM' keys; empty/undefined means no filter (show all)
}

export type FilterValue = TextFilterValue | NumberFilterValue | DateFilterValue | SelectFilterValue | BooleanFilterValue | DateTreeFilterValue;

export interface DateTreeBucket {
  year: string;
  months: string[]; // '01'..'12', present in the data for that year
}

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
  virtualizedMaxHeight?: number; // Height (px) of the scroll viewport when virtualized. Default 500.
  detailRenderer?: (row: TData) => React.ReactNode; // Enables master-detail: an expander column + a full-width detail panel under each expanded row
  detailRowHeight?: number; // Fixed detail panel height (px) used by the virtualization window math. Default 300. Panels auto-size when not virtualized.
  enableRangeSelection?: boolean; // Excel-style cell range selection via drag / Shift+click / Shift+arrows. Default true.
  enableContextMenu?: boolean; // Right-click context menu with copy/pin/hide/export actions. Default true.
  getRowStyle?: (row: TData) => React.CSSProperties | undefined; // Inline style for data rows (e.g. status background)
  onFilteredDataChange?: (rows: TData[]) => void; // Fires with the filtered+sorted rows whenever they change
  globalFilterFields?: (keyof TData & string)[]; // Restrict the global search box to these fields; omit to search all visible columns
  globalFilterPlaceholder?: string;
  enableFillHandle?: boolean; // Drag the range corner to fill editable cells (series or repeat). Default true; needs onCellEdit + range selection.
  enableClipboardPaste?: boolean; // Ctrl+V pastes TSV into editable cells starting at the selection. Default true; needs onCellEdit.
  enableUndoRedo?: boolean; // Ctrl+Z / Ctrl+Y over cell edits made through the grid. Default true; needs onCellEdit.
  enableStatusBar?: boolean; // Footer bar with filtered/selected counts and range Sum/Avg/Min/Max/Count. Default true.
  enableFind?: boolean; // Ctrl+F find-in-grid bar with match highlighting and next/previous. Default true.
  enableRowReorder?: boolean; // Drag-handle column for reordering rows. Default false; needs onRowsReordered. Ignored for tree data and while sorted/grouped.
  onRowsReordered?: (data: TData[]) => void; // Receives the full data array in its new order after a row drag
  enableRangeChart?: boolean; // "Chart Selection" in the context menu: chart the selected range in a dialog. Default true; needs range selection.
  conditionalFormats?: ConditionalFormatRule<TData>[]; // Grid-level conditional formatting rules applied across columns
  serverSide?: boolean; // If true, filtering, sorting, and pagination are handled on the server
  totalRowCount?: number; // Total count of rows across all pages when serverSide is true
  onServerParamsChange?: (params: {
    page: number;
    pageSize: number;
    sortConfig: SortConfig<TData> | null;
    columnFilters: ActiveFilters<TData>;
    globalFilter: string;
  }) => void; // Event triggered when grid params change in serverSide mode
  pivotMode?: boolean; // Enable pivot table mode
  pivotColumns?: (keyof TData & string)[]; // Columns to pivot into dynamic header columns
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
