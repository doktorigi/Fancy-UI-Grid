import * as React from 'react';
import type { ColumnDefinition, SortConfig, FilterValue, ActiveFilters } from '@/types/data-grid';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DataGridFilterPopover } from './DataGridFilterPopover';
import { ArrowDown, ArrowUp, Filter, Users, Mail, CalendarDays, Hash, Edit3, Activity, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label'; // Added Label import
import { FilterX } from 'lucide-react'; // Added FilterX import

interface DataGridHeaderCellProps<TData> {
  column: ColumnDefinition<TData>;
  sortConfig: SortConfig<TData> | null;
  onSort: (field: keyof TData & string) => void;
  onFilterChange: (field: keyof TData & string, value?: FilterValue) => void;
  columnFilters: ActiveFilters<TData>;
  uniqueColumnValues?: string[];
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
  uniqueColumnValues,
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

  const filterPopoverContent = (
    <DataGridFilterPopover
      column={column}
      filterValue={columnFilters[column.field]}
      onFilterChange={(field, value) => {
        onFilterChange(field, value);
        setIsFilterPopoverOpen(false); // Close popover on filter change
      }}
      uniqueColumnValues={uniqueColumnValues}
    />
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
            <PopoverContent className="w-64 p-0 border-none shadow-none bg-transparent" side="bottom" align="start">
               <div className="p-4 border rounded-md shadow-lg bg-popover text-popover-foreground">
                <div className="space-y-4">
                  <Label className="font-semibold">{column.headerText} Filter</Label>
                  {/* Directly render the content part of DataGridFilterPopover */}
                  {(filterPopoverContent.props.children as React.ReactElement)?.props?.children[1]}
                  {columnFilters[column.field] && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onFilterChange(column.field, undefined);
                        setIsFilterPopoverOpen(false);
                      }}
                      className="w-full mt-2"
                    >
                      <FilterX className="mr-2 h-4 w-4" /> Clear Filter
                    </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
