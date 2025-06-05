
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
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown } from 'lucide-react';

const getCellValue = <TData, PRow extends { originalRow: TData }>(row: PRow, field: keyof TData & string): any => {
  return row.originalRow[field];
};

const DEFAULT_COL_WIDTH = 150; // px

export function DataGrid<TData extends HierarchicalData<TData>>({
  data: initialData,
  columnDefs: initialColumnDefs, 
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  enableRowSelection = true,
  onCellEdit,
  isTreeData = false,
  treeColumn: specifiedTreeColumn,
}: DataGridProps<TData>) {
  const [state, setState] = React.useState<DataGridState<TData>>(() => {
    const defaultWidths: Record<keyof TData & string, string | number> = {};
    const initialPinnedLeft: (keyof TData & string)[] = [];
    const initialPinnedRight: (keyof TData & string)[] = [];
    const initialColumnOrder = initialColumnDefs.map(col => col.field);

    initialColumnDefs.forEach(col => {
      defaultWidths[col.field] = col.defaultWidth || `${DEFAULT_COL_WIDTH}px`;
      if (col.pinned === 'left') {
        initialPinnedLeft.push(col.field);
      } else if (col.pinned === 'right') {
        initialPinnedRight.push(col.field);
      }
    });
    
    const unpinnedColumnOrder = initialColumnOrder.filter(
      field => !initialPinnedLeft.includes(field) && !initialPinnedRight.includes(field)
    );

    return {
      currentPage: 1,
      pageSize: defaultPageSize,
      sortConfig: null,
      globalFilter: '',
      columnFilters: {},
      visibleColumns: initialColumnDefs.map((col) => col.field),
      selectedRows: new Set<string | number>(),
      columnOrder: unpinnedColumnOrder,
      columnWidths: defaultWidths,
      draggedColumn: null,
      draggedOverColumn: null,
      editingCell: null,
      editInputValue: '',
      pinnedColumns: { left: initialPinnedLeft, right: initialPinnedRight },
      expandedRows: new Set<string | number>(),
    };
  });

  const treeColumn = specifiedTreeColumn || (initialColumnDefs.length > 0 ? initialColumnDefs[0].field : undefined);

  const getUniqueColumnValues = React.useCallback((field: keyof TData & string): string[] => {
    if (!initialData) return [];
    const uniqueValues = new Set<string>();
    
    const traverse = (items: TData[]) => {
      items.forEach(row => {
        const value = (row as any)[field]; // Access original row directly
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
        ...item // Spread item properties for direct access if needed, careful with overrides
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
    // Wrap non-tree data in a similar structure for consistent processing
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
    setState((prevState) => ({ ...prevState, currentPage: page }));
  };

  const handlePageSizeChange = (size: number) => {
    setState((prevState) => ({ ...prevState, pageSize: size, currentPage: 1 }));
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
        paginatedData.forEach(row => newSelectedRows.add(row.id));
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
      return { ...prevState, expandedRows: newExpandedRows, currentPage: 1 }; // Reset to page 1 on expand/collapse
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

  const handleDragStart = (field: keyof TData & string, event: React.DragEvent) => {
    event.dataTransfer.setData('text/plain', field);
    document.body.classList.add('dragging');
    setState(prevState => ({ ...prevState, draggedColumn: field }));
  };
  
  const handleDragOver = (event: React.DragEvent, targetField: keyof TData & string) => {
    event.preventDefault(); 
    if (state.draggedColumn && state.draggedColumn !== targetField) {
       const isTargetPinned = state.pinnedColumns.left.includes(targetField) || state.pinnedColumns.right.includes(targetField);
       if (!isTargetPinned) { 
         setState(prevState => ({ ...prevState, draggedOverColumn: targetField }));
       }
    }
  };

  const handleDragLeave = () => {
    setState(prevState => ({ ...prevState, draggedOverColumn: null }));
  };
  
  const handleDrop = (targetField: keyof TData & string, event: React.DragEvent) => {
    event.preventDefault();
    document.body.classList.remove('dragging');
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
  
  const handleDragEnd = () => {
    document.body.classList.remove('dragging');
    setState(prevState => ({ ...prevState, draggedColumn: null, draggedOverColumn: null }));
  };

  const handlePinColumn = (field: keyof TData & string, position: 'left' | 'right' | null) => {
    setState(prevState => {
      const newPinnedLeft = [...prevState.pinnedColumns.left.filter(f => f !== field)];
      const newPinnedRight = [...prevState.pinnedColumns.right.filter(f => f !== field)];
      let newColumnOrder = [...prevState.columnOrder.filter(f => f !== field)];

      if (position === 'left') {
        newPinnedLeft.push(field);
      } else if (position === 'right') {
        newPinnedRight.push(field);
      } else { 
        if (!newColumnOrder.includes(field)) {
            const originalDef = initialColumnDefs.find(c => c.field === field);
            const originalIndex = initialColumnDefs.findIndex(c => c.field === field);
            // Attempt to insert at original relative position among unpinned columns
            let insertAtIndex = newColumnOrder.length; 
            for (let i = originalIndex + 1; i < initialColumnDefs.length; i++) {
                const nextOriginalCol = initialColumnDefs[i].field;
                const idxInOrder = newColumnOrder.indexOf(nextOriginalCol);
                if (idxInOrder !== -1) {
                    insertAtIndex = idxInOrder;
                    break;
                }
            }
             newColumnOrder.splice(insertAtIndex, 0, field);
        }
      }
      return {
        ...prevState,
        pinnedColumns: { left: newPinnedLeft, right: newPinnedRight },
        columnOrder: newColumnOrder,
      };
    });
  };


  const handleCellDoubleClick = (rowId: string | number, field: keyof TData & string, currentValue: any) => {
    const columnDef = processedColumnDefs.find(col => col.field === field);
    if (columnDef?.editable) {
      setState(prevState => ({
        ...prevState,
        editingCell: { rowId, field },
        editInputValue: currentValue,
      }));
    }
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
    if (!state.sortConfig) return filteredData;
    const { field, direction } = state.sortConfig;
    return [...filteredData].sort((a, b) => {
      const valA = getCellValue(a, field);
      const valB = getCellValue(b, field);
      if (valA === null || valA === undefined) return direction === 'asc' ? 1 : -1;
      if (valB === null || valB === undefined) return direction === 'asc' ? -1 : 1;
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return direction === 'asc' ? valA - valB : valB - valA;
      }
      // Attempt to parse as date if column type hints at it or values look like dates
      const colDef = processedColumnDefs.find(c => c.field === field);
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
  }, [filteredData, state.sortConfig, processedColumnDefs]);

  const paginatedData = React.useMemo(() => {
    const startIndex = (state.currentPage - 1) * state.pageSize;
    return sortedData.slice(startIndex, startIndex + state.pageSize);
  }, [sortedData, state.currentPage, state.pageSize]);

  const totalPages = Math.ceil(sortedData.length / state.pageSize);
  
  const colDefsMap = React.useMemo(() => new Map(processedColumnDefs.map(col => [col.field, col])), [processedColumnDefs]);

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


  const isAllCurrentPageRowsSelected = paginatedData.length > 0 && paginatedData.every(row => state.selectedRows.has(row.id));

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

    if (isTreeData && col.field === treeColumn) {
      return (
        <div className="flex items-center" style={{ paddingLeft: `${row.level * 1.5}rem` }}>
          {row.hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent row selection/other cell events
                handleToggleExpandRow(row.id);
              }}
              className="mr-1 p-0.5 rounded hover:bg-accent focus:outline-none"
              aria-label={row.isExpanded ? "Collapse row" : "Expand row"}
            >
              {row.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span style={{ width: '1.25rem' }} className="mr-1 inline-block"></span> // Placeholder for alignment
          )}
          {content}
        </div>
      );
    }
    return content;
  };
  
  const checkboxColumnWidth = '50px';


  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <Input
          placeholder="Search all columns..."
          value={state.globalFilter}
          onChange={handleGlobalFilterChange}
          className="max-w-xs h-9"
          aria-label="Global search input"
        />
        <ColumnVisibilityToggle
          allColumns={processedColumnDefs}
          visibleColumns={state.visibleColumns}
          onVisibilityChange={handleColumnVisibilityChange}
        />
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
                      disabled={paginatedData.length === 0}
                    />
                  </div>
                </TableHead>
              )}
              {orderedVisibleColumnDefs.map((colDef) => {
                const isReorderable = colDef.reorderable !== false && !state.pinnedColumns.left.includes(colDef.field) && !state.pinnedColumns.right.includes(colDef.field);
                const currentWidth = state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`;
                const isLeftPinned = state.pinnedColumns.left.includes(colDef.field);
                const isRightPinned = state.pinnedColumns.right.includes(colDef.field);
                
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
                      isRightPinned && state.pinnedColumns.right.length > 0 && "pinned-right-shadow"
                    )} 
                    draggable={isReorderable}
                    onDragStart={(e) => isReorderable && handleDragStart(colDef.field, e)}
                    onDragOver={(e) => isReorderable && handleDragOver(e, colDef.field)}
                    onDragLeave={() => isReorderable && handleDragLeave()}
                    onDrop={(e) => isReorderable && handleDrop(colDef.field, e)}
                    onDragEnd={() => isReorderable && handleDragEnd()}
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
                      isDraggable={isReorderable}
                      currentPinnedState={
                        isLeftPinned ? 'left' : isRightPinned ? 'right' : null
                      }
                    />
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row) => (
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

                    return (
                    <TableCell 
                      key={colDef.field} 
                      className={cn(
                        "px-3 py-2 truncate", 
                        colDef.editable && "cursor-pointer",
                        (isLeftPinned || isRightPinned) && "sticky-body-cell",
                        isLeftPinned && state.pinnedColumns.left.length > 0 && "pinned-left-shadow",
                        isRightPinned && state.pinnedColumns.right.length > 0 && "pinned-right-shadow"
                        )}
                      style={{ 
                        width: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`,
                        maxWidth: state.columnWidths[colDef.field] || colDef.defaultWidth || `${DEFAULT_COL_WIDTH}px`,
                        ...stickyStyle
                      }}
                      title={String(getCellValue(row, colDef.field))}
                      onDoubleClick={() => colDef.editable && handleCellDoubleClick(row.id, colDef.field, getCellValue(row, colDef.field))}
                    >
                      {renderCellContent(row, colDef)}
                    </TableCell>
                  )}
                  )}
                </TableRow>
              ))
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
        totalItems={sortedData.length}
        selectedRowsCount={state.selectedRows.size}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        pageSizeOptions={pageSizeOptions}
      />
    </div>
  );
}
