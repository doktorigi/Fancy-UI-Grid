"use client";
import * as React from 'react';
import type {
  AggregateFunction,
  ColumnDefinition,
  DataGridProps,
  DataGridState,
  FilterValue,
  FormulaColumnConfig,
  GridDensity,
  GridViewPreset,
  HierarchicalData,
  PivotValueConfig,
  ProcessedRow,
} from '@/types/data-grid';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DataGridHeaderCell } from './DataGridHeaderCell';
import { DataGridFloatingFilterCell } from './DataGridFloatingFilterCell';
import { DataGridPagination } from './DataGridPagination';
import { ColumnVisibilityToggle } from './ColumnVisibilityToggle';
import { DataGridGroupingPanel } from './DataGridGroupingPanel';
import { DataGridPivotPanel } from './DataGridPivotPanel';
import { DataGridFormulaDialog } from './DataGridFormulaDialog';
import { DataGridViewsMenu, DataGridDensitySelector } from './DataGridViewsMenu';
import { DataGridStatusBar } from './DataGridStatusBar';
import { DataGridFindBar } from './DataGridFindBar';
import { Sparkline } from './Sparkline';
import { RangeChartDialog } from './RangeChartDialog';
import { extractRangeChartData, type RangeChartData } from '@/lib/rangeChart';
import { applyFormulaColumnsToRows } from '@/lib/formulaEngine';
import {
  applyGridViewSnapshot,
  createGridViewSnapshot,
  getDensityRowMetrics,
  mergeSavedViews,
} from '@/lib/savedViews';
import { cn, getCellValue } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, ChevronDown, Columns3, FileDown, FilterX, GripVertical, ListFilter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToCsv, exportToXlsx } from '@/lib/exportUtils';
import {
  buildHeaderGroupSpans,
  computeAggregate,
  computeFillValues,
  computeNextSortConfigs,
  computeRangeStats,
  dateTreeKeyOf,
  filterRows,
  findCellMatches,
  parseClipboardText,
  sortRows,
  toStrictNumber,
} from '@/lib/gridProcessing';
import {
  buildPivotTable,
  deriveDefaultPivotValues,
} from '@/lib/pivotTable';
import {
  getConditionalCellStyle,
  computeColumnBounds,
  type DerivedColumnBounds,
} from '@/lib/conditionalFormatting';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
const DEFAULT_COL_WIDTH = 150; // px
const LOCAL_STORAGE_KEY = 'ngxMatDataGridState';

export function DataGrid<TData extends HierarchicalData<TData>>({
  data: initialData,
  columnDefs: initialColumnDefs,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  enableRowSelection = true,
  onCellEdit,
  onSelectionChange,
  isTreeData = false,
  treeColumn: specifiedTreeColumn,
  enableGroupingPanel = false,
  storageKey = LOCAL_STORAGE_KEY,
  virtualized = false,
  rowHeight = 44,
  virtualizedMaxHeight = 500,
  detailRenderer,
  detailRowHeight = 300,
  enableRangeSelection = true,
  enableContextMenu = true,
  getRowStyle,
  onFilteredDataChange,
  globalFilterFields,
  globalFilterPlaceholder = 'Search all columns...',
  enableRangeChart = true,
  enableFillHandle = true,
  enableClipboardPaste = true,
  enableUndoRedo = true,
  enableStatusBar = true,
  enableFind = true,
  enableRowReorder = false,
  onRowsReordered,
  conditionalFormats,
  serverSide = false,
  totalRowCount,
  onServerParamsChange,
  enableFloatingFilters = false,
  pivotMode = false,
  enablePivotToggle,
  pivotColumns = [],
  pivotValues,
  density = 'normal',
  enableDensitySelector = true,
  onDensityChange,
  enableSavedViews = true,
  savedViews = [],
  onSavedViewsChange,
  enableFormulaColumns = true,
  formulaColumns: initialFormulaColumns = [],
  onFormulaColumnsChange,
}: DataGridProps<TData>) {
  const tableWrapperRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (virtualized) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  };

  const [state, setState] = React.useState<DataGridState<TData>>(() => {
    const defaultWidths = {} as Record<keyof TData & string, string | number>;
    const initialPinnedLeftFromDefs: (keyof TData & string)[] = [];
    const initialPinnedRightFromDefs: (keyof TData & string)[] = [];
    const allFieldsFromDefs = initialColumnDefs.map(col => col.field);
    const initialVisibleColumnsFromDefs = initialColumnDefs.map(col => col.field);

    const initialDynamicFields = (initialFormulaColumns || [])
      .map(fc => fc.field as keyof TData & string)
      .filter(f => !allFieldsFromDefs.includes(f));
    const combinedInitialFields = [...allFieldsFromDefs, ...initialDynamicFields];

    initialColumnDefs.forEach(col => {
      defaultWidths[col.field] = col.defaultWidth || `${DEFAULT_COL_WIDTH}px`;
      if (col.pinned === 'left') {
        initialPinnedLeftFromDefs.push(col.field);
      } else if (col.pinned === 'right') {
        initialPinnedRightFromDefs.push(col.field);
      }
    });
    initialDynamicFields.forEach(field => {
      defaultWidths[field] = `${DEFAULT_COL_WIDTH}px`;
    });

    const unpinnedColumnOrderFromDefs = combinedInitialFields.filter(
      field => !initialPinnedLeftFromDefs.includes(field) && !initialPinnedRightFromDefs.includes(field)
    );

    return {
      currentPage: 1,
      pageSize: defaultPageSize,
      sortConfig: null,
      multiSortConfig: [],
      globalFilter: '',
      columnFilters: {},
      visibleColumns: [...initialVisibleColumnsFromDefs, ...initialDynamicFields],
      selectedRows: new Set<string | number>(),
      columnOrder: unpinnedColumnOrderFromDefs,
      columnWidths: defaultWidths,
      draggedColumn: null,
      draggedOverColumn: null,
      editingCell: null,
      editInputValue: '',
      pinnedColumns: { left: initialPinnedLeftFromDefs, right: initialPinnedRightFromDefs },
      expandedRows: new Set<string | number>(),
      focusedCell: null,
      groupedBy: [],
      expandedGroups: new Set<string>(),
      pivotMode,
      pivotColumns,
      pivotValues: pivotValues && pivotValues.length > 0 ? pivotValues : deriveDefaultPivotValues(initialColumnDefs),
      floatingFiltersOpen: enableFloatingFilters,
      density,
      formulaColumns: initialFormulaColumns || [],
      activeViewId: null,
    };
  });

  // Sync controlled props when parent toggles pivotMode, enableFloatingFilters, or density
  React.useEffect(() => {
    setState(prev => (prev.pivotMode === pivotMode ? prev : { ...prev, pivotMode, currentPage: 1 }));
  }, [pivotMode]);

  React.useEffect(() => {
    setState(prev =>
      prev.floatingFiltersOpen === enableFloatingFilters
        ? prev
        : { ...prev, floatingFiltersOpen: enableFloatingFilters }
    );
  }, [enableFloatingFilters]);

  React.useEffect(() => {
    setState(prev => (prev.density === density ? prev : { ...prev, density }));
  }, [density]);

  const [userSavedViews, setUserSavedViews] = React.useState<GridViewPreset<TData>[]>([]);
  const viewsStorageKey = `${storageKey}_views`;

  const allSavedViews = React.useMemo(
    () => mergeSavedViews(savedViews, userSavedViews),
    [savedViews, userSavedViews]
  );

  const densityMetrics = React.useMemo(
    () => getDensityRowMetrics(state.density || 'normal'),
    [state.density]
  );
  const effectiveRowHeight = rowHeight !== 44 ? rowHeight : densityMetrics.defaultRowHeight;

  const isPivotActive = !!state.pivotMode && !isTreeData;
  const masterDetail = !!detailRenderer && !isPivotActive;
  // Master-detail expansion is deliberately not persisted to localStorage — detail
  // panels are transient drill-downs, not layout configuration.
  const [expandedDetails, setExpandedDetails] = React.useState<Set<string | number>>(new Set());

  // Range selection: indices are positions in the current display list (paginatedData)
  // and in orderedVisibleColumnDefs, so ranges follow what the user actually sees.
  const [rangeAnchor, setRangeAnchor] = React.useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [rangeEnd, setRangeEnd] = React.useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [isDraggingRange, setIsDraggingRange] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; rowId: string | number; colField: keyof TData & string } | null>(null);

  // Fill handle: fillEnd tracks the cell under the pointer while dragging the range corner.
  const [isFilling, setIsFilling] = React.useState(false);
  const [fillEnd, setFillEnd] = React.useState<{ rowIndex: number; colIndex: number } | null>(null);

  // Find-in-grid. Matches are recomputed only while the bar is open.
  const [findOpen, setFindOpen] = React.useState(false);
  const [findQuery, setFindQuery] = React.useState('');
  const [findActiveIdx, setFindActiveIdx] = React.useState(0);

  // Row drag-and-drop reorder.
  const [draggedRowId, setDraggedRowId] = React.useState<string | number | null>(null);
  const [rowDropTarget, setRowDropTarget] = React.useState<{ rowId: string | number; position: 'above' | 'below' } | null>(null);

  // Chart Selection dialog. The extraction is snapshotted when the menu item is
  // clicked so the open chart survives the range clearing underneath it.
  const [rangeChartData, setRangeChartData] = React.useState<RangeChartData | null>(null);

  // Undo/redo over grid-driven cell edits. Refs, not state: the stacks never drive a
  // render on their own — the parent's data change does.
  type EditRecord = { rowId: string | number; field: keyof TData & string; prevValue: any; nextValue: any };
  const undoStackRef = React.useRef<EditRecord[][]>([]);
  const redoStackRef = React.useRef<EditRecord[][]>([]);

  const canEditCells = !!onCellEdit && !isPivotActive;
  const fillHandleEnabled = enableFillHandle && enableRangeSelection && canEditCells;
  const pasteEnabled = enableClipboardPaste && canEditCells;
  const undoRedoEnabled = enableUndoRedo && canEditCells;
  const rowReorderEnabled = enableRowReorder && !!onRowsReordered && !isTreeData && !isPivotActive;

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedViewsStr = localStorage.getItem(viewsStorageKey);
      if (savedViewsStr) {
        try {
          const parsedViews = JSON.parse(savedViewsStr);
          if (Array.isArray(parsedViews)) {
            setUserSavedViews(parsedViews);
          }
        } catch (err) {
          console.error("Error loading saved views from localStorage:", err);
        }
      }

      const savedStateString = localStorage.getItem(storageKey);
      if (savedStateString) {
        try {
          const savedState = JSON.parse(savedStateString);
          const restoredFormulaCols: FormulaColumnConfig[] = Array.isArray(savedState.formulaColumns)
            ? savedState.formulaColumns
            : initialFormulaColumns || [];
          const currentFieldsSet = new Set<keyof TData & string>([
            ...initialColumnDefs.map(col => col.field),
            ...restoredFormulaCols.map(fc => fc.field as keyof TData & string),
          ]);

          let reconciledVisibleColumns = (savedState.visibleColumns || [])
            .filter((field: keyof TData & string) => currentFieldsSet.has(field));
          initialColumnDefs.forEach(col => {
            if (!reconciledVisibleColumns.includes(col.field)) {
              if (col.hideable === false || col.pinned === 'left' || col.pinned === 'right' || !savedState.visibleColumns) {
                reconciledVisibleColumns.push(col.field);
              }
            }
          });
          restoredFormulaCols.forEach(fc => {
            const field = fc.field as keyof TData & string;
            if (!reconciledVisibleColumns.includes(field)) {
              reconciledVisibleColumns.push(field);
            }
          });
          if (reconciledVisibleColumns.length === 0 && initialColumnDefs.length > 0) {
             reconciledVisibleColumns = Array.from(currentFieldsSet);
          }

          const reconciledPinnedLeft = (savedState.pinnedColumns?.left || [])
            .filter((field: keyof TData & string) => currentFieldsSet.has(field));
          const reconciledPinnedRight = (savedState.pinnedColumns?.right || [])
            .filter((field: keyof TData & string) => currentFieldsSet.has(field));

          initialColumnDefs.forEach(col => {
            if (col.pinned === 'left' && !reconciledPinnedLeft.includes(col.field) && !reconciledPinnedRight.includes(col.field)) {
              reconciledPinnedLeft.push(col.field);
            } else if (col.pinned === 'right' && !reconciledPinnedRight.includes(col.field) && !reconciledPinnedLeft.includes(col.field)) {
              reconciledPinnedRight.push(col.field);
            }
          });

          let reconciledUnpinnedOrder = (savedState.columnOrder || [])
            .filter((field: keyof TData & string) => currentFieldsSet.has(field) &&
                                                 !reconciledPinnedLeft.includes(field) &&
                                                 !reconciledPinnedRight.includes(field));

          currentFieldsSet.forEach(field => {
            if (!reconciledPinnedLeft.includes(field) &&
                !reconciledPinnedRight.includes(field) &&
                !reconciledUnpinnedOrder.includes(field)) {
              reconciledUnpinnedOrder.push(field);
            }
          });
          
          const reconciledColumnFilters = savedState.columnFilters || {};
          Object.keys(reconciledColumnFilters).forEach(field => {
            const filter = reconciledColumnFilters[field];
            if (filter.type === 'date') {
              if (filter.value) filter.value = new Date(filter.value);
              if (filter.value2) filter.value2 = new Date(filter.value2);
            }
          });

          const savedMultiSort = Array.isArray(savedState.multiSortConfig)
            ? savedState.multiSortConfig
            : savedState.sortConfig
              ? [savedState.sortConfig]
              : [];

          const savedPivotCols = Array.isArray(savedState.pivotColumns)
            ? savedState.pivotColumns.filter((f: keyof TData & string) => currentFieldsSet.has(f))
            : [];

          const savedPivotVals = Array.isArray(savedState.pivotValues)
            ? savedState.pivotValues.filter((v: PivotValueConfig<TData>) => currentFieldsSet.has(v.field))
            : [];

          setState(prevState => ({
            ...prevState,
            columnWidths: { ...prevState.columnWidths, ...(savedState.columnWidths || {}) },
            columnOrder: reconciledUnpinnedOrder,
            pinnedColumns: {
              left: reconciledPinnedLeft,
              right: reconciledPinnedRight
            },
            columnFilters: reconciledColumnFilters,
            sortConfig: savedMultiSort[0] || savedState.sortConfig || null,
            multiSortConfig: savedMultiSort,
            pageSize: savedState.pageSize || defaultPageSize,
            expandedRows: savedState.expandedRows ? new Set(Array.from(savedState.expandedRows)) : new Set(),
            visibleColumns: reconciledVisibleColumns.length > 0 ? reconciledVisibleColumns : prevState.visibleColumns,
            groupedBy: (savedState.groupedBy || []).filter((f: keyof TData & string) => currentFieldsSet.has(f)), 
            expandedGroups: savedState.expandedGroups ? new Set(Array.from(savedState.expandedGroups)) : new Set(),
            pivotMode: pivotMode || !!savedState.pivotMode,
            pivotColumns: pivotColumns.length > 0 ? pivotColumns : savedPivotCols,
            pivotValues:
              pivotValues && pivotValues.length > 0
                ? pivotValues
                : savedPivotVals.length > 0
                  ? savedPivotVals
                  : prevState.pivotValues,
            floatingFiltersOpen: enableFloatingFilters || !!savedState.floatingFiltersOpen,
            density: savedState.density || density || 'normal',
            formulaColumns: restoredFormulaCols,
            activeViewId: savedState.activeViewId || null,
            currentPage: 1, 
            focusedCell: null,
          }));
        } catch (error) {
          console.error("Error loading saved grid state from localStorage:", error);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const stateToSave = {
        columnWidths: state.columnWidths,
        columnOrder: state.columnOrder,
        pinnedColumns: state.pinnedColumns,
        columnFilters: state.columnFilters,
        sortConfig: state.sortConfig,
        multiSortConfig: state.multiSortConfig,
        pageSize: state.pageSize,
        expandedRows: Array.from(state.expandedRows),
        visibleColumns: state.visibleColumns,
        groupedBy: state.groupedBy, 
        expandedGroups: Array.from(state.expandedGroups),
        pivotMode: state.pivotMode,
        pivotColumns: state.pivotColumns,
        pivotValues: state.pivotValues,
        floatingFiltersOpen: state.floatingFiltersOpen,
        density: state.density,
        formulaColumns: state.formulaColumns,
        activeViewId: state.activeViewId,
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    }
  }, [
    storageKey,
    state.columnWidths,
    state.columnOrder,
    state.pinnedColumns,
    state.columnFilters,
    state.sortConfig,
    state.multiSortConfig,
    state.pageSize,
    state.expandedRows,
    state.visibleColumns,
    state.groupedBy, 
    state.expandedGroups,
    state.pivotMode,
    state.pivotColumns,
    state.pivotValues,
    state.floatingFiltersOpen,
    state.density,
    state.formulaColumns,
    state.activeViewId,
  ]);

  const treeColumn = specifiedTreeColumn || (initialColumnDefs.length > 0 ? initialColumnDefs[0].field : undefined);

  const combinedColumnDefs = React.useMemo<ColumnDefinition<TData>[]>(() => {
    const baseFields = new Set(initialColumnDefs.map(c => String(c.field)));
    const dynamicCols: ColumnDefinition<TData>[] = (state.formulaColumns || [])
      .filter(fc => !baseFields.has(fc.field))
      .map(fc => ({
        field: fc.field as keyof TData & string,
        headerText: fc.headerText,
        formula: fc.formula,
        aggregate: fc.aggregate,
        filterType: fc.filterType || 'number',
        sortable: true,
        filterable: true,
        hideable: true,
        editable: false,
        groupable: true,
        pivotable: true,
        defaultWidth: '150px',
      }));

    const updatedBase = initialColumnDefs.map(col => {
      const override = (state.formulaColumns || []).find(fc => fc.field === String(col.field));
      return override
        ? {
            ...col,
            headerText: override.headerText,
            formula: override.formula,
            aggregate: override.aggregate ?? col.aggregate,
          }
        : col;
    });

    return [...updatedBase, ...dynamicCols];
  }, [initialColumnDefs, state.formulaColumns]);

  const activeFormulaSpecs = React.useMemo(
    () =>
      combinedColumnDefs
        .filter(c => !!c.formula)
        .map(c => ({ field: String(c.field), formula: c.formula! })),
    [combinedColumnDefs]
  );

  const dataWithFormulas = React.useMemo(
    () => applyFormulaColumnsToRows(initialData || [], activeFormulaSpecs, isTreeData),
    [initialData, activeFormulaSpecs, isTreeData]
  );

  const getUniqueColumnValues = React.useCallback((field: keyof TData & string): string[] => {
    if (!dataWithFormulas) return [];
    const uniqueValues = new Set<string>();
    const traverse = (items: TData[]) => {
      items.forEach(row => {
        const value = getCellValue({originalRow: row} as ProcessedRow<TData>, field);
        if (value !== undefined && value !== null) {
          uniqueValues.add(String(value));
        }
        if (isTreeData && row.children) {
          traverse(row.children);
        }
      });
    };
    traverse(dataWithFormulas);
    return Array.from(uniqueValues).sort();
  }, [dataWithFormulas, isTreeData]);

  const getDateTreeBuckets = React.useCallback((field: keyof TData & string) => {
    const monthsByYear = new Map<string, Set<string>>();
    (dataWithFormulas || []).forEach(row => {
      const parts = dateTreeKeyOf(getCellValue({ originalRow: row } as ProcessedRow<TData>, field));
      if (!parts) return;
      if (!monthsByYear.has(parts.year)) monthsByYear.set(parts.year, new Set());
      monthsByYear.get(parts.year)!.add(parts.month);
    });
    return Array.from(monthsByYear.entries())
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, months]) => ({ year, months: Array.from(months).sort() }));
  }, [dataWithFormulas]);

  const processedColumnDefs = React.useMemo(() => {
    return combinedColumnDefs.map(colDef => {
      if (colDef.filterable && colDef.filterType === 'select' && !colDef.filterOptions) {
        return {
          ...colDef,
          filterOptions: getUniqueColumnValues(colDef.field).map(val => ({ label: val, value: val }))
        };
      }
      if (colDef.filterable && colDef.filterType === 'date-tree' && !colDef.dateTreeBuckets) {
        return { ...colDef, dateTreeBuckets: getDateTreeBuckets(colDef.field) };
      }
      return colDef;
    });
  }, [combinedColumnDefs, getUniqueColumnValues, getDateTreeBuckets]);

  const colDefsMap = React.useMemo(() => new Map(processedColumnDefs.map(col => [col.field, col])), [processedColumnDefs]);


  const flattenTreeData = React.useCallback((
    data: TData[],
    expandedRows: Set<string | number>,
    level = 0
  ): ProcessedRow<TData>[] => {
    let flatList: ProcessedRow<TData>[] = [];
    data.forEach(item => {
      const hasChildren = !!(item.children && item.children.length > 0);
      const isExpanded = expandedRows.has(item.id);
      flatList.push({
        originalRow: item,
        id: item.id,
        level,
        hasChildren,
        isExpanded,
      });
      if (hasChildren && isExpanded && item.children) {
        flatList = flatList.concat(flattenTreeData(item.children, expandedRows, level + 1));
      }
    });
    return flatList;
  }, []);

  const baseDataForProcessing = React.useMemo<ProcessedRow<TData>[]>(() => {
    if (isTreeData) {
      return flattenTreeData(dataWithFormulas || [], state.expandedRows);
    }
    return (dataWithFormulas || []).map(item => ({
      originalRow: item,
      id: item.id,
      level: 0,
      hasChildren: false,
      isExpanded: false,
    }));
  }, [dataWithFormulas, isTreeData, flattenTreeData, state.expandedRows]);

  const handleSort = (field: keyof TData & string, multiSort = false) => {
    setState((prevState) => {
      const currentList =
        prevState.multiSortConfig && prevState.multiSortConfig.length > 0
          ? prevState.multiSortConfig
          : prevState.sortConfig
            ? [prevState.sortConfig]
            : [];
      const nextList = computeNextSortConfigs(currentList, field, multiSort);
      return {
        ...prevState,
        multiSortConfig: nextList,
        sortConfig: nextList[0] || null,
        currentPage: 1,
      };
    });
  };

  const handleGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prevState) => ({ ...prevState, globalFilter: e.target.value, currentPage: 1 }));
  };

  const handleColumnFilterChange = (field: keyof TData & string, value?: FilterValue) => {
    setState((prevState) => {
      const newColumnFilters = { ...prevState.columnFilters };
      if (value === undefined ||
          (value.type === 'text' && value.value === '') ||
          (value.type === 'number' && value.value === undefined && (value.operator !== 'between' || value.value2 === undefined)) ||
          (value.type === 'date' && value.preset === 'all') ||
          (value.type === 'date-tree' && (!value.selected || value.selected.length === 0)) ||
          (value.type === 'select' && (Array.isArray(value.value) ? value.value.length === 0 : value.value === '')) ||
          (value.type === 'boolean' && value.value === undefined)) {
        delete newColumnFilters[field];
      } else {
        newColumnFilters[field] = value;
      }
      return { ...prevState, columnFilters: newColumnFilters, currentPage: 1 };
    });
  };

  const handlePageChange = (page: number) => {
    setState((prevState) => ({ ...prevState, currentPage: page, focusedCell: null }));
  };

  const handlePageSizeChange = (size: number) => {
    setState((prevState) => ({ ...prevState, pageSize: size, currentPage: 1, focusedCell: null }));
  };

  const handleColumnVisibilityChange = (field: keyof TData & string, isVisible: boolean) => {
    setState((prevState) => {
      const newVisibleColumns = isVisible
        ? [...prevState.visibleColumns, field]
        : prevState.visibleColumns.filter((vc) => vc !== field);
      return { ...prevState, visibleColumns: newVisibleColumns };
    });
  };

  const handleSelectRow = (rowId: string | number, isSelected: boolean) => {
    setState(prevState => {
      const newSelectedRows = new Set(prevState.selectedRows);
      if (isSelected) {
        newSelectedRows.add(rowId);
      } else {
        newSelectedRows.delete(rowId);
      }
      onSelectionChange?.(Array.from(newSelectedRows));
      return { ...prevState, selectedRows: newSelectedRows };
    });
  };

  const handleSelectAllRows = (isSelected: boolean) => {
    setState(prevState => {
      const newSelectedRows = new Set<string | number>();
      if (isSelected) {
        paginatedData.forEach(row => {
          if (!row.isGroupHeader) newSelectedRows.add(row.id)
        });
      }
      onSelectionChange?.(Array.from(newSelectedRows));
      return { ...prevState, selectedRows: newSelectedRows };
    });
  };

  const handleToggleExpandRow = (rowId: string | number) => {
    setState(prevState => {
      const newExpandedRows = new Set(prevState.expandedRows);
      if (newExpandedRows.has(rowId)) {
        newExpandedRows.delete(rowId);
      } else {
        newExpandedRows.add(rowId);
      }
      return { ...prevState, expandedRows: newExpandedRows };
    });
  };

  const handleToggleDetail = (rowId: string | number) => {
    setExpandedDetails(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleToggleExpandGroup = (groupKey: string) => {
    setState(prevState => {
      const newExpandedGroups = new Set(prevState.expandedGroups);
      if (newExpandedGroups.has(groupKey)) {
        newExpandedGroups.delete(groupKey);
      } else {
        newExpandedGroups.add(groupKey);
      }
      return { ...prevState, expandedGroups: newExpandedGroups, currentPage: 1 };
    });
  };


  const handleColumnWidthChange = (field: keyof TData & string, newWidth: number) => {
    setState(prevState => ({
      ...prevState,
      columnWidths: {
        ...prevState.columnWidths,
        [field]: `${newWidth}px`,
      }
    }));
  };

  const handleDragStartColumn = (field: keyof TData & string, event: React.DragEvent) => {
    event.dataTransfer.setData('text/plain', field);
    document.body.classList.add('dragging-column'); 
    setState(prevState => ({ ...prevState, draggedColumn: field }));
  };


  const handleDragOverReorder = (event: React.DragEvent, targetField: keyof TData & string) => {
    event.preventDefault();
    if (state.draggedColumn && state.draggedColumn !== targetField) {
       const isTargetPinned = state.pinnedColumns.left.includes(targetField) || state.pinnedColumns.right.includes(targetField);
       if (!isTargetPinned) {
         setState(prevState => ({ ...prevState, draggedOverColumn: targetField }));
       }
    }
  };

  const handleDragLeaveReorder = () => {
    setState(prevState => ({ ...prevState, draggedOverColumn: null }));
  };

  const handleDropReorder = (targetField: keyof TData & string, event: React.DragEvent) => {
    event.preventDefault();
    document.body.classList.remove('dragging-column');
    const sourceField = state.draggedColumn;

    const isSourcePinned = state.pinnedColumns.left.includes(sourceField!) || state.pinnedColumns.right.includes(sourceField!);
    const isTargetPinned = state.pinnedColumns.left.includes(targetField) || state.pinnedColumns.right.includes(targetField);

    if (sourceField && sourceField !== targetField && !isSourcePinned && !isTargetPinned) {
      setState(prevState => {
        const newColumnOrder = [...prevState.columnOrder];
        const sourceIndex = newColumnOrder.indexOf(sourceField);
        const targetIndex = newColumnOrder.indexOf(targetField);

        if (sourceIndex > -1 && targetIndex > -1) {
          const [removed] = newColumnOrder.splice(sourceIndex, 1);
          newColumnOrder.splice(targetIndex, 0, removed);
        }
        return { ...prevState, columnOrder: newColumnOrder, draggedColumn: null, draggedOverColumn: null };
      });
    } else {
       setState(prevState => ({ ...prevState, draggedColumn: null, draggedOverColumn: null }));
    }
  };

  const handleDragEndColumn = () => {
    document.body.classList.remove('dragging-column');
    setState(prevState => ({ ...prevState, draggedColumn: null, draggedOverColumn: null }));
  };


  const handlePinColumn = (fieldToPin: keyof TData & string, position: 'left' | 'right' | null) => {
    setState(prevState => {
      let newPinnedLeft = [...prevState.pinnedColumns.left.filter(f => f !== fieldToPin)];
      let newPinnedRight = [...prevState.pinnedColumns.right.filter(f => f !== fieldToPin)];
      let newColumnOrder = [...prevState.columnOrder.filter(f => f !== fieldToPin)];

      if (position === 'left') {
        newPinnedRight = newPinnedRight.filter(f => f !== fieldToPin);
        if (!newPinnedLeft.includes(fieldToPin)) newPinnedLeft.push(fieldToPin);
      } else if (position === 'right') {
        newPinnedLeft = newPinnedLeft.filter(f => f !== fieldToPin);
        if (!newPinnedRight.includes(fieldToPin)) newPinnedRight.push(fieldToPin);
      } else {
        if (!newColumnOrder.includes(fieldToPin)) {
            const originalDefIndex = initialColumnDefs.findIndex(c => c.field === fieldToPin);
            let insertAtIndex = newColumnOrder.length;
            for (let i = 0; i < newColumnOrder.length; i++) {
                const currentFieldInOrder = newColumnOrder[i];
                const originalIndexOfCurrent = initialColumnDefs.findIndex(c => c.field === currentFieldInOrder);
                if (originalDefIndex < originalIndexOfCurrent) {
                    insertAtIndex = i;
                    break;
                }
            }
            newColumnOrder.splice(insertAtIndex, 0, fieldToPin);
        }
      }
      return {
        ...prevState,
        pinnedColumns: { left: newPinnedLeft, right: newPinnedRight },
        columnOrder: newColumnOrder,
      };
    });
  };

  const handleGroupColumn = (field: keyof TData & string) => {
    setState(prevState => {
      if (prevState.groupedBy.includes(field)) return prevState;
      const newGroupedBy = [...prevState.groupedBy, field]; 
      return {
        ...prevState,
        groupedBy: newGroupedBy,
        pivotColumns: (prevState.pivotColumns || []).filter(f => f !== field),
        currentPage: 1,
        expandedGroups: new Set(),
      };
    });
  };

  const handleUngroupColumn = (field: keyof TData & string) => {
    setState(prevState => ({
      ...prevState,
      groupedBy: prevState.groupedBy.filter(f => f !== field),
      currentPage: 1,
      expandedGroups: new Set(),
    }));
  };

  // ---- Formula Columns, Row Density & Saved Views handlers ----
  const handleDensityChange = (nextDensity: GridDensity) => {
    setState(prev => ({ ...prev, density: nextDensity }));
    onDensityChange?.(nextDensity);
  };

  const handleSaveFormulaColumn = (
    col: FormulaColumnConfig,
    previousField?: string
  ) => {
    setState(prev => {
      const currentFormulas = prev.formulaColumns || [];
      const targetField = previousField || col.field;
      const existsIdx = currentFormulas.findIndex(fc => fc.field === targetField);
      const nextFormulas =
        existsIdx >= 0
          ? currentFormulas.map((fc, idx) => (idx === existsIdx ? col : fc))
          : [...currentFormulas, col];

      const typedField = col.field as keyof TData & string;
      const nextVisible = prev.visibleColumns.includes(typedField)
        ? prev.visibleColumns
        : [...prev.visibleColumns, typedField];
      const nextOrder =
        prev.columnOrder.includes(typedField) ||
        prev.pinnedColumns.left.includes(typedField) ||
        prev.pinnedColumns.right.includes(typedField)
          ? prev.columnOrder
          : [...prev.columnOrder, typedField];
      const nextWidths = {
        ...prev.columnWidths,
        [typedField]: prev.columnWidths[typedField] || `${DEFAULT_COL_WIDTH}px`,
      };

      onFormulaColumnsChange?.(nextFormulas);
      return {
        ...prev,
        formulaColumns: nextFormulas,
        visibleColumns: nextVisible,
        columnOrder: nextOrder,
        columnWidths: nextWidths,
      };
    });
  };

  const handleRemoveFormulaColumn = (field: string) => {
    setState(prev => {
      const nextFormulas = (prev.formulaColumns || []).filter(fc => fc.field !== field);
      const nextColumnFilters = { ...prev.columnFilters };
      delete nextColumnFilters[field];
      onFormulaColumnsChange?.(nextFormulas);
      return {
        ...prev,
        formulaColumns: nextFormulas,
        visibleColumns: prev.visibleColumns.filter(f => String(f) !== field),
        columnOrder: prev.columnOrder.filter(f => String(f) !== field),
        pinnedColumns: {
          left: prev.pinnedColumns.left.filter(f => String(f) !== field),
          right: prev.pinnedColumns.right.filter(f => String(f) !== field),
        },
        groupedBy: prev.groupedBy.filter(f => String(f) !== field),
        pivotColumns: (prev.pivotColumns || []).filter(f => String(f) !== field),
        pivotValues: (prev.pivotValues || []).filter(v => String(v.field) !== field),
        columnFilters: nextColumnFilters,
      };
    });
  };

  const persistUserSavedViews = (nextViews: GridViewPreset<TData>[]) => {
    setUserSavedViews(nextViews);
    if (typeof window !== 'undefined') {
      localStorage.setItem(viewsStorageKey, JSON.stringify(nextViews));
    }
    onSavedViewsChange?.(mergeSavedViews(savedViews, nextViews));
  };

  const handleApplySavedView = (view: GridViewPreset<TData>) => {
    setState(prev => {
      const next = applyGridViewSnapshot(
        prev,
        view.state,
        initialColumnDefs.map(c => String(c.field)),
        defaultPageSize
      );
      return { ...next, activeViewId: view.id };
    });
  };

  const handleSaveNewView = (name: string) => {
    const newView: GridViewPreset<TData> = {
      id: `view_${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      builtIn: false,
      state: createGridViewSnapshot(state),
    };
    const nextUserViews = [...userSavedViews, newView];
    persistUserSavedViews(nextUserViews);
    setState(prev => ({ ...prev, activeViewId: newView.id }));
  };

  const handleUpdateSavedView = (viewId: string) => {
    const nextUserViews = userSavedViews.map(v =>
      v.id === viewId ? { ...v, state: createGridViewSnapshot(state) } : v
    );
    persistUserSavedViews(nextUserViews);
    setState(prev => ({ ...prev, activeViewId: viewId }));
  };

  const handleDeleteSavedView = (viewId: string) => {
    const nextUserViews = userSavedViews.filter(v => v.id !== viewId);
    persistUserSavedViews(nextUserViews);
    setState(prev =>
      prev.activeViewId === viewId ? { ...prev, activeViewId: null } : prev
    );
  };

  const handleResetDefaultLayout = () => {
    const defaultWidths = {} as Record<keyof TData & string, string | number>;
    const initialPinnedLeft: (keyof TData & string)[] = [];
    const initialPinnedRight: (keyof TData & string)[] = [];
    const allFields = initialColumnDefs.map(c => c.field);
    initialColumnDefs.forEach(col => {
      defaultWidths[col.field] = col.defaultWidth || `${DEFAULT_COL_WIDTH}px`;
      if (col.pinned === 'left') initialPinnedLeft.push(col.field);
      else if (col.pinned === 'right') initialPinnedRight.push(col.field);
    });
    const unpinnedOrder = allFields.filter(
      f => !initialPinnedLeft.includes(f) && !initialPinnedRight.includes(f)
    );
    setState(prev => ({
      ...prev,
      currentPage: 1,
      pageSize: defaultPageSize,
      sortConfig: null,
      multiSortConfig: [],
      globalFilter: '',
      columnFilters: {},
      visibleColumns: allFields,
      columnOrder: unpinnedOrder,
      columnWidths: defaultWidths,
      pinnedColumns: { left: initialPinnedLeft, right: initialPinnedRight },
      groupedBy: [],
      expandedGroups: new Set(),
      pivotMode,
      pivotColumns,
      pivotValues:
        pivotValues && pivotValues.length > 0
          ? pivotValues
          : deriveDefaultPivotValues(initialColumnDefs),
      floatingFiltersOpen: enableFloatingFilters,
      density,
      formulaColumns: initialFormulaColumns || [],
      activeViewId: null,
      focusedCell: null,
    }));
  };

  // ---- Pivot Table handlers ----
  const handleTogglePivotMode = () => {
    setState(prev => {
      const nextPivotMode = !prev.pivotMode;
      let nextGroupedBy = prev.groupedBy;
      let nextPivotColumns = prev.pivotColumns || [];
      const nextPivotValues =
        prev.pivotValues && prev.pivotValues.length > 0
          ? prev.pivotValues
          : deriveDefaultPivotValues(processedColumnDefs);

      if (nextPivotMode && nextGroupedBy.length === 0 && nextPivotColumns.length === 0) {
        // Seed sensible default Row Group and Pivot Column from categorical columns
        const candidates = processedColumnDefs.filter(
          c =>
            c.groupable !== false &&
            !c.sparkline &&
            c.filterType !== 'number' &&
            !c.aggregate
        );
        if (candidates.length >= 2) {
          // Prefer low-cardinality select columns for pivot headers when available
          const selectCols = candidates.filter(c => c.filterType === 'select');
          if (selectCols.length >= 2) {
            nextGroupedBy = [selectCols[0].field];
            nextPivotColumns = [selectCols[1].field];
          } else if (selectCols.length === 1) {
            const other = candidates.find(c => c.field !== selectCols[0].field)!;
            nextGroupedBy = [other.field];
            nextPivotColumns = [selectCols[0].field];
          } else {
            nextGroupedBy = [candidates[0].field];
            nextPivotColumns = [candidates[1].field];
          }
        } else if (candidates.length === 1) {
          nextGroupedBy = [candidates[0].field];
        }
      }

      return {
        ...prev,
        pivotMode: nextPivotMode,
        groupedBy: nextGroupedBy,
        pivotColumns: nextPivotColumns,
        pivotValues: nextPivotValues,
        sortConfig: null,
        multiSortConfig: [],
        currentPage: 1,
      };
    });
  };

  const handleAddPivotColumn = (field: keyof TData & string) => {
    setState(prev => {
      const current = prev.pivotColumns || [];
      if (current.includes(field)) return prev;
      return {
        ...prev,
        pivotColumns: [...current, field],
        groupedBy: prev.groupedBy.filter(f => f !== field),
        currentPage: 1,
      };
    });
  };

  const handleRemovePivotColumn = (field: keyof TData & string) => {
    setState(prev => ({
      ...prev,
      pivotColumns: (prev.pivotColumns || []).filter(f => f !== field),
      currentPage: 1,
    }));
  };

  const handleAddPivotValue = (field: keyof TData & string, aggregate?: AggregateFunction) => {
    const col = colDefsMap.get(field);
    const defaultAgg: AggregateFunction =
      aggregate ||
      (col?.aggregate
        ? Array.isArray(col.aggregate)
          ? col.aggregate[0]
          : col.aggregate
        : col?.filterType === 'number'
          ? 'sum'
          : 'count');
    setState(prev => {
      const current = prev.pivotValues || [];
      if (current.some(v => v.field === field && v.aggregate === defaultAgg)) return prev;
      return {
        ...prev,
        pivotValues: [...current, { field, aggregate: defaultAgg, headerText: col?.headerText }],
      };
    });
  };

  const handleChangePivotValueAggregate = (index: number, aggregate: AggregateFunction) => {
    setState(prev => {
      const next = [...(prev.pivotValues || [])];
      if (!next[index]) return prev;
      next[index] = { ...next[index], aggregate };
      return { ...prev, pivotValues: next };
    });
  };

  const handleRemovePivotValue = (index: number) => {
    setState(prev => {
      const next = (prev.pivotValues || []).filter((_, i) => i !== index);
      return { ...prev, pivotValues: next };
    });
  };


  const startEditingCell = (rowId: string | number, field: keyof TData & string) => {
    if (isPivotActive) return;
    const columnDef = processedColumnDefs.find(col => col.field === field);
    const row = baseDataForProcessing.find(r => r.id === rowId);
    if (columnDef?.editable && row) {
      setState(prevState => ({
        ...prevState,
        editingCell: { rowId, field },
        editInputValue: getCellValue(row, field),
        focusedCell: { rowId, colField: field }, 
      }));
    }
  };

  const handleCellClick = (rowId: string | number, field: keyof TData & string) => {
    setState(prevState => ({ ...prevState, focusedCell: { rowId, colField: field }}));
  };


  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState(prevState => ({ ...prevState, editInputValue: e.target.value }));
  };

  // Central commit path for every grid-driven edit (inline, paste, fill). Captures
  // prior values so undo can restore them, then hands each cell to onCellEdit — the
  // parent stays the data owner.
  type PendingEdit = { rowId: string | number; field: keyof TData & string; value: any };
  const applyEdits = (edits: PendingEdit[]) => {
    if (!onCellEdit || edits.length === 0) return;
    const rowById = new Map(baseDataForProcessing.map(r => [r.id, r]));
    const batch: EditRecord[] = [];
    edits.forEach(edit => {
      const row = rowById.get(edit.rowId);
      const prevValue = row ? getCellValue(row, edit.field) : undefined;
      if (prevValue === edit.value) return; // no-ops don't pollute undo history
      batch.push({ rowId: edit.rowId, field: edit.field, prevValue, nextValue: edit.value });
    });
    if (batch.length === 0) return;
    batch.forEach(e => onCellEdit(e.rowId, e.field, e.nextValue));
    if (undoRedoEnabled) {
      undoStackRef.current.push(batch);
      if (undoStackRef.current.length > 100) undoStackRef.current.shift();
      redoStackRef.current = [];
    }
  };

  const handleUndo = () => {
    const batch = undoStackRef.current.pop();
    if (!batch || !onCellEdit) return;
    [...batch].reverse().forEach(e => onCellEdit(e.rowId, e.field, e.prevValue));
    redoStackRef.current.push(batch);
  };

  const handleRedo = () => {
    const batch = redoStackRef.current.pop();
    if (!batch || !onCellEdit) return;
    batch.forEach(e => onCellEdit(e.rowId, e.field, e.nextValue));
    undoStackRef.current.push(batch);
  };

  // Mirrors the inline-edit coercion: numeric columns take numbers only. Returns
  // undefined when the raw value can't be coerced — callers skip that cell.
  const coerceValueForCell = (rowId: string | number, field: keyof TData & string, raw: any): any => {
    const columnDef = colDefsMap.get(field);
    const originalRowData = baseDataForProcessing.find(r => r.id === rowId)?.originalRow;
    const isNumericColumn = columnDef?.filterType === 'number' || (originalRowData && typeof originalRowData[field] === 'number');
    if (isNumericColumn) {
      const num = toStrictNumber(raw);
      return num === null ? undefined : num;
    }
    return raw;
  };

  const handleEditCommit = () => {
    if (state.editingCell && onCellEdit) {
      const { rowId, field } = state.editingCell;
      let valueToCommit = state.editInputValue;
      const columnDef = processedColumnDefs.find(col => col.field === field);
      const originalRowData = baseDataForProcessing.find(r => r.id === rowId)?.originalRow;

      if (columnDef?.filterType === 'number' || (originalRowData && typeof originalRowData[field] === 'number')) {
        valueToCommit = parseFloat(state.editInputValue);
        if (isNaN(valueToCommit) && originalRowData) {
          valueToCommit = getCellValue({originalRow: originalRowData} as ProcessedRow<TData>, field);
        }
      }
      applyEdits([{ rowId, field, value: valueToCommit }]);
    }
    setState(prevState => ({ ...prevState, editingCell: null, editInputValue: '' }));
  };

  const handleEditCancel = () => {
    setState(prevState => ({ ...prevState, editingCell: null, editInputValue: '' }));
  };

  const handleEditInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleEditCancel();
    }
  };

  // Callers routinely pass globalFilterFields as an inline literal; key the memo on
  // its content so a fresh-but-equal array can't cascade new identities through
  // filteredData/sortedData (which feeds onFilteredDataChange and can loop a parent
  // that setStates in response).
  const globalFilterFieldsKey = globalFilterFields?.join('\u0000');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableGlobalFilterFields = React.useMemo(() => globalFilterFields, [globalFilterFieldsKey]);

  const filteredData = React.useMemo(() => {
    if (serverSide) return baseDataForProcessing;
    return filterRows({
      rows: baseDataForProcessing,
      columns: processedColumnDefs,
      visibleColumns: state.visibleColumns,
      globalFilter: state.globalFilter,
      globalFilterFields: stableGlobalFilterFields,
      columnFilters: state.columnFilters,
    });
  }, [serverSide, baseDataForProcessing, state.globalFilter, state.columnFilters, processedColumnDefs, state.visibleColumns, stableGlobalFilterFields]);

  const activeSortConfigs = React.useMemo(
    () =>
      state.multiSortConfig && state.multiSortConfig.length > 0
        ? state.multiSortConfig
        : state.sortConfig
          ? [state.sortConfig]
          : null,
    [state.multiSortConfig, state.sortConfig]
  );

  // Build pivot table when Pivot Mode is active
  const pivotTableResult = React.useMemo(() => {
    if (!isPivotActive) return null;
    return buildPivotTable({
      rows: filteredData,
      columns: processedColumnDefs,
      rowGroupFields: state.groupedBy,
      pivotFields: state.pivotColumns || [],
      valueConfigs: state.pivotValues,
      showRowTotals: true,
    });
  }, [isPivotActive, filteredData, processedColumnDefs, state.groupedBy, state.pivotColumns, state.pivotValues]);

  const activeColDefsMap = React.useMemo(() => {
    if (isPivotActive && pivotTableResult) {
      return new Map(pivotTableResult.columns.map(col => [col.field, col]));
    }
    return colDefsMap;
  }, [isPivotActive, pivotTableResult, colDefsMap]);

  const sortedData = React.useMemo(() => {
    if (isPivotActive && pivotTableResult) {
      return sortRows(pivotTableResult.rows, activeColDefsMap, activeSortConfigs, [], false);
    }
    if (serverSide) return filteredData;
    return sortRows(filteredData, colDefsMap, activeSortConfigs, state.groupedBy, isTreeData);
  }, [isPivotActive, pivotTableResult, activeColDefsMap, serverSide, filteredData, activeSortConfigs, state.groupedBy, colDefsMap, isTreeData]);

  const onServerParamsChangeRef = React.useRef(onServerParamsChange);
  onServerParamsChangeRef.current = onServerParamsChange;

  React.useEffect(() => {
    if (!serverSide) return;
    onServerParamsChangeRef.current?.({
      page: state.currentPage,
      pageSize: state.pageSize,
      sortConfig: state.sortConfig,
      multiSortConfig: state.multiSortConfig,
      columnFilters: state.columnFilters,
      globalFilter: state.globalFilter,
    });
  }, [serverSide, state.currentPage, state.pageSize, state.sortConfig, state.multiSortConfig, state.columnFilters, state.globalFilter]);

  // Report the filtered+sorted rows to the host (for external summaries/KPIs).
  // The callback is kept in a ref so an unstable function identity doesn't re-fire the effect.
  const onFilteredDataChangeRef = React.useRef(onFilteredDataChange);
  onFilteredDataChangeRef.current = onFilteredDataChange;
  // Skip the emit when the row set is unchanged element-for-element: a parent that
  // setStates in its callback re-renders us, and re-emitting an equal list would
  // ping-pong forever (and clear transient state like range selections).
  const lastEmittedRowsRef = React.useRef<TData[] | null>(null);
  React.useEffect(() => {
    if (isPivotActive) return;
    const rows = sortedData.filter(r => !r.isGroupHeader).map(r => r.originalRow);
    const last = lastEmittedRowsRef.current;
    if (last && last.length === rows.length && last.every((r, i) => r === rows[i])) return;
    lastEmittedRowsRef.current = rows;
    onFilteredDataChangeRef.current?.(rows);
  }, [sortedData, isPivotActive]);

  const dataWithGroupHeaders = React.useMemo(() => {
    if (isPivotActive || state.groupedBy.length === 0 || isTreeData) { 
      return sortedData;
    }

    const buildGroupedRows = (
      rows: ProcessedRow<TData>[],
      groupIndex: number,
      parentGroupKey: string,
      currentLevel: number
    ): ProcessedRow<TData>[] => {
      if (groupIndex >= state.groupedBy.length) {
        return rows;
      }

      const groupField = state.groupedBy[groupIndex];
      const result: ProcessedRow<TData>[] = [];

      let currentVal: any = undefined;
      let currentItems: ProcessedRow<TData>[] = [];

      const addGroup = (val: any, items: ProcessedRow<TData>[]) => {
        const groupValueStr = String(val);
        const groupKey = parentGroupKey ? `${parentGroupKey}|${String(groupField)}:${groupValueStr}` : `${String(groupField)}:${groupValueStr}`;
        
        const subGroupedItems = buildGroupedRows(items, groupIndex + 1, groupKey, currentLevel + 1);

        const groupHeaderRow: ProcessedRow<TData> = {
          id: `group-header-${groupKey}`,
          originalRow: {} as TData,
          level: currentLevel,
          hasChildren: true,
          isGroupHeader: true,
          groupField: groupField,
          groupValue: val,
          groupKey: groupKey,
          groupItems: items, 
          isExpanded: state.expandedGroups.has(groupKey),
        } as ProcessedRow<TData>;

        result.push(groupHeaderRow);

        if (state.expandedGroups.has(groupKey)) {
          result.push(...subGroupedItems);
        }
      };

      rows.forEach((row, index) => {
        const rowVal = getCellValue(row, groupField);
        if (index === 0 || rowVal !== currentVal) {
          if (currentItems.length > 0) {
            addGroup(currentVal, currentItems);
          }
          currentVal = rowVal;
          currentItems = [row];
        } else {
          currentItems.push(row);
        }
      });

      if (currentItems.length > 0) {
        addGroup(currentVal, currentItems);
      }

      return result;
    };

    return buildGroupedRows(sortedData, 0, "", 0);
  }, [isPivotActive, sortedData, state.groupedBy, state.expandedGroups, isTreeData]);


  const dataToPaginate = React.useMemo(() => {
    return !isPivotActive && state.groupedBy.length > 0 && !isTreeData ? dataWithGroupHeaders : sortedData;
  }, [isPivotActive, dataWithGroupHeaders, sortedData, state.groupedBy, isTreeData]);

  const paginatedData = React.useMemo(() => {
    if (virtualized || serverSide) {
      return dataToPaginate;
    }
    const startIndex = (state.currentPage - 1) * state.pageSize;
    return dataToPaginate.slice(startIndex, startIndex + state.pageSize);
  }, [dataToPaginate, state.currentPage, state.pageSize, virtualized, serverSide]);

  const totalPages = serverSide
    ? Math.max(1, Math.ceil((totalRowCount ?? (initialData?.length || 0)) / state.pageSize))
    : Math.ceil(dataToPaginate.length / state.pageSize);

  // The display list interleaves a synthetic detail entry after each expanded master
  // row. dataIndex always points back at the row's position in paginatedData so range
  // selection and keyboard navigation are unaffected by open detail panels.
  type DisplayRow = { row: ProcessedRow<TData>; isDetail: boolean; dataIndex: number };
  const displayRows = React.useMemo<DisplayRow[]>(() => {
    if (!masterDetail || expandedDetails.size === 0) {
      return paginatedData.map((row, i) => ({ row, isDetail: false, dataIndex: i }));
    }
    const out: DisplayRow[] = [];
    paginatedData.forEach((row, i) => {
      out.push({ row, isDetail: false, dataIndex: i });
      if (!row.isGroupHeader && expandedDetails.has(row.id)) {
        out.push({ row, isDetail: true, dataIndex: i });
      }
    });
    return out;
  }, [paginatedData, masterDetail, expandedDetails]);

  const columnBoundsMap = React.useMemo(() => {
    const bounds: Record<string, DerivedColumnBounds> = {};
    processedColumnDefs.forEach(col => {
      bounds[col.field] = computeColumnBounds(baseDataForProcessing, col.field);
    });
    return bounds;
  }, [processedColumnDefs, baseDataForProcessing]);

  // Prefix-sum row offsets make the window math exact even though detail panels
  // are taller than data rows. offsets[i] is the top of display row i.
  const rowOffsets = React.useMemo(() => {
    if (!virtualized) return null;
    const offsets = new Array<number>(displayRows.length + 1);
    offsets[0] = 0;
    for (let i = 0; i < displayRows.length; i++) {
      offsets[i + 1] = offsets[i] + (displayRows[i].isDetail ? detailRowHeight : effectiveRowHeight);
    }
    return offsets;
  }, [virtualized, displayRows, effectiveRowHeight, detailRowHeight]);

  const { visibleDisplayRows, topSpacer, bottomSpacer } = React.useMemo(() => {
    if (!virtualized || !rowOffsets) {
      return { visibleDisplayRows: displayRows, topSpacer: 0, bottomSpacer: 0 };
    }
    const viewportHeight = scrollContainerRef.current?.clientHeight || virtualizedMaxHeight;
    // Binary search for the first row whose bottom edge is below the viewport top.
    let lo = 0;
    let hi = displayRows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rowOffsets[mid + 1] > scrollTop) hi = mid; else lo = mid + 1;
    }
    const buffer = 5;
    let eIdx = lo;
    while (eIdx < displayRows.length && rowOffsets[eIdx] < scrollTop + viewportHeight) eIdx++;
    const sIdx = Math.max(0, lo - buffer);
    eIdx = Math.min(displayRows.length, eIdx + buffer);
    return {
      visibleDisplayRows: displayRows.slice(sIdx, eIdx),
      topSpacer: rowOffsets[sIdx],
      bottomSpacer: rowOffsets[displayRows.length] - rowOffsets[eIdx],
    };
  }, [virtualized, rowOffsets, displayRows, scrollTop, virtualizedMaxHeight]);


  const orderedVisibleColumnDefs = React.useMemo(() => {
    if (isPivotActive && pivotTableResult) {
      return pivotTableResult.columns;
    }

    const leftPinned = state.pinnedColumns.left
      .map(field => colDefsMap.get(field)!)
      .filter(col => col && state.visibleColumns.includes(col.field));

    const rightPinned = state.pinnedColumns.right
      .map(field => colDefsMap.get(field)!)
      .filter(col => col && state.visibleColumns.includes(col.field));

    const scrollable = state.columnOrder
      .map(field => colDefsMap.get(field)!)
      .filter(col => col && state.visibleColumns.includes(col.field) && !state.pinnedColumns.left.includes(col.field) && !state.pinnedColumns.right.includes(col.field));

    return [...leftPinned, ...scrollable, ...rightPinned];
  }, [isPivotActive, pivotTableResult, colDefsMap, state.columnOrder, state.visibleColumns, state.pinnedColumns]);

  const effectivePinnedLeft = React.useMemo(() => {
    if (isPivotActive && pivotTableResult) {
      return pivotTableResult.columns.filter(c => c.pinned === 'left').map(c => c.field);
    }
    return state.pinnedColumns.left;
  }, [isPivotActive, pivotTableResult, state.pinnedColumns.left]);

  const effectivePinnedRight = React.useMemo(() => {
    if (isPivotActive && pivotTableResult) {
      return pivotTableResult.columns.filter(c => c.pinned === 'right').map(c => c.field);
    }
    return state.pinnedColumns.right;
  }, [isPivotActive, pivotTableResult, state.pinnedColumns.right]);

  const getColumnWidth = React.useCallback((field: keyof TData & string): number => {
    const width = state.columnWidths[field] || activeColDefsMap.get(field)?.defaultWidth || DEFAULT_COL_WIDTH;
    return typeof width === 'number' ? width : parseInt(String(width), 10) || DEFAULT_COL_WIDTH;
  }, [state.columnWidths, activeColDefsMap]);

  const stickyOffsets = React.useMemo(() => {
    const left: Record<string, number> = {};
    let currentLeftOffset = 0;
    if (rowReorderEnabled) {
        currentLeftOffset += 32; // drag-handle column
    }
    if (enableRowSelection) {
        currentLeftOffset += 50;
    }
    if (masterDetail) {
        currentLeftOffset += 40; // detail expander column
    }
    effectivePinnedLeft.forEach(field => {
      if (isPivotActive || state.visibleColumns.includes(field)) {
        left[field] = currentLeftOffset;
        currentLeftOffset += getColumnWidth(field);
      }
    });

    const right: Record<string, number> = {};
    let currentRightOffset = 0;
    effectivePinnedRight.slice().reverse().forEach(field => {
       if (isPivotActive || state.visibleColumns.includes(field)) {
        right[field] = currentRightOffset;
        currentRightOffset += getColumnWidth(field);
      }
    });
    return { left, right, totalLeftWidth: currentLeftOffset, totalRightWidth: currentRightOffset };
  }, [isPivotActive, effectivePinnedLeft, effectivePinnedRight, state.visibleColumns, getColumnWidth, enableRowSelection, masterDetail, rowReorderEnabled]);

  const isAllCurrentPageRowsSelected = paginatedData.length > 0 && paginatedData.filter(r => !r.isGroupHeader).every(row => state.selectedRows.has(row.id));

  const rangeBounds = React.useMemo(() => {
    if (!rangeAnchor || !rangeEnd) return null;
    return {
      top: Math.min(rangeAnchor.rowIndex, rangeEnd.rowIndex),
      bottom: Math.max(rangeAnchor.rowIndex, rangeEnd.rowIndex),
      left: Math.min(rangeAnchor.colIndex, rangeEnd.colIndex),
      right: Math.max(rangeAnchor.colIndex, rangeEnd.colIndex),
    };
  }, [rangeAnchor, rangeEnd]);

  const isCellInRange = (dataIndex: number, colIndex: number): boolean =>
    !!rangeBounds &&
    dataIndex >= rangeBounds.top && dataIndex <= rangeBounds.bottom &&
    colIndex >= rangeBounds.left && colIndex <= rangeBounds.right;

  // Any change to the underlying display list shifts row indices, so an existing
  // range would silently point at different cells — drop it instead. Keyed on the
  // row id sequence, not array identity: a re-render that reproduces the same rows
  // (e.g. a parent setState from onFilteredDataChange) must not clear the range.
  const paginatedRowIdsKey = React.useMemo(
    () => paginatedData.map(r => r.id).join('\u0000'),
    [paginatedData]
  );
  const prevRowIdsKeyRef = React.useRef(paginatedRowIdsKey);
  React.useEffect(() => {
    if (prevRowIdsKeyRef.current === paginatedRowIdsKey) return;
    prevRowIdsKeyRef.current = paginatedRowIdsKey;
    setRangeAnchor(null);
    setRangeEnd(null);
  }, [paginatedRowIdsKey]);

  const handleCellMouseDown = (e: React.MouseEvent, dataIndex: number, colIndex: number) => {
    if (!enableRangeSelection || e.button !== 0 || state.editingCell) return;
    // Let buttons, links, and inputs inside cells behave normally.
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [role="checkbox"]')) return;
    e.preventDefault();
    if (e.shiftKey && rangeAnchor) {
      setRangeEnd({ rowIndex: dataIndex, colIndex });
    } else {
      // The anchor cell becomes the active cell. Set focus here rather than relying
      // on the click event — a drag that ends on another cell never fires click.
      const row = paginatedData[dataIndex];
      const colDef = orderedVisibleColumnDefs[colIndex];
      if (row && !row.isGroupHeader && colDef) {
        setState(prev => ({ ...prev, focusedCell: { rowId: row.id, colField: colDef.field } }));
      }
      setRangeAnchor({ rowIndex: dataIndex, colIndex });
      setRangeEnd({ rowIndex: dataIndex, colIndex });
      setIsDraggingRange(true);
    }
  };

  const handleCellMouseEnter = (dataIndex: number, colIndex: number) => {
    if (isFilling) {
      setFillEnd({ rowIndex: dataIndex, colIndex });
      return;
    }
    if (isDraggingRange) {
      setRangeEnd({ rowIndex: dataIndex, colIndex });
    }
  };

  React.useEffect(() => {
    if (!isDraggingRange) return;
    const onMouseUp = () => setIsDraggingRange(false);
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [isDraggingRange]);

  // The rectangle the fill will extend into. Vertical extension wins over horizontal
  // when the pointer is diagonal, matching Excel.
  const fillZone = React.useMemo(() => {
    if (!isFilling || !fillEnd || !rangeBounds) return null;
    const { top, bottom, left, right } = rangeBounds;
    if (fillEnd.rowIndex > bottom) return { top: bottom + 1, bottom: fillEnd.rowIndex, left, right, direction: 'down' as const };
    if (fillEnd.rowIndex < top) return { top: fillEnd.rowIndex, bottom: top - 1, left, right, direction: 'up' as const };
    if (fillEnd.colIndex > right) return { top, bottom, left: right + 1, right: fillEnd.colIndex, direction: 'right' as const };
    if (fillEnd.colIndex < left) return { top, bottom, left: fillEnd.colIndex, right: left - 1, direction: 'left' as const };
    return null;
  }, [isFilling, fillEnd, rangeBounds]);

  const isCellInFillZone = (dataIndex: number, colIndex: number): boolean =>
    !!fillZone &&
    dataIndex >= fillZone.top && dataIndex <= fillZone.bottom &&
    colIndex >= fillZone.left && colIndex <= fillZone.right;

  const handleFillMouseDown = (e: React.MouseEvent) => {
    if (!fillHandleEnabled || !rangeBounds || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsFilling(true);
    setFillEnd(null);
  };

  const applyFill = () => {
    if (!fillZone || !rangeBounds || !onCellEdit) return;
    const edits: PendingEdit[] = [];
    const cols = orderedVisibleColumnDefs;

    if (fillZone.direction === 'down' || fillZone.direction === 'up') {
      for (let c = fillZone.left; c <= fillZone.right; c++) {
        const colDef = cols[c];
        if (!colDef?.editable) continue;
        const sourceRows: ProcessedRow<TData>[] = [];
        for (let r = rangeBounds.top; r <= rangeBounds.bottom; r++) {
          const row = paginatedData[r];
          if (row && !row.isGroupHeader) sourceRows.push(row);
        }
        if (sourceRows.length === 0) continue;
        let source = sourceRows.map(row => getCellValue(row, colDef.field));
        const targetIndices: number[] = [];
        if (fillZone.direction === 'down') {
          for (let r = fillZone.top; r <= fillZone.bottom; r++) targetIndices.push(r);
        } else {
          for (let r = fillZone.bottom; r >= fillZone.top; r--) targetIndices.push(r);
          source = [...source].reverse();
        }
        const values = computeFillValues(source, targetIndices.length);
        targetIndices.forEach((r, i) => {
          const row = paginatedData[r];
          if (!row || row.isGroupHeader) return;
          const value = coerceValueForCell(row.id, colDef.field, values[i]);
          if (value !== undefined) edits.push({ rowId: row.id, field: colDef.field, value });
        });
      }
    } else {
      for (let r = fillZone.top; r <= fillZone.bottom; r++) {
        const row = paginatedData[r];
        if (!row || row.isGroupHeader) continue;
        let source: any[] = [];
        for (let c = rangeBounds.left; c <= rangeBounds.right; c++) {
          const colDef = cols[c];
          if (colDef) source.push(getCellValue(row, colDef.field));
        }
        if (source.length === 0) continue;
        const targetCols: number[] = [];
        if (fillZone.direction === 'right') {
          for (let c = fillZone.left; c <= fillZone.right; c++) targetCols.push(c);
        } else {
          for (let c = fillZone.right; c >= fillZone.left; c--) targetCols.push(c);
          source = [...source].reverse();
        }
        const values = computeFillValues(source, targetCols.length);
        targetCols.forEach((c, i) => {
          const colDef = cols[c];
          if (!colDef?.editable) return;
          const value = coerceValueForCell(row.id, colDef.field, values[i]);
          if (value !== undefined) edits.push({ rowId: row.id, field: colDef.field, value });
        });
      }
    }
    applyEdits(edits);
  };

  // Keep the latest applyFill reachable from the one-shot document mouseup listener
  // without re-subscribing on every pointer move.
  const applyFillRef = React.useRef(applyFill);
  applyFillRef.current = applyFill;
  React.useEffect(() => {
    if (!isFilling) return;
    const onMouseUp = () => {
      applyFillRef.current();
      setIsFilling(false);
      setFillEnd(null);
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [isFilling]);

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!pasteEnabled || state.editingCell) return;
    // Pastes aimed at real inputs (global search, filters, editors) stay theirs.
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
    const matrix = parseClipboardText(e.clipboardData.getData('text/plain'));
    if (matrix.length === 0) return;

    let startRow: number;
    let startCol: number;
    if (rangeBounds) {
      startRow = rangeBounds.top;
      startCol = rangeBounds.left;
    } else if (state.focusedCell) {
      startRow = paginatedData.findIndex(r => r.id === state.focusedCell!.rowId);
      startCol = orderedVisibleColumnDefs.findIndex(c => c.field === state.focusedCell!.colField);
    } else {
      return;
    }
    if (startRow < 0 || startCol < 0) return;
    e.preventDefault();

    const edits: PendingEdit[] = [];
    const isSingleValue = matrix.length === 1 && matrix[0].length === 1;
    if (isSingleValue && rangeBounds) {
      // One copied cell fills the whole selected range (Excel behavior).
      for (let r = rangeBounds.top; r <= rangeBounds.bottom; r++) {
        const row = paginatedData[r];
        if (!row || row.isGroupHeader) continue;
        for (let c = rangeBounds.left; c <= rangeBounds.right; c++) {
          const colDef = orderedVisibleColumnDefs[c];
          if (!colDef?.editable) continue;
          const value = coerceValueForCell(row.id, colDef.field, matrix[0][0]);
          if (value !== undefined) edits.push({ rowId: row.id, field: colDef.field, value });
        }
      }
    } else {
      // The matrix maps cell-per-cell from the anchor; group header rows are skipped
      // without consuming a matrix row.
      let matrixRow = 0;
      for (let r = startRow; r < paginatedData.length && matrixRow < matrix.length; r++) {
        const row = paginatedData[r];
        if (!row || row.isGroupHeader) continue;
        const rowValues = matrix[matrixRow++];
        for (let j = 0; j < rowValues.length; j++) {
          const colDef = orderedVisibleColumnDefs[startCol + j];
          if (!colDef?.editable) continue;
          const value = coerceValueForCell(row.id, colDef.field, rowValues[j]);
          if (value !== undefined) edits.push({ rowId: row.id, field: colDef.field, value });
        }
      }
    }
    applyEdits(edits);
  };

  // ---- Find-in-grid ----
  const findMatches = React.useMemo(
    () => (findOpen && enableFind ? findCellMatches(dataToPaginate, orderedVisibleColumnDefs, findQuery) : []),
    [findOpen, enableFind, findQuery, dataToPaginate, orderedVisibleColumnDefs]
  );
  const activeMatch = findMatches.length > 0 ? findMatches[Math.min(findActiveIdx, findMatches.length - 1)] : null;
  const findMatchSet = React.useMemo(
    () => new Set(findMatches.map(m => `${m.rowId}|${m.field}`)),
    [findMatches]
  );

  const goToMatch = (idx: number) => {
    if (findMatches.length === 0) return;
    const wrapped = ((idx % findMatches.length) + findMatches.length) % findMatches.length;
    setFindActiveIdx(wrapped);
    const match = findMatches[wrapped];
    setState(prev => ({
      ...prev,
      currentPage: virtualized ? prev.currentPage : Math.floor(match.rowIndex / prev.pageSize) + 1,
      focusedCell: { rowId: match.rowId, colField: match.field as keyof TData & string },
    }));
    // Virtualization windows unrendered rows out, so scrollIntoView can't reach them —
    // jump the scroll container to the match's computed offset instead.
    if (virtualized && rowOffsets && scrollContainerRef.current) {
      const displayIdx = displayRows.findIndex(d => !d.isDetail && d.dataIndex === match.rowIndex);
      if (displayIdx >= 0) {
        scrollContainerRef.current.scrollTop = Math.max(0, rowOffsets[displayIdx] - virtualizedMaxHeight / 2);
      }
    }
  };

  // First Enter lands on the first match; subsequent ones advance. The ref resets
  // whenever the query changes so a new search starts from the top again.
  const findNavigatedRef = React.useRef(false);
  const handleFindNext = () => {
    if (findMatches.length === 0) return;
    if (!findNavigatedRef.current) {
      findNavigatedRef.current = true;
      goToMatch(findActiveIdx);
    } else {
      goToMatch(findActiveIdx + 1);
    }
  };
  const handleFindPrevious = () => {
    if (findMatches.length === 0) return;
    if (!findNavigatedRef.current) {
      findNavigatedRef.current = true;
      goToMatch(findActiveIdx);
    } else {
      goToMatch(findActiveIdx - 1);
    }
  };

  const handleFindQueryChange = (query: string) => {
    setFindQuery(query);
    setFindActiveIdx(0);
    findNavigatedRef.current = false;
  };

  const closeFindBar = () => {
    setFindOpen(false);
    findNavigatedRef.current = false;
    tableWrapperRef.current?.focus();
  };

  // ---- Row drag-and-drop reorder ----
  // Reordering only means something in the data's own order: sorting or grouping
  // would immediately re-sort whatever the user dropped, so the handle deactivates.
  const rowReorderActive = rowReorderEnabled && !activeSortConfigs && state.groupedBy.length === 0;

  const handleRowDragStart = (e: React.DragEvent, rowId: string | number) => {
    e.dataTransfer.setData('text/plain', String(rowId));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedRowId(rowId);
  };

  const handleRowDragOver = (e: React.DragEvent, targetRowId: string | number) => {
    if (draggedRowId === null || draggedRowId === targetRowId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    setRowDropTarget(prev =>
      prev?.rowId === targetRowId && prev.position === position ? prev : { rowId: targetRowId, position }
    );
  };

  const handleRowDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedRowId !== null && rowDropTarget && onRowsReordered && draggedRowId !== rowDropTarget.rowId) {
      const items = [...(initialData || [])];
      const fromIdx = items.findIndex(item => item.id === draggedRowId);
      if (fromIdx >= 0) {
        const [moved] = items.splice(fromIdx, 1);
        const targetIdx = items.findIndex(item => item.id === rowDropTarget.rowId);
        if (targetIdx >= 0) {
          items.splice(rowDropTarget.position === 'above' ? targetIdx : targetIdx + 1, 0, moved);
          onRowsReordered(items);
        }
      }
    }
    setDraggedRowId(null);
    setRowDropTarget(null);
  };

  const handleRowDragEnd = () => {
    setDraggedRowId(null);
    setRowDropTarget(null);
  };

  // ---- Status bar range statistics ----
  const rangeCellCount = rangeBounds
    ? (rangeBounds.bottom - rangeBounds.top + 1) * (rangeBounds.right - rangeBounds.left + 1)
    : 0;
  const rangeStats = React.useMemo(() => {
    if (!enableStatusBar || !rangeBounds) return null;
    const values: any[] = [];
    for (let r = rangeBounds.top; r <= rangeBounds.bottom; r++) {
      const row = paginatedData[r];
      if (!row || row.isGroupHeader) continue;
      for (let c = rangeBounds.left; c <= rangeBounds.right; c++) {
        const colDef = orderedVisibleColumnDefs[c];
        if (colDef) values.push(getCellValue(row, colDef.field));
      }
    }
    return computeRangeStats(values);
  }, [enableStatusBar, rangeBounds, paginatedData, orderedVisibleColumnDefs]);

  // ---- Column header groups ----
  // Spans are built per sticky region so a group can never straddle a pinned
  // boundary; pinned spans reuse the offset of their first (left) / last (right) column.
  const hasHeaderGroups = orderedVisibleColumnDefs.some(c => c.group);
  const headerGroupSpans = React.useMemo(() => {
    if (!hasHeaderGroups) return null;
    const leftCount = orderedVisibleColumnDefs.filter(c => effectivePinnedLeft.includes(c.field)).length;
    const rightCount = orderedVisibleColumnDefs.filter(c => effectivePinnedRight.includes(c.field)).length;
    return {
      left: buildHeaderGroupSpans(orderedVisibleColumnDefs.slice(0, leftCount)),
      middle: buildHeaderGroupSpans(orderedVisibleColumnDefs.slice(leftCount, orderedVisibleColumnDefs.length - rightCount)),
      right: buildHeaderGroupSpans(orderedVisibleColumnDefs.slice(orderedVisibleColumnDefs.length - rightCount)),
    };
  }, [hasHeaderGroups, orderedVisibleColumnDefs, effectivePinnedLeft, effectivePinnedRight]);

  // Copy precedence: a multi-cell range wins, then checkbox-selected rows (always
  // with a header row, matching pre-range behavior), then the focused cell.
  const buildCopyText = (withHeaders: boolean): string => {
    const isMultiCellRange = !!rangeBounds && (rangeBounds.bottom > rangeBounds.top || rangeBounds.right > rangeBounds.left);
    if (rangeBounds && (isMultiCellRange || withHeaders)) {
      const rangeCols = orderedVisibleColumnDefs.slice(rangeBounds.left, rangeBounds.right + 1);
      const lines: string[] = [];
      if (withHeaders) lines.push(rangeCols.map(c => c.headerText).join('\t'));
      for (let r = rangeBounds.top; r <= rangeBounds.bottom; r++) {
        const row = paginatedData[r];
        if (!row || row.isGroupHeader) continue;
        lines.push(rangeCols.map(c => String(getCellValue(row, c.field) ?? '')).join('\t'));
      }
      return lines.join('\n');
    }
    const selectedProcessedRows = sortedData.filter(r => !r.isGroupHeader && state.selectedRows.has(r.id));
    if (selectedProcessedRows.length > 0) {
      const header = orderedVisibleColumnDefs.map(c => c.headerText).join('\t');
      const rows = selectedProcessedRows.map(r =>
        orderedVisibleColumnDefs.map(c => String(getCellValue(r, c.field) ?? '')).join('\t')
      );
      return [header, ...rows].join('\n');
    }
    if (state.focusedCell) {
      const focusedRow = paginatedData.find(r => r.id === state.focusedCell!.rowId);
      if (focusedRow) return String(getCellValue(focusedRow, state.focusedCell.colField) ?? '');
    }
    return '';
  };

  const copySelectionToClipboard = (withHeaders: boolean) => {
    const text = buildCopyText(withHeaders);
    if (text) navigator.clipboard?.writeText(text);
  };

  const handleCellContextMenu = (e: React.MouseEvent, dataIndex: number, colIndex: number, rowId: string | number, colField: keyof TData & string) => {
    if (!enableContextMenu) return;
    e.preventDefault();
    setState(prev => ({ ...prev, focusedCell: { rowId, colField } }));
    if (enableRangeSelection && !isCellInRange(dataIndex, colIndex)) {
      setRangeAnchor({ rowIndex: dataIndex, colIndex });
      setRangeEnd({ rowIndex: dataIndex, colIndex });
    }
    setContextMenu({ x: e.clientX, y: e.clientY, rowId, colField });
  };

  const contextMenuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!contextMenu) return;
    const closeUnlessInside = (e: Event) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    const close = () => setContextMenu(null);
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', closeUnlessInside);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', closeUnlessInside, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', closeUnlessInside);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', closeUnlessInside, true);
      window.removeEventListener('resize', close);
    };
  }, [contextMenu]);


  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      !state.editingCell &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !state.editingCell) {
      const textToCopy = buildCopyText(false);
      if (textToCopy) {
        e.preventDefault();
        navigator.clipboard?.writeText(textToCopy);
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !state.editingCell) {
      const key = e.key.toLowerCase();
      if (undoRedoEnabled && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (undoRedoEnabled && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (enableFind && key === 'f') {
        e.preventDefault();
        setFindOpen(true);
        return;
      }
    }

    if (enableRangeSelection && e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && state.focusedCell && !state.editingCell) {
      const focusedRowIndex = paginatedData.findIndex(r => r.id === state.focusedCell!.rowId);
      const focusedColIndex = orderedVisibleColumnDefs.findIndex(c => c.field === state.focusedCell!.colField);
      if (focusedRowIndex >= 0 && focusedColIndex >= 0) {
        e.preventDefault();
        const anchor = rangeAnchor ?? { rowIndex: focusedRowIndex, colIndex: focusedColIndex };
        const end = rangeEnd ?? anchor;
        let { rowIndex, colIndex } = end;
        if (e.key === 'ArrowUp') rowIndex = Math.max(0, rowIndex - 1);
        if (e.key === 'ArrowDown') rowIndex = Math.min(paginatedData.length - 1, rowIndex + 1);
        if (e.key === 'ArrowLeft') colIndex = Math.max(0, colIndex - 1);
        if (e.key === 'ArrowRight') colIndex = Math.min(orderedVisibleColumnDefs.length - 1, colIndex + 1);
        setRangeAnchor(anchor);
        setRangeEnd({ rowIndex, colIndex });
        return;
      }
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !e.shiftKey && (rangeAnchor || rangeEnd)) {
      setRangeAnchor(null);
      setRangeEnd(null);
    }

    if (!state.focusedCell && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const firstFocusableRow = paginatedData.find(r => !r.isGroupHeader);
      if (firstFocusableRow && orderedVisibleColumnDefs.length > 0) {
        if (e.key === 'Enter' || e.key === 'F2' || e.key === ' ') {
            setState(prev => ({ ...prev, focusedCell: { rowId: firstFocusableRow.id, colField: orderedVisibleColumnDefs[0].field } }));
        }
      } else {
          return; 
      }
    }

    const { focusedCell } = state;
    if (state.editingCell && e.key === 'Escape') {
        e.preventDefault();
        handleEditCancel();
        return;
    }
    if (state.editingCell) return; 

    let nextRowId: string | number | undefined = focusedCell?.rowId;
    let nextColField: (keyof TData & string) | undefined = focusedCell?.colField;

    const currentRowIndex = paginatedData.findIndex(row => row.id === focusedCell?.rowId);
    const currentColIndex = orderedVisibleColumnDefs.findIndex(col => col.field === focusedCell?.colField);

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (currentRowIndex > 0) {
          let prevIndex = currentRowIndex - 1;
          while(prevIndex >=0 && paginatedData[prevIndex].isGroupHeader) prevIndex--;
          if (prevIndex >=0) nextRowId = paginatedData[prevIndex].id;
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (currentRowIndex < paginatedData.length - 1) {
          let nextIndex = currentRowIndex + 1;
          while(nextIndex < paginatedData.length && paginatedData[nextIndex].isGroupHeader) nextIndex++;
          if (nextIndex < paginatedData.length) nextRowId = paginatedData[nextIndex].id;
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (currentColIndex > 0) {
          nextColField = orderedVisibleColumnDefs[currentColIndex - 1].field;
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (currentColIndex < orderedVisibleColumnDefs.length - 1) {
          nextColField = orderedVisibleColumnDefs[currentColIndex + 1].field;
        }
        break;
      case ' ': 
        e.preventDefault();
        if (focusedCell) {
          const focusedRow = paginatedData.find(r => r.id === focusedCell.rowId);
          if (focusedRow) {
            if (isTreeData && treeColumn && focusedCell.colField === treeColumn && focusedRow.hasChildren) {
              handleToggleExpandRow(focusedCell.rowId);
            } else if (enableGroupingPanel && focusedRow.isGroupHeader && focusedRow.groupKey) {
                handleToggleExpandGroup(focusedRow.groupKey);
            } else if (enableRowSelection && !focusedRow.isGroupHeader) {
              handleSelectRow(focusedCell.rowId, !state.selectedRows.has(focusedCell.rowId));
            }
          }
        }
        break;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        if (focusedCell) {
          const focusedRow = paginatedData.find(r => r.id === focusedCell.rowId);
           if (focusedRow) {
            if (isTreeData && treeColumn && focusedCell.colField === treeColumn && focusedRow.hasChildren && e.key === 'Enter') {
                 handleToggleExpandRow(focusedCell.rowId);
            } else if (enableGroupingPanel && focusedRow.isGroupHeader && focusedRow.groupKey && e.key === 'Enter') {
                 handleToggleExpandGroup(focusedRow.groupKey);
            } else if (!focusedRow.isGroupHeader) {
                const colDef = activeColDefsMap.get(focusedCell.colField);
                if (colDef?.editable) {
                    startEditingCell(focusedCell.rowId, focusedCell.colField);
                }
            }
           }
        }
        break;
      case 'Escape':
        if (rangeAnchor || rangeEnd || contextMenu || findOpen) {
          e.preventDefault();
          setRangeAnchor(null);
          setRangeEnd(null);
          setContextMenu(null);
          if (findOpen) closeFindBar();
        }
        break;
      default:
        return;
    }

    if ((nextRowId !== undefined && nextRowId !== focusedCell?.rowId) || (nextColField !== undefined && nextColField !== focusedCell?.colField)) {
        const finalRowId = nextRowId !== undefined ? nextRowId : focusedCell?.rowId;
        const finalColField = nextColField !== undefined ? nextColField : focusedCell?.colField;
        if (finalRowId !== undefined && finalColField !== undefined) {
          setState(prev => ({ ...prev, focusedCell: { rowId: finalRowId, colField: finalColField } }));
        }
    } else if (!focusedCell && nextRowId !== undefined && nextColField !== undefined) {
        setState(prev => ({ ...prev, focusedCell: { rowId: nextRowId!, colField: nextColField! } }));
    }
  };


  React.useEffect(() => {
    if (state.focusedCell && !state.editingCell && tableWrapperRef.current) {
      // Do not steal focus if an input inside the floating filter row or toolbar is currently focused
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && tableWrapperRef.current.contains(activeEl) && activeEl.closest('input, select, textarea')) {
        return;
      }
      tableWrapperRef.current.focus({ preventScroll: true });
      const cellId = `cell-${state.focusedCell.rowId}-${state.focusedCell.colField}`;
      const cellElement = document.getElementById(cellId);
      if (cellElement) {
         const cellRect = cellElement.getBoundingClientRect();
         const tableContainer = tableWrapperRef.current?.querySelector('.overflow-x-auto') as HTMLElement | null;

         if (tableContainer) {
            const containerRect = tableContainer.getBoundingClientRect();
            const colField = state.focusedCell.colField;
            const isLeftPinned = effectivePinnedLeft.includes(colField);
            const isRightPinned = effectivePinnedRight.includes(colField);
            const isVisibleY = cellRect.top >= containerRect.top && cellRect.bottom <= containerRect.bottom;

            if (isLeftPinned) {
              if (tableContainer.scrollLeft > 0) {
                tableContainer.scrollLeft = 0;
              }
            } else if (isRightPinned) {
              const maxScroll = Math.max(0, tableContainer.scrollWidth - tableContainer.clientWidth);
              if (tableContainer.scrollLeft < maxScroll) {
                tableContainer.scrollLeft = maxScroll;
              }
            } else {
              const visibleLeft = containerRect.left + stickyOffsets.totalLeftWidth;
              const visibleRight = containerRect.right - stickyOffsets.totalRightWidth;
              const isVisibleX = cellRect.left >= visibleLeft && cellRect.right <= visibleRight;
              if (!isVisibleX) {
                if (cellRect.left < visibleLeft) {
                  tableContainer.scrollLeft -= (visibleLeft - cellRect.left);
                } else if (cellRect.right > visibleRight) {
                  tableContainer.scrollLeft += (cellRect.right - visibleRight);
                }
              }
            }
            if (!isVisibleY) {
              cellElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
         } else {
             cellElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
         }
      }
    }
  }, [state.focusedCell, state.editingCell, paginatedData, effectivePinnedLeft, effectivePinnedRight, stickyOffsets.totalLeftWidth, stickyOffsets.totalRightWidth]);

  if (!initialData) {
     return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const renderCellContent = (row: ProcessedRow<TData>, col: ColumnDefinition<TData>): React.ReactNode => {
    const cellValue = getCellValue(row, col.field);

    if (state.editingCell && state.editingCell.rowId === row.id && state.editingCell.field === col.field) {
      const colDef = processedColumnDefs.find(c => c.field === col.field);
      const originalRowDataForEdit = baseDataForProcessing.find(r => r.id === row.id)?.originalRow;
      const inputType = colDef?.filterType === 'number' || (originalRowDataForEdit && typeof getCellValue({originalRow: originalRowDataForEdit} as ProcessedRow<TData>,col.field) === 'number') ? 'number' : 'text';
      
      return (
        <Input
          type={inputType}
          value={state.editInputValue}
          onChange={handleEditInputChange}
          onBlur={handleEditCommit}
          onKeyDown={handleEditInputKeyDown}
          autoFocus
          className="h-full p-1 border-ring"
        />
      );
    }

    if (isTreeData && treeColumn && col.field === treeColumn) {
      const treeContent = col.cellRenderer 
        ? col.cellRenderer(cellValue, row.originalRow)
        : String(cellValue);

      return (
        <div className="flex items-center" style={{ paddingLeft: `${row.level * 1.5}rem` }}>
          {row.hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleExpandRow(row.id); }}
              className="mr-1 p-0.5 rounded hover:bg-accent focus:outline-none"
              aria-label={row.isExpanded ? "Collapse row" : "Expand row"}
              tabIndex={-1}
            >
              {row.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span style={{ width: '1.25rem' }} className="mr-1 inline-block"></span>
          )}
          {treeContent}
        </div>
      );
    }

    if (col.cellRenderer) {
      return col.cellRenderer(cellValue, row.originalRow);
    }

    if (col.sparkline) {
      const opts = col.sparkline;
      const series = opts.values ? opts.values(row.originalRow) : cellValue;
      const labels = typeof opts.labels === 'function' ? opts.labels(row.originalRow) : opts.labels;
      return (
        <Sparkline
          values={series}
          type={opts.type}
          width={opts.width}
          height={opts.height}
          color={opts.color}
          negativeColor={opts.negativeColor}
          labels={labels}
          format={opts.format}
        />
      );
    }

    return cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
  };

  const checkboxColumnWidth = '50px';
  const detailColumnWidth = '40px';
  const reorderColumnWidth = '32px';
  const checkboxColumnLeft = rowReorderEnabled ? 32 : 0;
  const detailColumnLeft = (enableRowSelection ? 50 : 0) + (rowReorderEnabled ? 32 : 0);
  const totalColSpan = orderedVisibleColumnDefs.length + (enableRowSelection ? 1 : 0) + (masterDetail ? 1 : 0) + (rowReorderEnabled ? 1 : 0);
  // When a group header row is present, the main header row sticks below it (top-8 = 2rem).
  const headerTopClass = hasHeaderGroups ? 'top-8' : 'top-0';
  const groupedByColumns = state.groupedBy.map(field => colDefsMap.get(field)!).filter(Boolean);
  const hasFilterableColumns = processedColumnDefs.some(c => c.filterable && c.filterType);
  const showFloatingFilterRow = !!state.floatingFiltersOpen && hasFilterableColumns && !isPivotActive;
  const showPivotButton =
    !isTreeData &&
    (enablePivotToggle !== undefined
      ? enablePivotToggle
      : enableGroupingPanel || pivotMode || (pivotColumns && pivotColumns.length > 0));

  const aggregateLabels: Record<string, string> = { sum: 'Sum', avg: 'Avg', min: 'Min', max: 'Max', count: 'Count' };

  const handleExportCsv = () => {
    exportToCsv(sortedData, orderedVisibleColumnDefs, 'grid_export');
  };

  const handleExportXlsx = () => {
    exportToXlsx(sortedData, orderedVisibleColumnDefs, 'grid_export');
  };

  const renderedRowsCount = paginatedData.filter(r => !r.isGroupHeader).length;

  const activeFilterCount = Object.keys(state.columnFilters).length + (state.globalFilter ? 1 : 0);

  const handleClearAllFilters = () => {
    setState(prevState => ({ ...prevState, globalFilter: '', columnFilters: {}, currentPage: 1 }));
  };


  return (
    <div
      ref={tableWrapperRef}
      className="rounded-lg border bg-card text-card-foreground shadow-sm focus:outline-none"
      tabIndex={0}
      onKeyDown={handleGridKeyDown}
      onPaste={handlePaste}
    >
      {isPivotActive ? (
        <DataGridPivotPanel
          allColumns={processedColumnDefs}
          allColumnsMap={colDefsMap as Map<keyof TData & string, ColumnDefinition<TData>>}
          rowGroupFields={state.groupedBy}
          pivotFields={state.pivotColumns || []}
          valueConfigs={
            state.pivotValues && state.pivotValues.length > 0
              ? state.pivotValues
              : deriveDefaultPivotValues(processedColumnDefs)
          }
          onAddRowGroup={handleGroupColumn}
          onRemoveRowGroup={handleUngroupColumn}
          onAddPivotColumn={handleAddPivotColumn}
          onRemovePivotColumn={handleRemovePivotColumn}
          onAddValueConfig={handleAddPivotValue}
          onChangeValueAggregate={handleChangePivotValueAggregate}
          onRemoveValueConfig={handleRemovePivotValue}
          onExitPivotMode={handleTogglePivotMode}
        />
      ) : (
        enableGroupingPanel && !isTreeData && (
          <DataGridGroupingPanel
            groupedColumns={groupedByColumns as ColumnDefinition<TData>[]}
            allColumnsMap={colDefsMap as Map<keyof TData & string, ColumnDefinition<TData>>}
            onUngroupColumn={handleUngroupColumn}
            onDropColumn={handleGroupColumn}
          />
        )
      )}
      <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <Input
          placeholder={globalFilterPlaceholder}
          value={state.globalFilter}
          onChange={handleGlobalFilterChange}
          className="max-w-xs h-9"
          aria-label="Global search input"
        />
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearAllFilters}>
              <FilterX className="mr-2 h-4 w-4" />
              Clear filters ({activeFilterCount})
            </Button>
          )}
          {hasFilterableColumns && !isPivotActive && (
            <Button
              variant={state.floatingFiltersOpen ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setState(prev => ({ ...prev, floatingFiltersOpen: !prev.floatingFiltersOpen }))
              }
              aria-label="Toggle inline quick-filter row"
              aria-pressed={!!state.floatingFiltersOpen}
            >
              <ListFilter className="mr-2 h-4 w-4" />
              Quick Filters
            </Button>
          )}
          {showPivotButton && (
            <Button
              variant={isPivotActive ? "default" : "outline"}
              size="sm"
              onClick={handleTogglePivotMode}
              aria-label="Toggle Pivot Table Mode"
              aria-pressed={isPivotActive}
            >
              <Columns3 className="mr-2 h-4 w-4" />
              Pivot Mode
            </Button>
          )}
          {enableFormulaColumns && !isPivotActive && (
            <DataGridFormulaDialog
              allColumns={processedColumnDefs}
              formulaColumns={state.formulaColumns || []}
              sampleRow={dataWithFormulas?.[0]}
              onSaveFormulaColumn={handleSaveFormulaColumn}
              onRemoveFormulaColumn={handleRemoveFormulaColumn}
            />
          )}
          {enableSavedViews && (
            <DataGridViewsMenu
              views={allSavedViews}
              activeViewId={state.activeViewId || null}
              onApplyView={handleApplySavedView}
              onSaveNewView={handleSaveNewView}
              onUpdateView={handleUpdateSavedView}
              onDeleteView={handleDeleteSavedView}
              onResetDefaultLayout={handleResetDefaultLayout}
            />
          )}
          {enableDensitySelector && (
            <DataGridDensitySelector
              density={state.density || 'normal'}
              onDensityChange={handleDensityChange}
            />
          )}
          {enableFind && (
            <Button variant="outline" size="sm" onClick={() => setFindOpen(true)} aria-label="Find in grid (Ctrl+F)">
              <Search className="mr-2 h-4 w-4" />
              Find
            </Button>
          )}
          {!isPivotActive && (
            <ColumnVisibilityToggle
              allColumns={processedColumnDefs}
              visibleColumns={state.visibleColumns}
              onVisibilityChange={handleColumnVisibilityChange}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCsv}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXlsx}>
                Export as XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {findOpen && enableFind && (
        <DataGridFindBar
          query={findQuery}
          matchCount={findMatches.length}
          activeMatchIndex={activeMatch ? Math.min(findActiveIdx, findMatches.length - 1) : 0}
          onQueryChange={handleFindQueryChange}
          onNext={handleFindNext}
          onPrevious={handleFindPrevious}
          onClose={closeFindBar}
        />
      )}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={cn(
          "overflow-x-auto relative",
          virtualized && "overflow-y-auto",
          (isDraggingRange || isFilling) && "select-none"
        )}
        style={virtualized ? { maxHeight: `${virtualizedMaxHeight}px` } : undefined}
      >
        <Table>
          <colgroup>
            {rowReorderEnabled && <col style={{ width: reorderColumnWidth }} />}
            {enableRowSelection && <col style={{ width: checkboxColumnWidth }} />}
            {masterDetail && <col style={{ width: detailColumnWidth }} />}
            {orderedVisibleColumnDefs.map(colDef => (
              <col
                key={colDef.field}
                style={{ width: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px` }}
              />
            ))}
          </colgroup>
          <TableHeader className="sticky top-0 z-30 bg-card">
            {hasHeaderGroups && headerGroupSpans && (
              <TableRow className="hover:bg-transparent">
                {rowReorderEnabled && (
                  <TableHead
                    className="h-8 px-0 py-0 sticky-header-cell top-0"
                    style={{ width: reorderColumnWidth, minWidth: reorderColumnWidth, left: 0, zIndex: 21 }}
                  />
                )}
                {enableRowSelection && (
                  <TableHead
                    className="h-8 px-0 py-0 sticky-header-cell top-0"
                    style={{ width: checkboxColumnWidth, minWidth: checkboxColumnWidth, left: checkboxColumnLeft, zIndex: 21 }}
                  />
                )}
                {masterDetail && (
                  <TableHead
                    className="h-8 px-0 py-0 sticky-header-cell top-0"
                    style={{ width: detailColumnWidth, minWidth: detailColumnWidth, left: detailColumnLeft, zIndex: 21 }}
                  />
                )}
                {(['left', 'middle', 'right'] as const).flatMap(region =>
                  headerGroupSpans[region].map((span, spanIndex) => {
                    const stickyStyle: React.CSSProperties = {};
                    if (region === 'left') {
                      stickyStyle.left = `${stickyOffsets.left[span.columns[0].field] || 0}px`;
                    } else if (region === 'right') {
                      stickyStyle.right = `${stickyOffsets.right[span.columns[span.columns.length - 1].field] || 0}px`;
                    }
                    return (
                      <TableHead
                        key={`group-${region}-${spanIndex}-${span.columns[0].field}`}
                        colSpan={span.columns.length}
                        className={cn(
                          "h-8 px-2 py-1 sticky top-0 bg-card text-center align-middle",
                          region !== 'middle' ? "sticky-header-cell" : "z-20",
                          span.group && "header-group-cell"
                        )}
                        style={region !== 'middle' ? { ...stickyStyle, zIndex: 21 } : stickyStyle}
                      >
                        {span.group && (
                          <span className="text-xs font-semibold text-muted-foreground">{span.group}</span>
                        )}
                      </TableHead>
                    );
                  })
                )}
              </TableRow>
            )}
            <TableRow>
              {rowReorderEnabled && (
                <TableHead
                  className={cn("px-0 py-0 sticky-header-cell", headerTopClass)}
                  style={{
                    width: reorderColumnWidth,
                    minWidth: reorderColumnWidth,
                    left: 0,
                    zIndex: 21
                  }}
                  aria-label="Row reorder column"
                />
              )}
              {enableRowSelection && (
                <TableHead
                  className={cn("px-0 py-0 sticky-header-cell", headerTopClass)}
                  style={{
                    width: checkboxColumnWidth,
                    minWidth: checkboxColumnWidth,
                    left: checkboxColumnLeft,
                    zIndex: 21
                  }}
                >
                  <div className="px-3 py-2 h-full flex items-center justify-center">
                    <Checkbox
                      checked={isAllCurrentPageRowsSelected}
                      onCheckedChange={(checked) => handleSelectAllRows(!!checked)}
                      aria-label="Select all rows on current page"
                      disabled={paginatedData.filter(r => !r.isGroupHeader).length === 0}
                    />
                  </div>
                </TableHead>
              )}
              {masterDetail && (
                <TableHead
                  className={cn("px-0 py-0 sticky-header-cell", headerTopClass)}
                  style={{
                    width: detailColumnWidth,
                    minWidth: detailColumnWidth,
                    left: detailColumnLeft,
                    zIndex: 21
                  }}
                  aria-label="Detail expander column"
                />
              )}
              {orderedVisibleColumnDefs.map((colDef) => {
                const isDraggableForReorder = !isPivotActive && colDef.reorderable !== false && !effectivePinnedLeft.includes(colDef.field) && !effectivePinnedRight.includes(colDef.field);
                const currentWidth = state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`;
                const isLeftPinned = effectivePinnedLeft.includes(colDef.field);
                const isRightPinned = effectivePinnedRight.includes(colDef.field);
                const isGrouped = !isPivotActive && state.groupedBy.includes(colDef.field);


                let stickyStyle: React.CSSProperties = {};
                if (isLeftPinned) {
                  stickyStyle.left = `${stickyOffsets.left[colDef.field] || 0}px`;
                  stickyStyle.zIndex = 21;
                } else if (isRightPinned) {
                  stickyStyle.right = `${stickyOffsets.right[colDef.field] || 0}px`;
                  stickyStyle.zIndex = 21;
                }

                return (
                  <TableHead
                    key={colDef.field}
                    data-field={colDef.field}
                    style={{
                      width: currentWidth,
                      minWidth: colDef.minWidth || currentWidth || '50px',
                      ...stickyStyle
                    }}
                    className={cn(
                      "px-0 py-0",
                      headerTopClass,
                      (isLeftPinned || isRightPinned) && "sticky-header-cell bg-card",
                      isLeftPinned && effectivePinnedLeft.length > 0 && "pinned-left-shadow",
                      isRightPinned && effectivePinnedRight.length > 0 && "pinned-right-shadow",
                      isGrouped && "bg-muted/70"
                    )}
                    onDragOver={(e) => isDraggableForReorder && handleDragOverReorder(e, colDef.field)}
                    onDragLeave={() => isDraggableForReorder && handleDragLeaveReorder()}
                    onDrop={(e) => isDraggableForReorder && handleDropReorder(colDef.field, e)}
                    onDragEnd={() => (isDraggableForReorder || ((enableGroupingPanel || isPivotActive) && colDef.groupable !== false)) && handleDragEndColumn()}
                    data-is-dragged={state.draggedColumn === colDef.field}
                    data-is-drop-target={state.draggedOverColumn === colDef.field && state.draggedColumn !== colDef.field}
                  >
                    <DataGridHeaderCell
                      column={colDef}
                      sortConfig={state.sortConfig}
                      multiSortConfig={state.multiSortConfig}
                      onSort={handleSort}
                      onFilterChange={handleColumnFilterChange}
                      columnFilters={state.columnFilters}
                      currentWidth={currentWidth}
                      onColumnWidthChange={handleColumnWidthChange}
                      onPinColumn={handlePinColumn}
                      isDraggableForReorder={isDraggableForReorder && !isGrouped}
                      isDraggableForGrouping={(enableGroupingPanel || isPivotActive) && colDef.groupable !== false && !isGrouped && !isTreeData}
                      currentPinnedState={
                        isLeftPinned ? 'left' : isRightPinned ? 'right' : null
                      }
                      onDragStartColumn={handleDragStartColumn}
                    />
                  </TableHead>
                );
              })}
            </TableRow>
            {showFloatingFilterRow && (
              <TableRow className="floating-filter-row bg-muted/30 hover:bg-muted/30 border-b">
                {rowReorderEnabled && (
                  <TableHead
                    className="h-9 px-0 py-0 sticky-header-cell bg-muted/30"
                    style={{
                      width: reorderColumnWidth,
                      minWidth: reorderColumnWidth,
                      left: 0,
                      zIndex: 21,
                    }}
                  />
                )}
                {enableRowSelection && (
                  <TableHead
                    className="h-9 px-0 py-0 sticky-header-cell bg-muted/30"
                    style={{
                      width: checkboxColumnWidth,
                      minWidth: checkboxColumnWidth,
                      left: checkboxColumnLeft,
                      zIndex: 21,
                    }}
                  />
                )}
                {masterDetail && (
                  <TableHead
                    className="h-9 px-0 py-0 sticky-header-cell bg-muted/30"
                    style={{
                      width: detailColumnWidth,
                      minWidth: detailColumnWidth,
                      left: detailColumnLeft,
                      zIndex: 21,
                    }}
                  />
                )}
                {orderedVisibleColumnDefs.map(colDef => {
                  const currentWidth = state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`;
                  const isLeftPinned = effectivePinnedLeft.includes(colDef.field);
                  const isRightPinned = effectivePinnedRight.includes(colDef.field);
                  const stickyStyle: React.CSSProperties = {};
                  if (isLeftPinned) {
                    stickyStyle.left = `${stickyOffsets.left[colDef.field] || 0}px`;
                    stickyStyle.zIndex = 21;
                  } else if (isRightPinned) {
                    stickyStyle.right = `${stickyOffsets.right[colDef.field] || 0}px`;
                    stickyStyle.zIndex = 21;
                  }

                  return (
                    <TableHead
                      key={`floating-filter-${colDef.field}`}
                      style={{
                        width: currentWidth,
                        minWidth: colDef.minWidth || currentWidth || '50px',
                        ...stickyStyle,
                      }}
                      className={cn(
                        "h-9 px-0 py-0 align-middle",
                        (isLeftPinned || isRightPinned) && "sticky-header-cell bg-card",
                        isLeftPinned && effectivePinnedLeft.length > 0 && "pinned-left-shadow",
                        isRightPinned && effectivePinnedRight.length > 0 && "pinned-right-shadow"
                      )}
                    >
                      <DataGridFloatingFilterCell
                        column={colDef}
                        filterValue={state.columnFilters[colDef.field]}
                        onFilterChange={handleColumnFilterChange}
                      />
                    </TableHead>
                  );
                })}
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {virtualized && topSpacer > 0 && (
              <TableRow style={{ height: `${topSpacer}px` }} className="hover:bg-transparent">
                <TableCell
                  colSpan={totalColSpan}
                  className="p-0 border-0"
                  style={{ height: `${topSpacer}px` }}
                />
              </TableRow>
            )}
            {visibleDisplayRows.length > 0 ? (
              visibleDisplayRows.map(({ row, isDetail, dataIndex }) => {
                if (isDetail) {
                  return (
                    <TableRow key={`${row.id}-detail`} className="detail-row hover:bg-transparent">
                      <TableCell
                        colSpan={totalColSpan}
                        className="p-0 bg-muted/20"
                        style={virtualized ? { height: `${detailRowHeight}px` } : undefined}
                      >
                        <div className={cn("p-4", virtualized && "h-full overflow-auto")}>
                          {detailRenderer!(row.originalRow)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }
                if (row.isGroupHeader) {
                  const groupColDef = colDefsMap.get(row.groupField as keyof TData & string);
                  const groupHeaderText = groupColDef ? groupColDef.headerText : String(row.groupField);
                  return (
                    <TableRow key={row.id} className="group-header-row">
                      <TableCell
                        colSpan={totalColSpan}
                        className={cn(densityMetrics.groupCellPaddingClass, "cursor-pointer")}
                        onClick={() => row.groupKey && handleToggleExpandGroup(row.groupKey)}
                      >
                        <div className="flex items-center" style={{ paddingLeft: `${row.level * 1.5}rem` }}>
                           <button
                              className="mr-1 p-0.5 rounded hover:bg-accent focus:outline-none"
                              aria-label={row.isExpanded ? `Collapse group ${row.groupValue}` : `Expand group ${row.groupValue}`}
                            >
                              {row.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          <strong>{groupHeaderText}:</strong>&nbsp;{String(row.groupValue)}
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({row.groupItems?.length ?? 0} item{(row.groupItems?.length ?? 0) === 1 ? '' : 's'}
                            {orderedVisibleColumnDefs
                              .filter(c => c.aggregate)
                              .map(c => {
                                const aggValue = computeAggregate(row.groupItems || [], c);
                                const label = typeof c.aggregate === 'string' ? aggregateLabels[c.aggregate] : '';
                                return aggValue ? ` · ${label ? label + ' ' : ''}${c.headerText}: ${aggValue}` : '';
                              })
                              .join('')})
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }
                const rowStyle = isPivotActive ? undefined : getRowStyle?.(row.originalRow);
                const pinnedCellBg = rowStyle?.backgroundColor
                  ? { backgroundImage: `linear-gradient(${rowStyle.backgroundColor}, ${rowStyle.backgroundColor})` }
                  : undefined;
                return (
                  <TableRow
                    key={row.id}
                    data-state={state.selectedRows.has(row.id) ? "selected" : ""}
                    className={cn(
                      state.selectedRows.has(row.id) && "bg-muted/50",
                      draggedRowId === row.id && "opacity-50",
                      rowDropTarget?.rowId === row.id && (rowDropTarget.position === 'above' ? "row-drop-above" : "row-drop-below")
                    )}
                    style={rowStyle}
                    onDragOver={rowReorderActive && draggedRowId !== null ? (e) => handleRowDragOver(e, row.id) : undefined}
                    onDrop={rowReorderActive && draggedRowId !== null ? handleRowDrop : undefined}
                  >
                    {rowReorderEnabled && (
                      <TableCell
                        className="px-0 py-2 sticky-body-cell"
                        style={{
                          width: reorderColumnWidth,
                          minWidth: reorderColumnWidth,
                          left: 0,
                          zIndex: 11,
                          ...pinnedCellBg
                        }}
                      >
                        <div
                          draggable={rowReorderActive}
                          onDragStart={rowReorderActive ? (e) => handleRowDragStart(e, row.id) : undefined}
                          onDragEnd={rowReorderActive ? handleRowDragEnd : undefined}
                          className={cn(
                            "flex items-center justify-center",
                            rowReorderActive
                              ? "cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                              : "cursor-not-allowed text-muted-foreground/40"
                          )}
                          title={rowReorderActive ? "Drag to reorder" : "Clear sorting/grouping to reorder rows"}
                          aria-label="Drag to reorder row"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                      </TableCell>
                    )}
                    {enableRowSelection && (
                      <TableCell
                        className="px-3 py-2 sticky-body-cell"
                        style={{
                          left: checkboxColumnLeft,
                          zIndex: 11,
                          ...pinnedCellBg
                        }}
                      >
                        <Checkbox
                          checked={state.selectedRows.has(row.id)}
                          onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                          aria-labelledby={`select-row-${row.id}`}
                          id={`select-row-${row.id}`}
                        />
                      </TableCell>
                    )}
                    {masterDetail && (
                      <TableCell
                        className="px-1 py-2 sticky-body-cell"
                        style={{
                          width: detailColumnWidth,
                          minWidth: detailColumnWidth,
                          left: detailColumnLeft,
                          zIndex: 11,
                          ...pinnedCellBg
                        }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleDetail(row.id); }}
                          className="p-0.5 rounded hover:bg-accent focus:outline-none"
                          aria-label={expandedDetails.has(row.id) ? "Collapse row detail" : "Expand row detail"}
                          aria-expanded={expandedDetails.has(row.id)}
                        >
                          {expandedDetails.has(row.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </TableCell>
                    )}
                    {orderedVisibleColumnDefs.map((colDef, colIndex) => {
                       const isLeftPinned = effectivePinnedLeft.includes(colDef.field);
                       const isRightPinned = effectivePinnedRight.includes(colDef.field);
                       let stickyStyle: React.CSSProperties = {};
                        if (isLeftPinned) {
                          stickyStyle.left = `${stickyOffsets.left[colDef.field] || 0}px`;
                          if (pinnedCellBg) Object.assign(stickyStyle, pinnedCellBg);
                        } else if (isRightPinned) {
                          stickyStyle.right = `${stickyOffsets.right[colDef.field] || 0}px`;
                          if (pinnedCellBg) Object.assign(stickyStyle, pinnedCellBg);
                        }
                        const isFocused = state.focusedCell?.rowId === row.id && state.focusedCell?.colField === colDef.field;
                        const isFillCorner = fillHandleEnabled && !!rangeBounds &&
                          dataIndex === rangeBounds.bottom && colIndex === rangeBounds.right;
                        const isFindMatch = findOpen && findMatchSet.has(`${row.id}|${colDef.field}`);
                        const isActiveFindMatch = isFindMatch && activeMatch?.rowId === row.id && activeMatch?.field === colDef.field;
                        const isPivotTotalCol = isPivotActive && String(colDef.field).startsWith('__pivot_total__');

                        const cellRules = [
                          ...(conditionalFormats || []),
                          ...(colDef.conditionalFormats || []),
                        ];
                        const conditionalStyle = getConditionalCellStyle(
                          row,
                          colDef.field,
                          cellRules,
                          columnBoundsMap[colDef.field]
                        );

                      return (
                      <TableCell
                        key={colDef.field}
                        id={`cell-${row.id}-${colDef.field}`}
                        data-field={colDef.field}
                        className={cn(
                          densityMetrics.cellPaddingClass,
                          "truncate",
                          colDef.editable && "cursor-pointer",
                          (isLeftPinned || isRightPinned) && "sticky-body-cell",
                          isFillCorner && !isLeftPinned && !isRightPinned && "relative",
                          isLeftPinned && effectivePinnedLeft.length > 0 && "pinned-left-shadow",
                          isRightPinned && effectivePinnedRight.length > 0 && "pinned-right-shadow",
                          isPivotTotalCol && "font-semibold bg-muted/20",
                          isFocused && !state.editingCell && "cell-focused",
                          isCellInRange(dataIndex, colIndex) && "cell-range-selected",
                          isCellInFillZone(dataIndex, colIndex) && "cell-fill-preview",
                          isFindMatch && "cell-find-match",
                          isActiveFindMatch && "cell-find-current"
                          )}
                        style={{
                          width: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`,
                          maxWidth: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`,
                          ...conditionalStyle,
                          ...stickyStyle
                        }}
                        title={colDef.sparkline ? undefined : String(getCellValue(row, colDef.field) ?? '')}
                        onClick={() => handleCellClick(row.id, colDef.field)}
                        onDoubleClick={() => colDef.editable && startEditingCell(row.id, colDef.field)}
                        onMouseDown={(e) => handleCellMouseDown(e, dataIndex, colIndex)}
                        onMouseEnter={() => handleCellMouseEnter(dataIndex, colIndex)}
                        onContextMenu={(e) => handleCellContextMenu(e, dataIndex, colIndex, row.id, colDef.field)}
                      >
                        {renderCellContent(row, colDef)}
                        {isFillCorner && (
                          <div
                            className="fill-handle"
                            onMouseDown={handleFillMouseDown}
                            aria-label="Fill handle"
                          />
                        )}
                      </TableCell>
                    )}
                    )}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={totalColSpan} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
            {virtualized && bottomSpacer > 0 && (
              <TableRow style={{ height: `${bottomSpacer}px` }} className="hover:bg-transparent">
                <TableCell
                  colSpan={totalColSpan}
                  className="p-0 border-0"
                  style={{ height: `${bottomSpacer}px` }}
                />
              </TableRow>
            )}
          </TableBody>
          {renderedRowsCount > 0 && (
            <TableFooter>
              {orderedVisibleColumnDefs.some(col => col.aggregate) && (
                <TableRow className="bg-muted/30 font-semibold border-t">
                  {rowReorderEnabled && (
                    <TableCell
                      className="px-0 py-2 sticky-body-cell"
                      style={{
                        width: reorderColumnWidth,
                        minWidth: reorderColumnWidth,
                        left: 0,
                        zIndex: 11
                      }}
                    />
                  )}
                  {enableRowSelection && (
                    <TableCell
                      className="px-3 py-2 sticky-body-cell"
                      style={{
                        left: checkboxColumnLeft,
                        zIndex: 11
                      }}
                    >
                      Total
                    </TableCell>
                  )}
                  {masterDetail && (
                    <TableCell
                      className="px-1 py-2 sticky-body-cell"
                      style={{
                        width: detailColumnWidth,
                        minWidth: detailColumnWidth,
                        left: detailColumnLeft,
                        zIndex: 11
                      }}
                    />
                  )}
                  {orderedVisibleColumnDefs.map((colDef, colIdx) => {
                    const isLeftPinned = effectivePinnedLeft.includes(colDef.field);
                    const isRightPinned = effectivePinnedRight.includes(colDef.field);
                    let stickyStyle: React.CSSProperties = {};
                    if (isLeftPinned) {
                      stickyStyle.left = `${stickyOffsets.left[colDef.field] || 0}px`;
                    } else if (isRightPinned) {
                      stickyStyle.right = `${stickyOffsets.right[colDef.field] || 0}px`;
                    }

                    if (isPivotActive && pivotTableResult) {
                      const grandVal = pivotTableResult.grandTotalValues[colDef.field];
                      const isFirstPivotGroupCol = colIdx === 0 && !enableRowSelection;
                      return (
                        <TableCell
                          key={colDef.field}
                          className={cn(
                            "px-3 py-2 truncate",
                            (isLeftPinned || isRightPinned) && "sticky-body-cell",
                            isLeftPinned && effectivePinnedLeft.length > 0 && "pinned-left-shadow",
                            isRightPinned && effectivePinnedRight.length > 0 && "pinned-right-shadow"
                          )}
                          style={{
                            width: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`,
                            maxWidth: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`,
                            ...stickyStyle
                          }}
                        >
                          {isFirstPivotGroupCol
                            ? 'Grand Total'
                            : grandVal !== undefined && colDef.cellRenderer
                              ? colDef.cellRenderer(grandVal, {} as TData)
                              : grandVal !== undefined && grandVal !== null
                                ? grandVal.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                : ''}
                        </TableCell>
                      );
                    }

                    const hasAggregate = !!colDef.aggregate;
                    const aggVal = hasAggregate ? computeAggregate(sortedData, colDef) : '';

                    return (
                      <TableCell
                        key={colDef.field}
                        className={cn(
                          "px-3 py-2 truncate",
                          (isLeftPinned || isRightPinned) && "sticky-body-cell",
                          isLeftPinned && effectivePinnedLeft.length > 0 && "pinned-left-shadow",
                          isRightPinned && effectivePinnedRight.length > 0 && "pinned-right-shadow"
                        )}
                        style={{
                          width: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`,
                          maxWidth: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`,
                          ...stickyStyle
                        }}
                      >
                        {hasAggregate && aggVal ? (
                          <span>
                            <span className="text-xs text-muted-foreground mr-1">
                              {typeof colDef.aggregate === 'string' ? aggregateLabels[colDef.aggregate] : ''}
                            </span>
                            {aggVal}
                          </span>
                        ) : ''}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )}
              <TableRow>
                <TableCell
                  colSpan={totalColSpan}
                  className="text-sm text-muted-foreground text-center"
                >
                  Displaying {renderedRowsCount} {isPivotActive ? 'pivoted group' : 'row'}{renderedRowsCount === 1 ? "" : "s"} on this page.
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {enableStatusBar && (
        <DataGridStatusBar
          filteredRowCount={sortedData.length}
          totalRowCount={baseDataForProcessing.length}
          selectedRowCount={state.selectedRows.size}
          rangeCellCount={rangeCellCount}
          rangeStats={rangeStats}
        />
      )}
      {virtualized ? (
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4">
          <div className="text-sm text-muted-foreground">
            {state.selectedRows.size > 0
              ? `${state.selectedRows.size} of ${sortedData.length} row(s) selected.`
              : sortedData.length > 0 ? `Showing all ${sortedData.length} items (virtualized).` : 'No items to display.'}
          </div>
        </div>
      ) : (
        <DataGridPagination
          currentPage={state.currentPage}
          totalPages={totalPages}
          pageSize={state.pageSize}
          totalItems={(!isPivotActive && state.groupedBy.length > 0 && !isTreeData ? dataWithGroupHeaders : sortedData).length}
          selectedRowsCount={state.selectedRows.size}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={pageSizeOptions}
        />
      )}
      {contextMenu && (() => {
        const ctxColDef = activeColDefsMap.get(contextMenu.colField);
        const isPinnedLeft = effectivePinnedLeft.includes(contextMenu.colField);
        const isPinnedRight = effectivePinnedRight.includes(contextMenu.colField);
        const menuLeft = Math.max(4, Math.min(contextMenu.x, window.innerWidth - 208));
        const menuTop = Math.max(4, Math.min(contextMenu.y, window.innerHeight - 320));
        const itemClass = "flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-left cursor-default hover:bg-accent hover:text-accent-foreground focus:outline-none focus:bg-accent";
        const runAndClose = (action: () => void) => () => { action(); setContextMenu(null); };
        const copyContextRow = () => {
          const row = paginatedData.find(r => r.id === contextMenu.rowId);
          if (!row || row.isGroupHeader) return;
          const text = orderedVisibleColumnDefs.map(c => String(getCellValue(row, c.field) ?? '')).join('\t');
          navigator.clipboard?.writeText(text);
        };
        const chartData = enableRangeChart && enableRangeSelection && rangeBounds
          ? extractRangeChartData(paginatedData, orderedVisibleColumnDefs, rangeBounds)
          : null;
        return (
          <div
            ref={contextMenuRef}
            className="fixed z-50 min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: menuLeft, top: menuTop }}
            onContextMenu={(e) => e.preventDefault()}
            role="menu"
          >
            <button role="menuitem" className={itemClass} onClick={runAndClose(() => copySelectionToClipboard(false))}>Copy</button>
            <button role="menuitem" className={itemClass} onClick={runAndClose(() => copySelectionToClipboard(true))}>Copy with Headers</button>
            <button role="menuitem" className={itemClass} onClick={runAndClose(copyContextRow)}>Copy Row</button>
            {enableRangeChart && enableRangeSelection && (
              <button
                role="menuitem"
                className={cn(itemClass, !chartData && "opacity-50 cursor-not-allowed")}
                disabled={!chartData}
                title={chartData ? undefined : 'Select a range with at least one numeric column'}
                onClick={chartData ? runAndClose(() => setRangeChartData(chartData)) : undefined}
              >
                Chart Selection…
              </button>
            )}
            {!isPivotActive && (
              <>
                <div className="my-1 h-px bg-border" role="separator" />
                {!isPinnedLeft && (
                  <button role="menuitem" className={itemClass} onClick={runAndClose(() => handlePinColumn(contextMenu.colField, 'left'))}>Pin Column Left</button>
                )}
                {!isPinnedRight && (
                  <button role="menuitem" className={itemClass} onClick={runAndClose(() => handlePinColumn(contextMenu.colField, 'right'))}>Pin Column Right</button>
                )}
                {(isPinnedLeft || isPinnedRight) && (
                  <button role="menuitem" className={itemClass} onClick={runAndClose(() => handlePinColumn(contextMenu.colField, null))}>Unpin Column</button>
                )}
                {ctxColDef?.hideable !== false && (
                  <button role="menuitem" className={itemClass} onClick={runAndClose(() => handleColumnVisibilityChange(contextMenu.colField, false))}>Hide Column</button>
                )}
              </>
            )}
            <div className="my-1 h-px bg-border" role="separator" />
            <button role="menuitem" className={itemClass} onClick={runAndClose(handleExportCsv)}>Export as CSV</button>
            <button role="menuitem" className={itemClass} onClick={runAndClose(handleExportXlsx)}>Export as XLSX</button>
          </div>
        );
      })()}
      {rangeChartData && (
        <RangeChartDialog data={rangeChartData} onClose={() => setRangeChartData(null)} />
      )}
    </div>
  );
}
