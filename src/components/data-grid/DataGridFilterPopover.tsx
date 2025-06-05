
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover as InnerPopover, PopoverContent as InnerPopoverContent, PopoverTrigger as InnerPopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import type { ColumnDefinition, FilterValue, NumberFilterOperator, DateRangePreset } from '@/types/data-grid';
import { numberFilterOperators, dateRangePresetOptions } from '@/types/data-grid';
import { FilterX, CalendarIcon } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

interface DataGridFilterPopoverProps<TData> {
  column: ColumnDefinition<TData>;
  filterValue?: FilterValue;
  onFilterChange: (field: keyof TData & string, value?: FilterValue) => void;
  // uniqueColumnValues?: string[]; // No longer needed here, pre-processed in DataGrid
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
        const numFilter = filterValue as FilterValue & { value?: number; value2?: number; operator: NumberFilterOperator } || 
                          { type: 'number', operator: '=', value: undefined, value2: undefined };
        return (
          <div className="space-y-2">
            <Select
              value={numFilter?.operator || '='}
              onValueChange={(op) =>
                onFilterChange(column.field, {
                  type: 'number',
                  operator: op as NumberFilterOperator,
                  value: numFilter?.value,
                  value2: numFilter?.value2,
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
            <div className={cn("flex gap-2", numFilter?.operator !== 'between' && "flex-col")}>
              <Input
                type="number"
                placeholder={numFilter?.operator === 'between' ? "Min value" : "Value"}
                value={numFilter?.value === undefined ? '' : numFilter.value}
                onChange={(e) =>
                  onFilterChange(column.field, {
                    type: 'number',
                    operator: numFilter?.operator || '=',
                    value: e.target.value === '' ? undefined : parseFloat(e.target.value),
                    value2: numFilter?.value2,
                  })
                }
                className="w-full"
                aria-label={`${column.headerText} number filter value input ${numFilter?.operator === 'between' ? 'minimum' : ''}`}
              />
              {numFilter?.operator === 'between' && (
                <Input
                  type="number"
                  placeholder="Max value"
                  value={numFilter?.value2 === undefined ? '' : numFilter.value2}
                  onChange={(e) =>
                    onFilterChange(column.field, {
                      type: 'number',
                      operator: numFilter.operator,
                      value: numFilter.value,
                      value2: e.target.value === '' ? undefined : parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                  aria-label={`${column.headerText} number filter value input maximum`}
                />
              )}
            </div>
          </div>
        );
      case 'date':
        const dateFilter = filterValue as FilterValue & { preset?: DateRangePreset, value?: Date, value2?: Date } || 
                           { type: 'date', preset: 'all', value: undefined, value2: undefined };
        
        const handlePresetChange = (preset: DateRangePreset) => {
           onFilterChange(column.field, { type: 'date', preset, value: preset !== 'custom' ? undefined : dateFilter.value, value2: preset !== 'custom' ? undefined : dateFilter.value2 });
        }
        
        const handleStartDateChange = (date?: Date) => {
            onFilterChange(column.field, { type: 'date', preset: 'custom', value: date, value2: dateFilter.value2 });
        }
        const handleEndDateChange = (date?: Date) => {
            onFilterChange(column.field, { type: 'date', preset: 'custom', value: dateFilter.value, value2: date });
        }

        return (
          <div className="space-y-2">
            <Select
              value={dateFilter.preset || 'all'}
              onValueChange={(val) => handlePresetChange(val as DateRangePreset)}
            >
              <SelectTrigger className="w-full" aria-label={`${column.headerText} date range preset`}>
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                {dateRangePresetOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {dateFilter.preset === 'custom' && (
              <div className="space-y-2">
                 <InnerPopover>
                    <InnerPopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!dateFilter.value && "text-muted-foreground"}`}
                        aria-label={`${column.headerText} custom start date, current value: ${dateFilter.value ? format(dateFilter.value, "PPP") : 'Pick start date'}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFilter.value ? format(dateFilter.value, "PPP") : <span>Start date</span>}
                      </Button>
                    </InnerPopoverTrigger>
                    <InnerPopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFilter.value}
                        onSelect={handleStartDateChange}
                        initialFocus
                      />
                    </InnerPopoverContent>
                  </InnerPopover>

                  <InnerPopover>
                    <InnerPopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!dateFilter.value2 && "text-muted-foreground"}`}
                        aria-label={`${column.headerText} custom end date, current value: ${dateFilter.value2 ? format(dateFilter.value2, "PPP") : 'Pick end date'}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFilter.value2 ? format(dateFilter.value2, "PPP") : <span>End date</span>}
                      </Button>
                    </InnerPopoverTrigger>
                    <InnerPopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFilter.value2}
                        onSelect={handleEndDateChange}
                        disabled={(date) => dateFilter.value ? date < dateFilter.value : false}
                        initialFocus
                      />
                    </InnerPopoverContent>
                  </InnerPopover>
              </div>
            )}
          </div>
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
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  };

  const isFilterActive = () => {
    if (!filterValue) return false;
    if (filterValue.type === 'text' && filterValue.value) return true;
    if (filterValue.type === 'number' && (typeof filterValue.value !== 'undefined' || (filterValue.operator === 'between' && typeof filterValue.value2 !== 'undefined'))) return true;
    if (filterValue.type === 'date' && filterValue.preset !== 'all') return true;
    if (filterValue.type === 'select' && filterValue.value) return true;
    if (filterValue.type === 'boolean' && typeof filterValue.value !== 'undefined') return true;
    return false;
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
      {isFilterActive() && (
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
