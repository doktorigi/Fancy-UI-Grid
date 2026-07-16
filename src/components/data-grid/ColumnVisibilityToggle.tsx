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
  const hideableColumns = allColumns.filter(col => col.hideable !== false);
  const hasGroups = hideableColumns.some(col => col.group);

  // Preserve definition order while clustering each group's columns under one label.
  const sections = React.useMemo(() => {
    if (!hasGroups) return [{ group: undefined as string | undefined, columns: hideableColumns }];
    const byGroup = new Map<string | undefined, ColumnDefinition<TData>[]>();
    hideableColumns.forEach(col => {
      const key = col.group;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(col);
    });
    return Array.from(byGroup.entries()).map(([group, columns]) => ({ group, columns }));
  }, [hideableColumns, hasGroups]);

  const setGroupVisibility = (columns: ColumnDefinition<TData>[], isVisible: boolean) => {
    columns.forEach(col => {
      if (visibleColumns.includes(col.field) !== isVisible) {
        onVisibilityChange(col.field, isVisible);
      }
    });
  };

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
        {sections.map(({ group, columns }, sectionIndex) => {
          const visibleCount = columns.filter(col => visibleColumns.includes(col.field)).length;
          return (
            <React.Fragment key={group ?? `__ungrouped_${sectionIndex}`}>
              {group && (
                <DropdownMenuCheckboxItem
                  className="font-semibold"
                  checked={visibleCount === columns.length ? true : visibleCount > 0 ? 'indeterminate' : false}
                  onCheckedChange={(value) => setGroupVisibility(columns, !!value)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {group}
                </DropdownMenuCheckboxItem>
              )}
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.field}
                  className={group ? 'capitalize pl-8' : 'capitalize'}
                  checked={visibleColumns.includes(column.field)}
                  onCheckedChange={(value) => onVisibilityChange(column.field, !!value)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {column.headerText}
                </DropdownMenuCheckboxItem>
              ))}
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
