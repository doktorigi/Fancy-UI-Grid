import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import type { ColumnDefinition, FilterValue, NumberFilterOperator } from '@/types/data-grid';
import { numberFilterOperators } from '@/types/data-grid';
import { FilterX, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface DataGridFilterPopoverProps<TData> {
  column: ColumnDefinition<TData>;
  filterValue?: FilterValue;
  onFilterChange: (field: keyof TData & string, value?: FilterValue) => void;
  uniqueColumnValues?: string[]; // For select filter
}

export function DataGridFilterPopover<TData>({
  column,
  filterValue,
  onFilterChange,
  uniqueColumnValues,
}: DataGridFilterPopoverProps<TData>) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleClearFilter = () => {
    onFilterChange(column.field, undefined);
    setIsOpen(false);
  };

  const renderFilterContent = () => {
    switch (column.filterType) {
      case 'text':
        return (
          <Input
            type="text"
            placeholder={`Filter ${column.headerText}...`}
            value={(filterValue as FilterValue & { value: string })?.value || ''}
            onChange={(e) =>
              onFilterChange(column.field, { type: 'text', value: e.target.value })
            }
            className="w-full"
          />
        );
      case 'number':
        const numFilter = filterValue as FilterValue & { value?: number; operator: NumberFilterOperator };
        return (
          <div className="space-y-2">
            <Select
              value={numFilter?.operator || '='}
              onValueChange={(op) =>
                onFilterChange(column.field, {
                  type: 'number',
                  operator: op as NumberFilterOperator,
                  value: numFilter?.value,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                {numberFilterOperators.map((op) => (
                  <SelectItem key={op} value={op}>{op}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Value"
              value={numFilter?.value === undefined ? '' : numFilter.value}
              onChange={(e) =>
                onFilterChange(column.field, {
                  type: 'number',
                  operator: numFilter?.operator || '=',
                  value: e.target.value === '' ? undefined : parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
          </div>
        );
      case 'date':
        const dateFilter = filterValue as FilterValue & { value?: Date };
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal ${!dateFilter?.value && "text-muted-foreground"}`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFilter?.value ? format(dateFilter.value, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFilter?.value}
                onSelect={(date) => {
                  onFilterChange(column.field, { type: 'date', value: date || undefined });
                  // Potentially close popover after selection
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      case 'select':
        const selectFilter = filterValue as FilterValue & { value: string };
        const options = column.filterOptions || uniqueColumnValues?.map(val => ({ label: val, value: val })) || [];
        return (
          <Select
            value={selectFilter?.value || ''}
            onValueChange={(val) =>
              onFilterChange(column.field, { type: 'select', value: val })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${column.headerText}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'boolean':
        const boolFilter = filterValue as FilterValue & { value?: boolean };
        let boolValueString = '';
        if (boolFilter?.value === true) boolValueString = 'true';
        if (boolFilter?.value === false) boolValueString = 'false';

        return (
          <Select
            value={boolValueString}
            onValueChange={(val) => {
              let actualValue: boolean | undefined = undefined;
              if (val === 'true') actualValue = true;
              if (val === 'false') actualValue = false;
              onFilterChange(column.field, { type: 'boolean', value: actualValue });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  };

  if (!column.filterable || !column.filterType) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {/* This button is part of DataGridHeaderCell */}
        {/* It's just here to make the component self-contained for storybook/testing if needed */}
        {/* In actual use, the trigger will be the FilterIcon in DataGridHeaderCell */}
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-accent">
           {/* Filter Icon will be here */}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" side="bottom" align="start">
        <div className="space-y-4">
          <Label className="font-semibold">{column.headerText} Filter</Label>
          {renderFilterContent()}
          {filterValue && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilter}
              className="w-full mt-2"
            >
              <FilterX className="mr-2 h-4 w-4" /> Clear Filter
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
