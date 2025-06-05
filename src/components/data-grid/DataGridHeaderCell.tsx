
import * as React from 'react';
import type { ColumnDefinition, SortConfig, FilterValue, ActiveFilters } from '@/types/data-grid';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DataGridFilterPopover } from './DataGridFilterPopover';
import { ArrowDown, ArrowUp, Filter, Users, Mail, CalendarDays, Hash, Edit3, Activity, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
// Label and FilterX imports removed as their functionality is now fully within DataGridFilterPopover

interface DataGridHeaderCellProps<TData> {
  column: ColumnDefinition<TData>;
  sortConfig: SortConfig<TData> | null;
  onSort: (field: keyof TData & string) => void;
  onFilterChange: (field: keyof TData & string, value?: FilterValue) => void;
  columnFilters: ActiveFilters<TData>;
  // uniqueColumnValues prop removed
}

const iconMap: { [key: string]: LucideIcon } = {
  Users,
  Mail,
  CalendarDays,
  Hash,
  Edit3,
  Activity,
};

export function DataGridHeaderCell<TData>({
  column,
  sortConfig,
  onSort,
  onFilterChange,
  columnFilters,
}: DataGridHeaderCellProps<TData>) {
  const isSorted = sortConfig?.field === column.field;
  const isFiltered = !!columnFilters[column.field];

  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = React.useState(false);

  const IconComponent = column.iconName ? iconMap[column.iconName] : null;

  const headerContent = column.headerRenderer ? (
    column.headerRenderer()
  ) : (
    <span className="truncate">{column.headerText}</span>
  );

  return (
    <div className="flex items-center justify-between group py-2 pr-2">
      <div className="flex items-center flex-grow min-w-0">
        {IconComponent && <IconComponent className="mr-2 h-4 w-4 text-muted-foreground" />}
        {column.sortable ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSort(column.field)}
            className="h-auto px-1 py-0.5 -ml-1 text-left font-semibold flex-grow justify-start hover:bg-accent"
            aria-label={`Sort by ${column.headerText}`}
          >
            {headerContent}
            {isSorted && sortConfig?.direction === 'asc' && <ArrowUp className="ml-2 h-4 w-4" />}
            {isSorted && sortConfig?.direction === 'desc' && <ArrowDown className="ml-2 h-4 w-4" />}
          </Button>
        ) : (
          <div className="px-1 py-0.5 font-semibold flex-grow min-w-0">{headerContent}</div>
        )}
      </div>

      <div className="flex items-center space-x-1">
        {column.filterable && column.filterType && (
           <Popover open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 opacity-50 hover:opacity-100 focus:opacity-100",
                  isFiltered && "opacity-100 bg-accent text-accent-foreground",
                  isFilterPopoverOpen && "opacity-100 bg-accent text-accent-foreground"
                )}
                aria-label={`Filter ${column.headerText}`}
              >
                <Filter className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" side="bottom" align="start">
              <DataGridFilterPopover
                column={column}
                filterValue={columnFilters[column.field]}
                onFilterChange={(field, value) => {
                  onFilterChange(field, value);
                  setIsFilterPopoverOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
