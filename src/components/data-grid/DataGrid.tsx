
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
}: DataGridProps<TData>) {
  const [state, setState] = React.useState<DataGridState<TData>>({
    currentPage: 1,
    pageSize: defaultPageSize,
    sortConfig: null,
    globalFilter: '',
    columnFilters: {},
    visibleColumns: initialColumnDefs.map((col) => col.field),
    selectedRows: new Set<string | number>(),
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

  const columnDefs = React.useMemo(() => {
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


  const filteredData = React.useMemo(() => {
    if (!initialData) return [];
    let dataToFilter = [...initialData];

    if (state.globalFilter) {
      const lowerGlobalFilter = state.globalFilter.toLowerCase();
      dataToFilter = dataToFilter.filter((row) =>
        columnDefs.some((col) => {
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
        
        // If cell value is null or undefined, it shouldn't match any filter unless the filter is specifically looking for empty values (not implemented here)
        if (cellValue === undefined || cellValue === null) {
             // Allow boolean filters to match if filter value is undefined (meaning "any")
            if (filter.type === 'boolean' && filter.value === undefined) return true;
            return false;
        }


        switch (filter.type) {
          case 'text':
            return String(cellValue).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'number':
            if (filter.value === undefined) return true; // No value to filter by
            const numCell = parseFloat(String(cellValue));
            if (isNaN(numCell)) return false; // Cell value is not a number
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
            if (!filter.value) return true; // No date to filter by
            try {
              const dateCell = new Date(String(cellValue));
               if (isNaN(dateCell.getTime())) return false; // Cell value is not a valid date
              // Normalize both dates to midnight to compare only date part
              const filterDateNormalized = new Date(filter.value);
              filterDateNormalized.setHours(0,0,0,0);
              dateCell.setHours(0,0,0,0);
              return dateCell.getTime() === filterDateNormalized.getTime();
            } catch (e) {
              return false; // Error parsing date
            }
          case 'select':
            return String(cellValue) === filter.value;
          case 'boolean':
            // If filter.value is undefined, it means "Any", so all rows pass for this filter
            if (filter.value === undefined) return true;
            return Boolean(cellValue) === filter.value;
          default:
            return true;
        }
      });
    });
    return dataToFilter;
  }, [initialData, state.globalFilter, state.columnFilters, columnDefs, state.visibleColumns]);

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
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      // Fallback for other types, convert to string for comparison
      return direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, state.sortConfig]);

  const paginatedData = React.useMemo(() => {
    const startIndex = (state.currentPage - 1) * state.pageSize;
    return sortedData.slice(startIndex, startIndex + state.pageSize);
  }, [sortedData, state.currentPage, state.pageSize]);

  const totalPages = Math.ceil(sortedData.length / state.pageSize);

  const visibleColumnDefs = React.useMemo(() => {
    return columnDefs.filter(col => state.visibleColumns.includes(col.field));
  }, [columnDefs, state.visibleColumns]);

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
        return String(cellValue); // Fallback if date is invalid
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
          allColumns={columnDefs}
          visibleColumns={state.visibleColumns}
          onVisibilityChange={handleColumnVisibilityChange}
        />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {enableRowSelection && (
                <TableHead className="w-[50px] px-3 py-2">
                  <Checkbox
                    checked={isAllCurrentPageRowsSelected}
                    onCheckedChange={(checked) => handleSelectAllRows(!!checked)}
                    aria-label="Select all rows on current page"
                    disabled={paginatedData.length === 0}
                  />
                </TableHead>
              )}
              {visibleColumnDefs.map((col) => (
                <TableHead
                  key={col.field}
                  style={{ 
                    width: col.defaultWidth, 
                    minWidth: col.minWidth || col.defaultWidth || '100px',
                  }}
                  className="px-3 py-0" // Reduced py for header cell internal padding
                >
                  <DataGridHeaderCell
                    column={col}
                    sortConfig={state.sortConfig}
                    onSort={handleSort}
                    onFilterChange={handleColumnFilterChange}
                    columnFilters={state.columnFilters}
                    // uniqueColumnValues prop removed
                  />
                </TableHead>
              ))}
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
                      className="px-3 py-2 truncate"
                      style={{ 
                        maxWidth: col.defaultWidth || '200px', 
                      }}
                      title={String(getCellValue(row, col.field))}
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

