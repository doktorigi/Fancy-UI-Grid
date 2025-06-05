
"use client";
import * as React from 'react';
import type {
  ColumnDefinition,
  DataGridProps,
  DataGridState,
  FilterValue,
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

const getCellValue = <TData,>(row: TData, field: keyof TData & string): any => {
  return row[field];
};

export function DataGrid<TData extends { id: string | number }>({
  data: initialData,
  columnDefs: initialColumnDefs, 
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  enableRowSelection = true,
  onCellEdit,
}: DataGridProps<TData>) {
  const [state, setState] = React.useState<DataGridState<TData>>(() => {
    const defaultWidths: Record<keyof TData & string, string | number> = {};
    initialColumnDefs.forEach(col => {
      defaultWidths[col.field] = col.defaultWidth || '150px';
    });
    return {
      currentPage: 1,
      pageSize: defaultPageSize,
      sortConfig: null,
      globalFilter: '',
      columnFilters: {},
      visibleColumns: initialColumnDefs.map((col) => col.field),
      selectedRows: new Set<string | number>(),
      columnOrder: initialColumnDefs.map(col => col.field),
      columnWidths: defaultWidths,
      draggedColumn: null,
      draggedOverColumn: null,
      editingCell: null,
      editInputValue: '',
    };
  });

  const getUniqueColumnValues = React.useCallback((field: keyof TData & string): string[] => {
    if (!initialData) return [];
    const uniqueValues = new Set<string>();
    initialData.forEach(row => {
      const value = getCellValue(row, field);
      if (value !== undefined && value !== null) {
        uniqueValues.add(String(value));
      }
    });
    return Array.from(uniqueValues).sort();
  }, [initialData]);

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
      setState(prevState => ({ ...prevState, draggedOverColumn: targetField }));
    }
  };

  const handleDragLeave = () => {
    setState(prevState => ({ ...prevState, draggedOverColumn: null }));
  };
  
  const handleDrop = (targetField: keyof TData & string, event: React.DragEvent) => {
    event.preventDefault();
    document.body.classList.remove('dragging');
    const sourceField = state.draggedColumn;
  
    if (sourceField && sourceField !== targetField) {
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
      if (columnDef?.filterType === 'number' || typeof getCellValue(initialData.find(r => r.id === rowId)!, field) === 'number') {
        valueToCommit = parseFloat(state.editInputValue);
        if (isNaN(valueToCommit)) {
          valueToCommit = getCellValue(initialData.find(r => r.id === rowId)!, field); // Revert if not a number
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
    if (!initialData) return [];
    let dataToFilter = [...initialData];

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
  }, [initialData, state.globalFilter, state.columnFilters, processedColumnDefs, state.visibleColumns]);

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
      if (valA instanceof Date && valB instanceof Date) {
        return direction === 'asc' ? valA.getTime() - valB.getTime() : valB.getTime() - valA.getTime();
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(String(valA));
      }
      return direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, state.sortConfig]);

  const paginatedData = React.useMemo(() => {
    const startIndex = (state.currentPage - 1) * state.pageSize;
    return sortedData.slice(startIndex, startIndex + state.pageSize);
  }, [sortedData, state.currentPage, state.pageSize]);

  const totalPages = Math.ceil(sortedData.length / state.pageSize);

  const visibleColumnDefs = React.useMemo(() => {
    const colDefsMap = new Map(processedColumnDefs.map(col => [col.field, col]));
    return state.columnOrder
      .filter(field => state.visibleColumns.includes(field))
      .map(field => colDefsMap.get(field)!)
      .filter(Boolean);
  }, [processedColumnDefs, state.columnOrder, state.visibleColumns]);

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

  const renderCellContent = (row: TData, col: ColumnDefinition<TData>): React.ReactNode => {
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
          className="h-full p-1 border-ring" // Adjust styling as needed
        />
      );
    }

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
  };

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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {enableRowSelection && (
                <TableHead className="w-[50px] px-3 py-2 align-top">
                  <Checkbox
                    checked={isAllCurrentPageRowsSelected}
                    onCheckedChange={(checked) => handleSelectAllRows(!!checked)}
                    aria-label="Select all rows on current page"
                    disabled={paginatedData.length === 0}
                  />
                </TableHead>
              )}
              {visibleColumnDefs.map((col) => {
                const isReorderable = col.reorderable !== false;
                return (
                  <TableHead
                    key={col.field}
                    style={{ 
                      width: state.columnWidths[col.field] || col.defaultWidth, 
                      minWidth: col.minWidth || state.columnWidths[col.field] || col.defaultWidth || '50px',
                    }}
                    className="px-0 py-0 relative" 
                    draggable={isReorderable}
                    onDragStart={(e) => isReorderable && handleDragStart(col.field, e)}
                    onDragOver={(e) => isReorderable && handleDragOver(e, col.field)}
                    onDragLeave={() => isReorderable && handleDragLeave()}
                    onDrop={(e) => isReorderable && handleDrop(col.field, e)}
                    onDragEnd={() => isReorderable && handleDragEnd()}
                    data-is-dragged={state.draggedColumn === col.field}
                    data-is-drop-target={state.draggedOverColumn === col.field && state.draggedColumn !== col.field}
                  >
                    <DataGridHeaderCell
                      column={col}
                      sortConfig={state.sortConfig}
                      onSort={handleSort}
                      onFilterChange={handleColumnFilterChange}
                      columnFilters={state.columnFilters}
                      currentWidth={state.columnWidths[col.field] || col.defaultWidth || '150px'}
                      onColumnWidthChange={handleColumnWidthChange}
                      isDraggable={isReorderable}
                    />
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <TableRow 
                  key={row.id ?? rowIndex}
                  data-state={state.selectedRows.has(row.id) ? "selected" : ""}
                  className={cn(state.selectedRows.has(row.id) && "bg-muted/50")}
                >
                  {enableRowSelection && (
                    <TableCell className="px-3 py-2">
                      <Checkbox
                        checked={state.selectedRows.has(row.id)}
                        onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                        aria-labelledby={`select-row-${row.id}`}
                        id={`select-row-${row.id}`}
                      />
                    </TableCell>
                  )}
                  {visibleColumnDefs.map((col) => (
                    <TableCell 
                      key={col.field} 
                      className={cn("px-3 py-2 truncate", col.editable && "cursor-pointer")}
                      style={{ 
                        width: state.columnWidths[col.field] || col.defaultWidth,
                        maxWidth: state.columnWidths[col.field] || col.defaultWidth, 
                      }}
                      title={String(getCellValue(row, col.field))}
                      onDoubleClick={() => col.editable && handleCellDoubleClick(row.id, col.field, getCellValue(row, col.field))}
                    >
                      {renderCellContent(row, col)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumnDefs.length + (enableRowSelection ? 1 : 0)} className="h-24 text-center">
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
