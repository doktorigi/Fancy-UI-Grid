
"use client";
import * as React from 'react';
import type {
  ColumnDefinition,
  DataGridProps,
  DataGridState,
  FilterValue,
  HierarchicalData,
  ProcessedRow,
  DateFilterValue,
  DateTreeFilterValue,
  NumberFilterValue,
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
import { DataGridPagination } from './DataGridPagination';
import { ColumnVisibilityToggle } from './ColumnVisibilityToggle';
import { DataGridGroupingPanel } from './DataGridGroupingPanel';
import { cn, getCellValue } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, ChevronDown, FileDown, FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToCsv, exportToXlsx } from '@/lib/exportUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, isValid } from 'date-fns';


const DEFAULT_COL_WIDTH = 150; // px
const LOCAL_STORAGE_KEY = 'ngxMatDataGridState';

// Extracts { year, month } straight from a 'YYYY-MM-...' string without going through
// Date parsing, so local-timezone shifting can never move a value into the wrong bucket.
function dateTreeKeyOf(value: any): { year: string; month: string } | null {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})/);
  return match ? { year: match[1], month: match[2] } : null;
}

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
  getRowStyle,
  onFilteredDataChange,
  globalFilterFields,
  globalFilterPlaceholder = 'Search all columns...',
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

    initialColumnDefs.forEach(col => {
      defaultWidths[col.field] = col.defaultWidth || `${DEFAULT_COL_WIDTH}px`;
      if (col.pinned === 'left') {
        initialPinnedLeftFromDefs.push(col.field);
      } else if (col.pinned === 'right') {
        initialPinnedRightFromDefs.push(col.field);
      }
    });

    const unpinnedColumnOrderFromDefs = allFieldsFromDefs.filter(
      field => !initialPinnedLeftFromDefs.includes(field) && !initialPinnedRightFromDefs.includes(field)
    );

    return {
      currentPage: 1,
      pageSize: defaultPageSize,
      sortConfig: null,
      globalFilter: '',
      columnFilters: {},
      visibleColumns: initialVisibleColumnsFromDefs,
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
    };
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedStateString = localStorage.getItem(storageKey);
      if (savedStateString) {
        try {
          const savedState = JSON.parse(savedStateString);
          const currentFieldsSet = new Set(initialColumnDefs.map(col => col.field));

          let reconciledVisibleColumns = (savedState.visibleColumns || [])
            .filter((field: keyof TData & string) => currentFieldsSet.has(field));
          initialColumnDefs.forEach(col => {
            if (!reconciledVisibleColumns.includes(col.field) && col.hideable !== false) {
            } else if (col.hideable === false && !reconciledVisibleColumns.includes(col.field)) {
               reconciledVisibleColumns.push(col.field);
            }
          });
          if (reconciledVisibleColumns.length === 0 && initialColumnDefs.length > 0) {
             reconciledVisibleColumns = initialColumnDefs.map(col => col.field);
          }

          let reconciledUnpinnedOrder = (savedState.columnOrder || [])
            .filter((field: keyof TData & string) => currentFieldsSet.has(field) &&
                                                 !savedState.pinnedColumns?.left?.includes(field) &&
                                                 !savedState.pinnedColumns?.right?.includes(field));

          const reconciledPinnedLeft = (savedState.pinnedColumns?.left || [])
            .filter((field: keyof TData & string) => currentFieldsSet.has(field));
          const reconciledPinnedRight = (savedState.pinnedColumns?.right || [])
            .filter((field: keyof TData & string) => currentFieldsSet.has(field));

          initialColumnDefs.forEach(colDef => {
            if (!reconciledPinnedLeft.includes(colDef.field) &&
                !reconciledPinnedRight.includes(colDef.field) &&
                !reconciledUnpinnedOrder.includes(colDef.field)) {
              reconciledUnpinnedOrder.push(colDef.field);
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


          setState(prevState => ({
            ...prevState,
            columnWidths: { ...prevState.columnWidths, ...(savedState.columnWidths || {}) },
            columnOrder: reconciledUnpinnedOrder,
            pinnedColumns: {
              left: reconciledPinnedLeft,
              right: reconciledPinnedRight
            },
            columnFilters: reconciledColumnFilters,
            sortConfig: savedState.sortConfig || null,
            pageSize: savedState.pageSize || defaultPageSize,
            expandedRows: savedState.expandedRows ? new Set(Array.from(savedState.expandedRows)) : new Set(),
            visibleColumns: reconciledVisibleColumns.length > 0 ? reconciledVisibleColumns : prevState.visibleColumns,
            groupedBy: savedState.groupedBy || [], 
            expandedGroups: savedState.expandedGroups ? new Set(Array.from(savedState.expandedGroups)) : new Set(),
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
        pageSize: state.pageSize,
        expandedRows: Array.from(state.expandedRows),
        visibleColumns: state.visibleColumns,
        groupedBy: state.groupedBy, 
        expandedGroups: Array.from(state.expandedGroups),
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
    state.pageSize,
    state.expandedRows,
    state.visibleColumns,
    state.groupedBy, 
    state.expandedGroups,
  ]);

  const treeColumn = specifiedTreeColumn || (initialColumnDefs.length > 0 ? initialColumnDefs[0].field : undefined);

  const getUniqueColumnValues = React.useCallback((field: keyof TData & string): string[] => {
    if (!initialData) return [];
    const uniqueValues = new Set<string>();
    const traverse = (items: TData[]) => {
      items.forEach(row => {
        const value = getCellValue({originalRow: row} as ProcessedRow<TData>, field); // Adjusted to pass ProcessedRow-like structure
        if (value !== undefined && value !== null) {
          uniqueValues.add(String(value));
        }
        if (isTreeData && row.children) {
          traverse(row.children);
        }
      });
    };
    traverse(initialData);
    return Array.from(uniqueValues).sort();
  }, [initialData, isTreeData]);

  const getDateTreeBuckets = React.useCallback((field: keyof TData & string) => {
    const monthsByYear = new Map<string, Set<string>>();
    (initialData || []).forEach(row => {
      const parts = dateTreeKeyOf(getCellValue({ originalRow: row } as ProcessedRow<TData>, field));
      if (!parts) return;
      if (!monthsByYear.has(parts.year)) monthsByYear.set(parts.year, new Set());
      monthsByYear.get(parts.year)!.add(parts.month);
    });
    return Array.from(monthsByYear.entries())
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, months]) => ({ year, months: Array.from(months).sort() }));
  }, [initialData]);

  const processedColumnDefs = React.useMemo(() => {
    return initialColumnDefs.map(colDef => {
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
  }, [initialColumnDefs, getUniqueColumnValues, getDateTreeBuckets]);

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
        // Do not spread item here to avoid ProcessedRow specific props being overwritten by originalRow
      });
      if (hasChildren && isExpanded && item.children) {
        flatList = flatList.concat(flattenTreeData(item.children, expandedRows, level + 1));
      }
    });
    return flatList;
  }, []);

  const baseDataForProcessing = React.useMemo<ProcessedRow<TData>[]>(() => {
    if (isTreeData) {
      return flattenTreeData(initialData || [], state.expandedRows);
    }
    return (initialData || []).map(item => ({
      originalRow: item,
      id: item.id,
      level: 0,
      hasChildren: false,
      isExpanded: false,
       // Do not spread item here
    }));
  }, [initialData, isTreeData, flattenTreeData, state.expandedRows]);

  const handleSort = (field: keyof TData & string) => {
    setState((prevState) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (prevState.sortConfig?.field === field && prevState.sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      return { ...prevState, sortConfig: { field, direction }, currentPage: 1 };
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
      return { ...prevState, groupedBy: newGroupedBy, currentPage: 1, expandedGroups: new Set() };
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


  const startEditingCell = (rowId: string | number, field: keyof TData & string) => {
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
      onCellEdit(rowId, field, valueToCommit);
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

  const filteredData = React.useMemo(() => {
    if (!baseDataForProcessing) return [];
    let dataToFilter = [...baseDataForProcessing];

    if (state.globalFilter) {
      const lowerGlobalFilter = state.globalFilter.toLowerCase();
      dataToFilter = dataToFilter.filter((row) =>
        processedColumnDefs.some((col) => {
          if (globalFilterFields && globalFilterFields.length > 0 && !globalFilterFields.includes(col.field)) {
            return false;
          }
          if (state.visibleColumns.includes(col.field)) {
            const cellValue = getCellValue(row, col.field);
            return String(cellValue).toLowerCase().includes(lowerGlobalFilter);
          }
          return false;
        })
      );
    }

    Object.entries(state.columnFilters).forEach(([field, filter]) => {
      if (!filter) return;
      const colDef = processedColumnDefs.find(c => c.field === (field as keyof TData & string));
      if (!colDef || !state.visibleColumns.includes(colDef.field)) return;

      dataToFilter = dataToFilter.filter((row) => {
        const cellValue = getCellValue(row, field as keyof TData & string);
        if (cellValue === undefined || cellValue === null) {
            if (filter.type === 'boolean' && filter.value === undefined) return true; // 'Any' for boolean
            if (filter.type === 'date' && (filter as DateFilterValue).preset === 'all') return true; // 'Any Date' for date
            if (filter.type === 'date-tree' && !(filter as DateTreeFilterValue).selected?.length) return true; // no tree selection => show all
            return false;
        }
        switch (filter.type) {
          case 'text':
            return String(cellValue).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'number':
            const numFilter = filter as NumberFilterValue;
            if (numFilter.value === undefined && (numFilter.operator !== 'between' || numFilter.value2 === undefined)) return true;
            const numCell = parseFloat(String(cellValue));
            if (isNaN(numCell)) return false;

            if (numFilter.operator === 'between') {
              if (typeof numFilter.value === 'number' && typeof numFilter.value2 === 'number') {
                return numCell >= numFilter.value && numCell <= numFilter.value2;
              } else if (typeof numFilter.value === 'number') {
                return numCell >= numFilter.value;
              } else if (typeof numFilter.value2 === 'number') {
                return numCell <= numFilter.value2;
              }
              return true; // If one is undefined, it's an open range
            }
            if (numFilter.value === undefined) return true; // For other ops, if value is undefined, no filter

            switch (numFilter.operator) {
              case '=': return numCell === numFilter.value;
              case '!=': return numCell !== numFilter.value;
              case '<': return numCell < numFilter.value;
              case '>': return numCell > numFilter.value;
              case '<=': return numCell <= numFilter.value;
              case '>=': return numCell >= numFilter.value;
              default: return true;
            }
          case 'date':
            const dateFilter = filter as DateFilterValue;
            const cellDate = new Date(String(cellValue));
            if (!isValid(cellDate)) return false;
            const cellDateTime = startOfDay(cellDate).getTime();

            if (dateFilter.preset === 'all' || !dateFilter.preset) return true;

            if (dateFilter.preset === 'custom') {
              if (!dateFilter.value && !dateFilter.value2) return true; // No custom range set
              const startDate = dateFilter.value ? startOfDay(dateFilter.value).getTime() : -Infinity;
              const endDate = dateFilter.value2 ? endOfDay(dateFilter.value2).getTime() : Infinity;
              return cellDateTime >= startDate && cellDateTime <= endDate;
            } else {
              let lowerBound: Date | null = null;
              let upperBound: Date | null = null;
              const today = new Date();

              switch (dateFilter.preset) {
                case 'today':
                  lowerBound = startOfDay(today);
                  upperBound = endOfDay(today);
                  break;
                case 'yesterday':
                  lowerBound = startOfDay(subDays(today, 1));
                  upperBound = endOfDay(subDays(today, 1));
                  break;
                case 'last7days':
                  lowerBound = startOfDay(subDays(today, 6)); // Includes today
                  upperBound = endOfDay(today);
                  break;
                case 'last30days':
                  lowerBound = startOfDay(subDays(today, 29)); // Includes today
                  upperBound = endOfDay(today);
                  break;
                case 'thisMonth':
                  lowerBound = startOfMonth(today);
                  upperBound = endOfMonth(today);
                  break;
                case 'lastMonth':
                  const lastMonthStart = startOfMonth(subMonths(today, 1));
                  lowerBound = lastMonthStart;
                  upperBound = endOfMonth(lastMonthStart);
                  break;
              }
              if (lowerBound && upperBound) {
                return cellDateTime >= lowerBound.getTime() && cellDateTime <= upperBound.getTime();
              }
              return true;
            }
          case 'date-tree': {
            const treeFilter = filter as DateTreeFilterValue;
            if (!treeFilter.selected || treeFilter.selected.length === 0) return true;
            const parts = dateTreeKeyOf(cellValue);
            if (!parts) return false;
            return treeFilter.selected.includes(`${parts.year}-${parts.month}`);
          }
          case 'select':
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
  }, [baseDataForProcessing, state.globalFilter, state.columnFilters, processedColumnDefs, state.visibleColumns, globalFilterFields]);

  const sortedData = React.useMemo(() => {
    const dataToSort = [...filteredData];
    const { groupedBy, sortConfig } = state;

    dataToSort.sort((a, b) => {
      // 1. Group sorting takes precedence
      if (groupedBy.length > 0 && !isTreeData) {
        for (let i = 0; i < groupedBy.length; i++) {
          const groupField = groupedBy[i];
          const groupColDef = colDefsMap.get(groupField);
          const valA = getCellValue(a, groupField);
          const valB = getCellValue(b, groupField);

          if (valA !== valB) {
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (typeof valA === 'number' && typeof valB === 'number') {
              return valA - valB;
            }
            if (groupColDef?.filterType === 'date') {
              const dateA = new Date(String(valA)).getTime();
              const dateB = new Date(String(valB)).getTime();
              if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
            }
            return String(valA).localeCompare(String(valB));
          }
        }
      }

      // 2. Sorting configuration if they are in the same group
      if (!sortConfig) return 0;
      const { field, direction } = sortConfig;
      const colDef = colDefsMap.get(field);
      if (!colDef) return 0;

      const valA = getCellValue(a, field);
      const valB = getCellValue(b, field);

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return direction === 'asc' ? 1 : -1;
      if (valB === null || valB === undefined) return direction === 'asc' ? -1 : 1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return direction === 'asc' ? valA - valB : valB - valA;
      }
      if (colDef?.filterType === 'date' || (String(valA).match(/^\d{4}-\d{2}-\d{2}/) && String(valB).match(/^\d{4}-\d{2}-\d{2}/))) {
        const dateA = new Date(String(valA)).getTime();
        const dateB = new Date(String(valB)).getTime();
        if (!isNaN(dateA) && !isNaN(dateB)) {
            return direction === 'asc' ? dateA - dateB : dateB - dateA;
        }
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });

    return dataToSort;
  }, [filteredData, state.sortConfig, state.groupedBy, colDefsMap, isTreeData]);

  // Report the filtered+sorted rows to the host (for external summaries/KPIs).
  // The callback is kept in a ref so an unstable function identity doesn't re-fire the effect.
  const onFilteredDataChangeRef = React.useRef(onFilteredDataChange);
  onFilteredDataChangeRef.current = onFilteredDataChange;
  React.useEffect(() => {
    onFilteredDataChangeRef.current?.(
      sortedData.filter(r => !r.isGroupHeader).map(r => r.originalRow)
    );
  }, [sortedData]);

  const dataWithGroupHeaders = React.useMemo(() => {
    if (state.groupedBy.length === 0 || isTreeData) { 
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
  }, [sortedData, state.groupedBy, state.expandedGroups, isTreeData, getCellValue]);


  const dataToPaginate = React.useMemo(() => {
    return state.groupedBy.length > 0 && !isTreeData ? dataWithGroupHeaders : sortedData;
  }, [dataWithGroupHeaders, sortedData, state.groupedBy, isTreeData]);

  const paginatedData = React.useMemo(() => {
    if (virtualized) {
      return dataToPaginate;
    }
    const startIndex = (state.currentPage - 1) * state.pageSize;
    return dataToPaginate.slice(startIndex, startIndex + state.pageSize);
  }, [dataToPaginate, state.currentPage, state.pageSize, virtualized]);

  const totalPages = Math.ceil(dataToPaginate.length / state.pageSize);

  const { startIndex, endIndex, visibleRows } = React.useMemo(() => {
    if (!virtualized) {
      return { startIndex: 0, endIndex: paginatedData.length, visibleRows: paginatedData };
    }
    const buffer = 5;
    const sIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    const eIdx = Math.min(paginatedData.length, Math.ceil((scrollTop + (scrollContainerRef.current?.clientHeight || 500)) / rowHeight) + buffer);
    return {
      startIndex: sIdx,
      endIndex: eIdx,
      visibleRows: paginatedData.slice(sIdx, eIdx)
    };
  }, [virtualized, paginatedData, scrollTop, rowHeight]);


  const orderedVisibleColumnDefs = React.useMemo(() => {
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
  }, [colDefsMap, state.columnOrder, state.visibleColumns, state.pinnedColumns]);

  const getColumnWidth = React.useCallback((field: keyof TData & string): number => {
    const width = state.columnWidths[field] || colDefsMap.get(field)?.defaultWidth || DEFAULT_COL_WIDTH;
    return typeof width === 'number' ? width : parseInt(String(width), 10) || DEFAULT_COL_WIDTH;
  }, [state.columnWidths, colDefsMap]);

  const stickyOffsets = React.useMemo(() => {
    const left: Record<string, number> = {};
    let currentLeftOffset = 0;
    if (enableRowSelection) {
        currentLeftOffset += 50; 
    }
    state.pinnedColumns.left.forEach(field => {
      if (state.visibleColumns.includes(field)) {
        left[field] = currentLeftOffset;
        currentLeftOffset += getColumnWidth(field);
      }
    });

    const right: Record<string, number> = {};
    let currentRightOffset = 0;
    state.pinnedColumns.right.slice().reverse().forEach(field => {
       if (state.visibleColumns.includes(field)) {
        right[field] = currentRightOffset;
        currentRightOffset += getColumnWidth(field);
      }
    });
    return { left, right };
  }, [state.pinnedColumns, state.visibleColumns, getColumnWidth, enableRowSelection]);

  const isAllCurrentPageRowsSelected = paginatedData.length > 0 && paginatedData.filter(r => !r.isGroupHeader).every(row => state.selectedRows.has(row.id));


  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !state.editingCell) {
      const selectedProcessedRows = sortedData.filter(r => !r.isGroupHeader && state.selectedRows.has(r.id));
      let textToCopy = '';
      if (selectedProcessedRows.length > 0) {
        const header = orderedVisibleColumnDefs.map(c => c.headerText).join('\t');
        const rows = selectedProcessedRows.map(r =>
          orderedVisibleColumnDefs.map(c => String(getCellValue(r, c.field) ?? '')).join('\t')
        );
        textToCopy = [header, ...rows].join('\n');
      } else if (state.focusedCell) {
        const focusedRow = paginatedData.find(r => r.id === state.focusedCell!.rowId);
        if (focusedRow) textToCopy = String(getCellValue(focusedRow, state.focusedCell.colField) ?? '');
      }
      if (textToCopy) {
        e.preventDefault();
        navigator.clipboard?.writeText(textToCopy);
      }
      return;
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
                const colDef = colDefsMap.get(focusedCell.colField);
                if (colDef?.editable) {
                    startEditingCell(focusedCell.rowId, focusedCell.colField);
                }
            }
           }
        }
        break;
      case 'Escape':
        if (state.focusedCell && !state.editingCell) {
        }
        break;
      default:
        return;
    }

    if ((nextRowId !== undefined && nextRowId !== focusedCell?.rowId) || (nextColField !== undefined && nextColField !== focusedCell?.colField)) {
        const finalRowId = nextRowId !== undefined ? nextRowId : focusedCell!.rowId;
        const finalColField = nextColField !== undefined ? nextColField : focusedCell!.colField;
        setState(prev => ({ ...prev, focusedCell: { rowId: finalRowId, colField: finalColField } }));
    } else if (!focusedCell && nextRowId !== undefined && nextColField !== undefined) { 
        setState(prev => ({ ...prev, focusedCell: { rowId: nextRowId!, colField: nextColField! } }));
    }
  };


  React.useEffect(() => {
    if (state.focusedCell && !state.editingCell && tableWrapperRef.current) {
      const cellId = `cell-${state.focusedCell.rowId}-${state.focusedCell.colField}`;
      const cellElement = document.getElementById(cellId);
      if (cellElement) {
         const cellRect = cellElement.getBoundingClientRect();
         const tableContainer = tableWrapperRef.current?.querySelector('.overflow-x-auto');

         if (tableContainer) {
            const containerRect = tableContainer.getBoundingClientRect();
            const isVisibleX = cellRect.left >= containerRect.left && cellRect.right <= containerRect.right;
            const isVisibleY = cellRect.top >= containerRect.top && cellRect.bottom <= containerRect.bottom; 

            if (!isVisibleX || !isVisibleY) {
                cellElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
         } else {
             cellElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
         }
      }
    }
  }, [state.focusedCell, state.editingCell, paginatedData]); 

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
      
    return cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
  };

  const checkboxColumnWidth = '50px';
  const groupedByColumns = state.groupedBy.map(field => colDefsMap.get(field)!).filter(Boolean);

  const computeAggregate = (items: ProcessedRow<TData>[], col: ColumnDefinition<TData>): string => {
    if (col.aggregate === 'count') return String(items.length);
    const nums = items
      .map(item => parseFloat(String(getCellValue(item, col.field))))
      .filter(n => !isNaN(n));
    if (nums.length === 0) return '';
    let result: number;
    switch (col.aggregate) {
      case 'sum': result = nums.reduce((a, b) => a + b, 0); break;
      case 'avg': result = nums.reduce((a, b) => a + b, 0) / nums.length; break;
      case 'min': result = Math.min(...nums); break;
      case 'max': result = Math.max(...nums); break;
      default: return '';
    }
    return result.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

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
    >
      {enableGroupingPanel && !isTreeData && (
        <DataGridGroupingPanel
          groupedColumns={groupedByColumns as ColumnDefinition<TData>[]}
          allColumnsMap={colDefsMap as Map<keyof TData & string, ColumnDefinition<TData>>}
          onUngroupColumn={handleUngroupColumn}
          onDropColumn={handleGroupColumn}
        />
      )}
      <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <Input
          placeholder={globalFilterPlaceholder}
          value={state.globalFilter}
          onChange={handleGlobalFilterChange}
          className="max-w-xs h-9"
          aria-label="Global search input"
        />
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearAllFilters}>
              <FilterX className="mr-2 h-4 w-4" />
              Clear filters ({activeFilterCount})
            </Button>
          )}
          <ColumnVisibilityToggle
            allColumns={processedColumnDefs}
            visibleColumns={state.visibleColumns}
            onVisibilityChange={handleColumnVisibilityChange}
          />
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
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={cn(
          "overflow-x-auto relative",
          virtualized && "overflow-y-auto max-h-[500px]"
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              {enableRowSelection && (
                <TableHead
                  className="px-0 py-0 sticky-header-cell top-0"
                  style={{
                    width: checkboxColumnWidth,
                    minWidth: checkboxColumnWidth,
                    left: 0,
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
              {orderedVisibleColumnDefs.map((colDef) => {
                const isDraggableForReorder = colDef.reorderable !== false && !state.pinnedColumns.left.includes(colDef.field) && !state.pinnedColumns.right.includes(colDef.field);
                const currentWidth = state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`;
                const isLeftPinned = state.pinnedColumns.left.includes(colDef.field);
                const isRightPinned = state.pinnedColumns.right.includes(colDef.field);
                const isGrouped = state.groupedBy.includes(colDef.field);


                let stickyStyle: React.CSSProperties = {};
                if (isLeftPinned) {
                  stickyStyle.left = `${stickyOffsets.left[colDef.field] || 0}px`;
                } else if (isRightPinned) {
                  stickyStyle.right = `${stickyOffsets.right[colDef.field] || 0}px`;
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
                      "px-0 py-0 sticky top-0 bg-card z-20",
                      (isLeftPinned || isRightPinned) && "sticky-header-cell",
                      isLeftPinned && state.pinnedColumns.left.length > 0 && "pinned-left-shadow",
                      isRightPinned && state.pinnedColumns.right.length > 0 && "pinned-right-shadow",
                      isGrouped && "bg-muted/70"
                    )}
                    onDragOver={(e) => isDraggableForReorder && handleDragOverReorder(e, colDef.field)}
                    onDragLeave={() => isDraggableForReorder && handleDragLeaveReorder()}
                    onDrop={(e) => isDraggableForReorder && handleDropReorder(colDef.field, e)}
                    onDragEnd={() => (isDraggableForReorder || (enableGroupingPanel && colDef.groupable !== false)) && handleDragEndColumn()}
                    data-is-dragged={state.draggedColumn === colDef.field}
                    data-is-drop-target={state.draggedOverColumn === colDef.field && state.draggedColumn !== colDef.field}
                  >
                    <DataGridHeaderCell
                      column={colDef}
                      sortConfig={state.sortConfig}
                      onSort={handleSort}
                      onFilterChange={handleColumnFilterChange}
                      columnFilters={state.columnFilters}
                      currentWidth={currentWidth}
                      onColumnWidthChange={handleColumnWidthChange}
                      onPinColumn={handlePinColumn}
                      isDraggableForReorder={isDraggableForReorder && !isGrouped}
                      isDraggableForGrouping={enableGroupingPanel && colDef.groupable !== false && !isGrouped && !isTreeData}
                      currentPinnedState={
                        isLeftPinned ? 'left' : isRightPinned ? 'right' : null
                      }
                      onDragStartColumn={handleDragStartColumn}
                    />
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {virtualized && startIndex > 0 && (
              <TableRow style={{ height: `${startIndex * rowHeight}px` }} className="hover:bg-transparent">
                <TableCell 
                  colSpan={orderedVisibleColumnDefs.length + (enableRowSelection ? 1 : 0)} 
                  className="p-0 border-0" 
                  style={{ height: `${startIndex * rowHeight}px` }}
                />
              </TableRow>
            )}
            {visibleRows.length > 0 ? (
              visibleRows.map((row) => {
                if (row.isGroupHeader) {
                  const groupColDef = colDefsMap.get(row.groupField as keyof TData & string);
                  const groupHeaderText = groupColDef ? groupColDef.headerText : String(row.groupField);
                  return (
                    <TableRow key={row.id} className="group-header-row">
                      <TableCell 
                        colSpan={orderedVisibleColumnDefs.length + (enableRowSelection ? 1 : 0)}
                        className="px-3 py-2 cursor-pointer"
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
                                return aggValue ? ` · ${aggregateLabels[c.aggregate!]} ${c.headerText}: ${aggValue}` : '';
                              })
                              .join('')})
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }
                const rowStyle = getRowStyle?.(row.originalRow);
                // Pinned cells paint an opaque bg-card; carry a row background onto them
                // so the row color is not masked while horizontally scrolling.
                const pinnedCellBg = rowStyle?.backgroundColor
                  ? { backgroundColor: rowStyle.backgroundColor }
                  : undefined;
                return (
                  <TableRow
                    key={row.id}
                    data-state={state.selectedRows.has(row.id) ? "selected" : ""}
                    className={cn(state.selectedRows.has(row.id) && "bg-muted/50")}
                    style={rowStyle}
                  >
                    {enableRowSelection && (
                      <TableCell
                        className="px-3 py-2 sticky-body-cell"
                        style={{
                          left: 0,
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
                    {orderedVisibleColumnDefs.map((colDef) => {
                       const isLeftPinned = state.pinnedColumns.left.includes(colDef.field);
                       const isRightPinned = state.pinnedColumns.right.includes(colDef.field);
                       let stickyStyle: React.CSSProperties = {};
                        if (isLeftPinned) {
                          stickyStyle.left = `${stickyOffsets.left[colDef.field] || 0}px`;
                          if (pinnedCellBg) Object.assign(stickyStyle, pinnedCellBg);
                        } else if (isRightPinned) {
                          stickyStyle.right = `${stickyOffsets.right[colDef.field] || 0}px`;
                          if (pinnedCellBg) Object.assign(stickyStyle, pinnedCellBg);
                        }
                        const isFocused = state.focusedCell?.rowId === row.id && state.focusedCell?.colField === colDef.field;

                      return (
                      <TableCell
                        key={colDef.field}
                        id={`cell-${row.id}-${colDef.field}`}
                        data-field={colDef.field}
                        className={cn(
                          "px-3 py-2 truncate",
                          colDef.editable && "cursor-pointer",
                          (isLeftPinned || isRightPinned) && "sticky-body-cell",
                          isLeftPinned && state.pinnedColumns.left.length > 0 && "pinned-left-shadow",
                          isRightPinned && state.pinnedColumns.right.length > 0 && "pinned-right-shadow",
                          isFocused && !state.editingCell && "cell-focused"
                          )}
                        style={{
                          width: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`,
                          maxWidth: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`,
                          ...stickyStyle
                        }}
                        title={String(getCellValue(row, colDef.field))}
                        onClick={() => handleCellClick(row.id, colDef.field)}
                        onDoubleClick={() => colDef.editable && startEditingCell(row.id, colDef.field)}
                      >
                        {renderCellContent(row, colDef)}
                      </TableCell>
                    )}
                    )}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={orderedVisibleColumnDefs.length + (enableRowSelection ? 1 : 0)} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
            {virtualized && endIndex < paginatedData.length && (
              <TableRow style={{ height: `${(paginatedData.length - endIndex) * rowHeight}px` }} className="hover:bg-transparent">
                <TableCell 
                  colSpan={orderedVisibleColumnDefs.length + (enableRowSelection ? 1 : 0)} 
                  className="p-0 border-0" 
                  style={{ height: `${(paginatedData.length - endIndex) * rowHeight}px` }}
                />
              </TableRow>
            )}
          </TableBody>
          {renderedRowsCount > 0 && (
            <TableFooter>
              {orderedVisibleColumnDefs.some(col => col.aggregate) && (
                <TableRow className="bg-muted/30 font-semibold border-t">
                  {enableRowSelection && (
                    <TableCell
                      className="px-3 py-2 sticky-body-cell"
                      style={{
                        left: 0,
                        zIndex: 11
                      }}
                    >
                      Total
                    </TableCell>
                  )}
                  {orderedVisibleColumnDefs.map((colDef) => {
                    const isLeftPinned = state.pinnedColumns.left.includes(colDef.field);
                    const isRightPinned = state.pinnedColumns.right.includes(colDef.field);
                    let stickyStyle: React.CSSProperties = {};
                    if (isLeftPinned) {
                      stickyStyle.left = `${stickyOffsets.left[colDef.field] || 0}px`;
                    } else if (isRightPinned) {
                      stickyStyle.right = `${stickyOffsets.right[colDef.field] || 0}px`;
                    }

                    const hasAggregate = !!colDef.aggregate;
                    const aggVal = hasAggregate ? computeAggregate(sortedData, colDef) : '';

                    return (
                      <TableCell
                        key={colDef.field}
                        className={cn(
                          "px-3 py-2 truncate",
                          (isLeftPinned || isRightPinned) && "sticky-body-cell",
                          isLeftPinned && state.pinnedColumns.left.length > 0 && "pinned-left-shadow",
                          isRightPinned && state.pinnedColumns.right.length > 0 && "pinned-right-shadow"
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
                              {aggregateLabels[colDef.aggregate!]}
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
                  colSpan={orderedVisibleColumnDefs.length + (enableRowSelection ? 1 : 0)} 
                  className="text-sm text-muted-foreground text-center"
                >
                  Displaying {renderedRowsCount} row{renderedRowsCount === 1 ? "" : "s"} on this page.
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
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
          totalItems={(state.groupedBy.length > 0 && !isTreeData ? dataWithGroupHeaders : sortedData).length}
          selectedRowsCount={state.selectedRows.size}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
}
