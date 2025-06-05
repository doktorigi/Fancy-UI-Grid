import * as React from 'react';
import type { ColumnDefinition } from '@/types/data-grid';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ListFilter } from 'lucide-react';

interface ColumnVisibilityToggleProps<TData> {
  allColumns: ColumnDefinition<TData>[];
  visibleColumns: (keyof TData & string)[];
  onVisibilityChange: (field: keyof TData & string, isVisible: boolean) => void;
}

export function ColumnVisibilityToggle<TData>({
  allColumns,
  visibleColumns,
  onVisibilityChange,
}: ColumnVisibilityToggleProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <ListFilter className="mr-2 h-4 w-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allColumns
          .filter(col => col.hideable !== false) // Only show hideable columns
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.field}
              className="capitalize"
              checked={visibleColumns.includes(column.field)}
              onCheckedChange={(value) => onVisibilityChange(column.field, !!value)}
            >
              {column.headerText}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
