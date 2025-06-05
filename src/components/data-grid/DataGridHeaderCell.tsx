
import * as React from 'react';
import type { ColumnDefinition, SortConfig, FilterValue, ActiveFilters } from '@/types/data-grid';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataGridFilterPopover } from './DataGridFilterPopover';
import { ArrowDown, ArrowUp, Filter, Users, Mail, CalendarDays, Hash, Edit3, Activity, Pin, PinOff, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataGridHeaderCellProps<TData> {
  column: ColumnDefinition<TData>;
  sortConfig: SortConfig<TData> | null;
  onSort: (field: keyof TData & string) => void;
  onFilterChange: (field: keyof TData & string, value?: FilterValue) => void;
  columnFilters: ActiveFilters<TData>;
  currentWidth: string | number;
  onColumnWidthChange: (field: keyof TData & string, newWidth: number) => void;
  onPinColumn: (field: keyof TData & string, position: 'left' | 'right' | null) => void;
  isDraggableForReorder?: boolean; // For column reordering
  isDraggableForGrouping?: boolean; // For column grouping
  currentPinnedState?: 'left' | 'right' | null;
  onDragStartColumn: (field: keyof TData & string, event: React.DragEvent) => void; // Generic drag start
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
  onColumnWidthChange,
  onPinColumn,
  isDraggableForReorder,
  isDraggableForGrouping,
  currentPinnedState,
  onDragStartColumn,
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

  const handleMouseDownOnResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation(); 

    const thElement = (event.target as HTMLElement).closest('th');
    if (!thElement) return;

    const startX = event.clientX;
    const startWidth = parseFloat(String(thElement.style.width || thElement.offsetWidth));
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      const minW = parseFloat(String(column.minWidth || 50)); 
      onColumnWidthChange(column.field, Math.max(minW, newWidth));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const isResizable = column.resizable !== false;
  // A column can be dragged for reordering OR grouping (or both, if enabled)
  const isDraggable = isDraggableForReorder || (isDraggableForGrouping && column.groupable !== false);
  const canPin = column.reorderable !== false; 

  return (
    <div 
      className={cn(
        "flex items-center justify-between group py-2 pr-2 h-full w-full",
        isDraggable && "cursor-grab"
      )}
      style={{ position: 'relative' }} 
      draggable={isDraggable} // Enable draggable attribute on this div
      onDragStart={(e) => isDraggable && onDragStartColumn(column.field, e)}
    >
      {isDraggable && (
         <GripVertical className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 cursor-grab mr-1 shrink-0" />
      )}
      <div className="flex items-center flex-grow min-w-0">
        {IconComponent && <IconComponent className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />}
        {column.sortable ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSort(column.field)}
            className="h-auto px-1 py-0.5 -ml-1 text-left font-semibold flex-grow justify-start hover:bg-accent"
            aria-label={`Sort by ${column.headerText}`}
          >
            {headerContent}
            {isSorted && sortConfig?.direction === 'asc' && <ArrowUp className="ml-2 h-4 w-4 shrink-0" />}
            {isSorted && sortConfig?.direction === 'desc' && <ArrowDown className="ml-2 h-4 w-4 shrink-0" />}
          </Button>
        ) : (
          <div className="px-1 py-0.5 font-semibold flex-grow min-w-0">{headerContent}</div>
        )}
      </div>

      <div className="flex items-center space-x-1 shrink-0">
        {canPin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 opacity-50 hover:opacity-100 focus:opacity-100",
                  currentPinnedState && "opacity-100 text-primary"
                )}
                aria-label={`Pin column ${column.headerText}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Pin className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom">
              <DropdownMenuItem 
                onClick={() => onPinColumn(column.field, 'left')}
                disabled={currentPinnedState === 'left'}
              >
                Pin Left
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onPinColumn(column.field, 'right')}
                disabled={currentPinnedState === 'right'}
              >
                Pin Right
              </DropdownMenuItem>
              {currentPinnedState && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onPinColumn(column.field, null)}>
                    <PinOff className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Unpin
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
                onClick={(e) => e.stopPropagation()} 
              >
                <Filter className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" side="bottom" align="start" onClick={(e) => e.stopPropagation()}>
              <DataGridFilterPopover
                column={column}
                filterValue={columnFilters[column.field]}
                onFilterChange={(field, value) => {
                  onFilterChange(field, value);
                  if (!value || (value.type === 'text' && value.value === '') || (value.type === 'number' && value.value === undefined)) {
                    // Keep popover open for text/number if cleared, otherwise close.
                  } else {
                    setIsFilterPopoverOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
      {isResizable && (
        <div
          className="resize-handle"
          onMouseDown={handleMouseDownOnResize}
          onClick={(e) => e.stopPropagation()} 
          aria-hidden="true"
        />
      )}
    </div>
  );
}
