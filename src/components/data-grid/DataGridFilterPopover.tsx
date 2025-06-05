
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover as InnerPopover, PopoverContent as InnerPopoverContent, PopoverTrigger as InnerPopoverTrigger } from '@/components/ui/popover'; // Aliased to avoid confusion if this component itself uses Popover for e.g. Calendar
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
}

export function DataGridFilterPopover<TData>({
  column,
  filterValue,
  onFilterChange,
}: DataGridFilterPopoverProps<TData>) {
  const handleClearFilter = () => {
    onFilterChange(column.field, undefined);
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
            aria-label={`${column.headerText} text filter input`}
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
              <SelectTrigger className="w-full" aria-label={`${column.headerText} number filter operator`}>
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
              aria-label={`${column.headerText} number filter value input`}
            />
          </div>
        );
      case 'date':
        const dateFilter = filterValue as FilterValue & { value?: Date };
        return (
          <InnerPopover>
            <InnerPopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal ${!dateFilter?.value && "text-muted-foreground"}`}
                aria-label={`${column.headerText} date filter input, current value: ${dateFilter?.value ? format(dateFilter.value, "PPP") : 'Pick a date'}`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFilter?.value ? format(dateFilter.value, "PPP") : <span>Pick a date</span>}
              </Button>
            </InnerPopoverTrigger>
            <InnerPopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFilter?.value}
                onSelect={(date) => {
                  onFilterChange(column.field, { type: 'date', value: date || undefined });
                }}
                initialFocus
              />
            </InnerPopoverContent>
          </InnerPopover>
        );
      case 'select':
        const selectFilter = filterValue as FilterValue & { value: string };
        const options = column.filterOptions || [];
        return (
          <Select
            value={selectFilter?.value || ''}
            onValueChange={(val) =>
              onFilterChange(column.field, { type: 'select', value: val })
            }
          >
            <SelectTrigger className="w-full" aria-label={`${column.headerText} select filter`}>
              <SelectValue placeholder={`Any ${column.headerText}`} />
            </SelectTrigger>
            <SelectContent>
              {/* <SelectItem value="">Any</SelectItem> Removed this line */}
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
            <SelectTrigger className="w-full" aria-label={`${column.headerText} boolean filter`}>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              {/* <SelectItem value="">Any</SelectItem> Removed this line */}
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
    <div className="space-y-4">
      <Label htmlFor={column.field + "-filter-label"} className="font-semibold">{column.headerText} Filter</Label>
      <div id={column.field + "-filter-label"}>
        {renderFilterContent()}
      </div>
      {filterValue && (typeof filterValue.value !== 'undefined' || (filterValue.type === 'number' && typeof filterValue.operator !== 'undefined')) && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearFilter}
          className="w-full mt-2"
          aria-label={`Clear filter for ${column.headerText}`}
        >
          <FilterX className="mr-2 h-4 w-4" /> Clear Filter
        </Button>
      )}
    </div>
  );
}
