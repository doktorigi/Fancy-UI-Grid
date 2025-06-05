
"use client";
import * as React from 'react';
import type {
  ColumnDefinition,
  DataGridProps,
  DataGridState,
  FilterValue,
  HierarchicalData,
  ProcessedRow,
} from '@/types/data-grid';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DataGridHeaderCell } from './DataGridHeaderCell';
import { DataGridPagination } from './DataGridPagination';
import { ColumnVisibilityToggle } from './ColumnVisibilityToggle';
import { DataGridGroupingPanel } from './DataGridGroupingPanel';
import { cn, getCellValue } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToCsv, exportToXlsx } from '@/lib/exportUtils';
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
  isTreeData = false,
  treeColumn: specifiedTreeColumn,
  enableGroupingPanel = false, 
}: DataGridProps<TData>) {
  const tableWrapperRef = React.useRef<HTMLDivElement>(null);

  const [state, setState] = React.useState<DataGridState<TData>>(() => {
    const defaultWidths: Record<keyof TData & string, string | number> = {};
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
      const savedStateString = localStorage.getItem(LOCAL_STORAGE_KEY);
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

          setState(prevState => ({
            ...prevState,
            columnWidths: { ...prevState.columnWidths, ...(savedState.columnWidths || {}) },
            columnOrder: reconciledUnpinnedOrder,
            pinnedColumns: {
              left: reconciledPinnedLeft,
              right: reconciledPinnedRight
            },
            columnFilters: savedState.columnFilters || {},
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
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [
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
        const value = (row as any)[field];
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

  const processedColumnDefs = React.useMemo(() => {
    return initialColumnDefs.map(colDef => {
      if (colDef.filterable && colDef.filterType === 'select' && !colDef.filterOptions) {
        return {
          ...colDef,
          filterOptions: getUniqueColumnValues(colDef.field).map(val => ({ label: val, value: val }))
        };
      }
      return colDef;
    });
  }, [initialColumnDefs, getUniqueColumnValues]);

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
        ...item
      });
      if (hasChildren && isExpanded && item.children) {
        flatList = flatList.concat(flattenTreeData(item.children, expandedRows, level + 1));
      }
    });
    return flatList;
  }, []);

  const baseDataForProcessing = React.useMemo(() => {
    if (isTreeData) {
      return flattenTreeData(initialData || [], state.expandedRows);
    }
    return (initialData || []).map(item => ({
      originalRow: item,
      id: item.id,
      level: 0,
      hasChildren: false,
      isExpanded: false,
       ...item
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
      if (value === undefined || (typeof value.value === 'string' && value.value === '') || (value.type === 'number' && value.value === undefined) || (value.type === 'boolean' && value.value === undefined)) {
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
      const newGroupedBy = [field]; 
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
      const originalRow = baseDataForProcessing.find(r => r.id === rowId)?.originalRow;

      if (columnDef?.filterType === 'number' || (originalRow && typeof originalRow[field] === 'number')) {
        valueToCommit = parseFloat(state.editInputValue);
        if (isNaN(valueToCommit) && originalRow) {
          valueToCommit = originalRow[field]; 
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
            if (filter.type === 'boolean' && filter.value === undefined) return true;
            return false;
        }
        switch (filter.type) {
          case 'text':
            return String(cellValue).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'number':
            if (filter.value === undefined) return true;
            const numCell = parseFloat(String(cellValue));
            if (isNaN(numCell)) return false;
            switch (filter.operator) {
              case '=': return numCell === filter.value;
              case '!=': return numCell !== filter.value;
              case '<': return numCell < filter.value;
              case '>': return numCell > filter.value;
              case '<=': return numCell <= filter.value;
              case '>=': return numCell >= filter.value;
              default: return true;
            }
          case 'date':
            if (!filter.value) return true;
            try {
              const dateCell = new Date(String(cellValue));
               if (isNaN(dateCell.getTime())) return false;
              const filterDateNormalized = new Date(filter.value);
              filterDateNormalized.setHours(0,0,0,0);
              dateCell.setHours(0,0,0,0);
              return dateCell.getTime() === filterDateNormalized.getTime();
            } catch (e) {
              return false;
            }
          case 'select':
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
  }, [baseDataForProcessing, state.globalFilter, state.columnFilters, processedColumnDefs, state.visibleColumns]);

  const sortedData = React.useMemo(() => {
    const dataToSort = [...filteredData];
    const { groupedBy, sortConfig } = state;

    if (groupedBy.length > 0 && !isTreeData) { // Group sorting only if not tree data
      const groupField = groupedBy[0]; 
      const groupColDef = colDefsMap.get(groupField);
      dataToSort.sort((a, b) => {
        const valA = getCellValue(a, groupField);
        const valB = getCellValue(b, groupField);
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;
        if (groupColDef?.filterType === 'date') {
          const dateA = new Date(String(valA)).getTime();
          const dateB = new Date(String(valB)).getTime();
          if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
        }
        return String(valA).localeCompare(String(valB));
      });
    }
    
    if (!sortConfig) return dataToSort;
    const { field, direction } = sortConfig;
    const colDef = colDefsMap.get(field);
    if (!colDef) return dataToSort;

    return dataToSort.sort((a, b) => {
      if (groupedBy.length > 0 && !isTreeData) {
        const groupField = groupedBy[0];
        const groupValA = getCellValue(a, groupField);
        const groupValB = getCellValue(b, groupField);
        if (groupValA !== groupValB) {
          if (groupValA === null || groupValA === undefined) return 1;
          if (groupValB === null || groupValB === undefined) return -1;
          return String(groupValA).localeCompare(String(groupValB));
        }
      }

      const valA = getCellValue(a, field);
      const valB = getCellValue(b, field);
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
  }, [filteredData, state.sortConfig, state.groupedBy, colDefsMap, isTreeData]);

  const dataWithGroupHeaders = React.useMemo(() => {
    if (state.groupedBy.length === 0 || isTreeData) { 
      return sortedData;
    }
    const groupField = state.groupedBy[0];
    const groupedResult: ProcessedRow<TData>[] = [];
    let currentGroupValue: any = undefined;
    let currentGroupItems: ProcessedRow<TData>[] = [];

    sortedData.forEach((row, index) => {
      const rowGroupValue = getCellValue(row, groupField);
      if (index === 0 || rowGroupValue !== currentGroupValue) {
        if (currentGroupItems.length > 0 && currentGroupValue !== undefined) {
          const groupKey = `${groupField}:${currentGroupValue}`;
           groupedResult.push({
            id: `group-header-${groupKey}`,
            originalRow: {} as TData, 
            level: 0, 
            hasChildren: true, 
            isGroupHeader: true,
            groupKey: groupKey,
            groupField: groupField,
            groupValue: currentGroupValue,
            isExpanded: state.expandedGroups.has(groupKey),
          } as ProcessedRow<TData>);
          if (state.expandedGroups.has(groupKey)) {
             groupedResult.push(...currentGroupItems);
          }
          currentGroupItems = [];
        }
        currentGroupValue = rowGroupValue;
      }
      currentGroupItems.push(row);
    });

    if (currentGroupItems.length > 0 && currentGroupValue !== undefined) {
      const groupKey = `${groupField}:${currentGroupValue}`;
      groupedResult.push({
        id: `group-header-${groupKey}`,
        originalRow: {} as TData,
        level: 0,
        hasChildren: true,
        isGroupHeader: true,
        groupKey: groupKey,
        groupField: groupField,
        groupValue: currentGroupValue,
        isExpanded: state.expandedGroups.has(groupKey),
      } as ProcessedRow<TData>);
       if (state.expandedGroups.has(groupKey)) {
        groupedResult.push(...currentGroupItems);
      }
    }
    return groupedResult;
  }, [sortedData, state.groupedBy, state.expandedGroups, isTreeData]);


  const paginatedData = React.useMemo(() => {
    const dataToPaginate = state.groupedBy.length > 0 && !isTreeData ? dataWithGroupHeaders : sortedData;
    const startIndex = (state.currentPage - 1) * state.pageSize;
    return dataToPaginate.slice(startIndex, startIndex + state.pageSize);
  }, [sortedData, dataWithGroupHeaders, state.currentPage, state.pageSize, state.groupedBy, isTreeData]);

  const totalPages = Math.ceil((state.groupedBy.length > 0 && !isTreeData ? dataWithGroupHeaders : sortedData).length / state.pageSize);


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
            } else if (enableGroupingPanel && focusedRow.isGroupHeader) {
                handleToggleExpandGroup(focusedRow.groupKey!);
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
            } else if (enableGroupingPanel && focusedRow.isGroupHeader && e.key === 'Enter') {
                 handleToggleExpandGroup(focusedRow.groupKey!);
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
          // Could blur grid or clear focus here if desired.
          // For now, escape primarily handles canceling edits.
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
            // Check if cell is outside the visible viewport of the scrollable container
            const isVisibleX = cellRect.left >= containerRect.left && cellRect.right <= containerRect.right;
            const isVisibleY = cellRect.top >= containerRect.top && cellRect.bottom <= containerRect.bottom; // Assuming vertical scroll eventually

            if (!isVisibleX || !isVisibleY) {
                cellElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
         } else {
             // Fallback if the specific container isn't found, scroll within window
             cellElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
         }
      }
    }
  }, [state.focusedCell, state.editingCell, paginatedData]); // Re-run when paginatedData changes, as focused cell might be on a new page

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
      const inputType = colDef?.filterType === 'number' || typeof cellValue === 'number' ? 'number' : 'text';
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

    const content = (() => {
      if (col.field === 'age') {
        return <span className="text-right w-full block">{cellValue}</span>;
      }
      if (col.field === 'isActive') {
        return (
          <Badge variant={cellValue ? 'default' : 'secondary'} className={cn(cellValue ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600', "text-white")}>
            {cellValue ? 'Yes' : 'No'}
          </Badge>
        );
      }
      if (col.field === 'registrationDate') {
        try {
          return new Date(String(cellValue)).toLocaleDateString();
        } catch (e) {
          return String(cellValue);
        }
      }
      if (col.field === 'progress') {
        return (
          <div className="flex items-center">
            <div className="w-full bg-muted rounded-full h-2.5 mr-2">
              <div className="bg-primary h-2.5 rounded-full" style={{ width: `${cellValue}%` }}></div>
            </div>
            <span className="text-sm">{cellValue}%</span>
          </div>
        );
      }
      return String(cellValue);
    })();

    if (isTreeData && treeColumn && col.field === treeColumn) {
      return (
        <div className="flex items-center" style={{ paddingLeft: `${row.level * 1.5}rem` }}>
          {row.hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpandRow(row.id);
              }}
              className="mr-1 p-0.5 rounded hover:bg-accent focus:outline-none"
              aria-label={row.isExpanded ? "Collapse row" : "Expand row"}
              tabIndex={-1} // Not focusable with Tab, handled by grid nav
            >
              {row.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            // Placeholder for alignment if no children
            <span style={{ width: '1.25rem' }} className="mr-1 inline-block"></span>
          )}
          {content}
        </div>
      );
    }
    return content;
  };

  const checkboxColumnWidth = '50px';
  const groupedByColumns = state.groupedBy.map(field => colDefsMap.get(field)!).filter(Boolean);

  const handleExportCsv = () => {
    const dataToExport = sortedData.filter(row => !row.isGroupHeader);
    exportToCsv(dataToExport, orderedVisibleColumnDefs, 'grid_export');
  };

  const handleExportXlsx = () => {
    const dataToExport = sortedData.filter(row => !row.isGroupHeader);
    exportToXlsx(dataToExport, orderedVisibleColumnDefs, 'grid_export');
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
          groupedColumns={groupedByColumns}
          allColumnsMap={colDefsMap}
          onUngroupColumn={handleUngroupColumn}
          onDropColumn={handleGroupColumn}
        />
      )}
      <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <Input
          placeholder="Search all columns..."
          value={state.globalFilter}
          onChange={handleGlobalFilterChange}
          className="max-w-xs h-9"
          aria-label="Global search input"
        />
        <div className="flex items-center gap-2">
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
      <div className="overflow-x-auto relative">
        <Table>
          <TableHeader>
            <TableRow>
              {enableRowSelection && (
                <TableHead
                  className="px-0 py-0 sticky-header-cell"
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
                    style={{
                      width: currentWidth,
                      minWidth: colDef.minWidth || currentWidth || '50px',
                      ...stickyStyle
                    }}
                    className={cn(
                      "px-0 py-0 relative",
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
            {paginatedData.length > 0 ? (
              paginatedData.map((row) => {
                if (row.isGroupHeader) {
                  const groupColDef = colDefsMap.get(row.groupField as keyof TData & string);
                  const groupHeaderText = groupColDef ? groupColDef.headerText : row.groupField;
                  return (
                    <TableRow key={row.id} className="group-header-row">
                      <TableCell 
                        colSpan={orderedVisibleColumnDefs.length + (enableRowSelection ? 1 : 0)}
                        className="px-3 py-2 cursor-pointer"
                        onClick={() => handleToggleExpandGroup(row.groupKey!)}
                      >
                        <div className="flex items-center">
                           <button
                              className="mr-1 p-0.5 rounded hover:bg-accent focus:outline-none"
                              aria-label={row.isExpanded ? `Collapse group ${row.groupValue}` : `Expand group ${row.groupValue}`}
                            >
                              {row.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          <strong>{groupHeaderText}:</strong> {String(row.groupValue)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }
                return (
                  <TableRow
                    key={row.id}
                    data-state={state.selectedRows.has(row.id) ? "selected" : ""}
                    className={cn(state.selectedRows.has(row.id) && "bg-muted/50")}
                  >
                    {enableRowSelection && (
                      <TableCell
                        className="px-3 py-2 sticky-body-cell"
                        style={{
                          left: 0,
                          zIndex: 11 
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
                        } else if (isRightPinned) {
                          stickyStyle.right = `${stickyOffsets.right[colDef.field] || 0}px`;
                        }
                        const isFocused = state.focusedCell?.rowId === row.id && state.focusedCell?.colField === colDef.field;

                      return (
                      <TableCell
                        key={colDef.field}
                        id={`cell-${row.id}-${colDef.field}`}
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
          </TableBody>
        </Table>
      </div>
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
    </div>
  );
}
