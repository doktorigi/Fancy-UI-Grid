
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover as InnerPopover, PopoverContent as InnerPopoverContent, PopoverTrigger as InnerPopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import type { ColumnDefinition, FilterValue, NumberFilterOperator, DateRangePreset, DateTreeFilterValue } from '@/types/data-grid';
import { numberFilterOperators, dateRangePresetOptions } from '@/types/data-grid';
import { FilterX, CalendarIcon, ChevronRight, ChevronDown } from 'lucide-react';
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
  const [optionSearch, setOptionSearch] = React.useState('');
  const [expandedYears, setExpandedYears] = React.useState<Set<string>>(new Set());

  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
      case 'date-tree': {
        const buckets = column.dateTreeBuckets || [];
        const treeFilter = filterValue as DateTreeFilterValue | undefined;
        const selected = new Set(treeFilter?.selected || []);

        const yearKeys = (year: string, months: string[]) => months.map(m => `${year}-${m}`);
        const yearState = (year: string, months: string[]): 'all' | 'none' | 'some' => {
          const keys = yearKeys(year, months);
          const checkedCount = keys.filter(k => selected.has(k)).length;
          if (checkedCount === 0) return 'none';
          return checkedCount === keys.length ? 'all' : 'some';
        };
        const commit = (next: Set<string>) => {
          onFilterChange(column.field, next.size ? { type: 'date-tree', selected: Array.from(next) } : undefined);
        };
        const toggleYear = (year: string, months: string[]) => {
          const keys = yearKeys(year, months);
          const next = new Set(selected);
          if (yearState(year, months) === 'all') {
            keys.forEach(k => next.delete(k));
          } else {
            keys.forEach(k => next.add(k));
          }
          commit(next);
        };
        const toggleMonth = (year: string, month: string) => {
          const key = `${year}-${month}`;
          const next = new Set(selected);
          if (next.has(key)) next.delete(key); else next.add(key);
          commit(next);
        };
        const toggleExpand = (year: string) => {
          setExpandedYears(prev => {
            const next = new Set(prev);
            if (next.has(year)) next.delete(year); else next.add(year);
            return next;
          });
        };

        return (
          <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
            {buckets.length ? buckets.map(({ year, months }) => {
              const state = yearState(year, months);
              const isExpanded = expandedYears.has(year);
              return (
                <div key={year}>
                  <div className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted">
                    <button
                      type="button"
                      onClick={() => toggleExpand(year)}
                      className="rounded p-0.5 hover:bg-accent"
                      aria-label={isExpanded ? `Collapse ${year}` : `Expand ${year}`}
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <label className="flex flex-1 items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={state === 'all' ? true : state === 'some' ? 'indeterminate' : false}
                        onCheckedChange={() => toggleYear(year, months)}
                        aria-label={`Filter ${column.headerText} by ${year}`}
                      />
                      {year}
                    </label>
                  </div>
                  {isExpanded && (
                    <div className="ml-7 space-y-0.5">
                      {months.map(month => (
                        <label
                          key={month}
                          className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selected.has(`${year}-${month}`)}
                            onCheckedChange={() => toggleMonth(year, month)}
                            aria-label={`Filter ${column.headerText} by ${MONTH_LABELS[Number(month) - 1]} ${year}`}
                          />
                          {MONTH_LABELS[Number(month) - 1]}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="text-sm text-muted-foreground px-1 py-1">No dates available</div>
            )}
          </div>
        );
      }
      case 'select': {
        // Multi-select: searchable checkbox list. Selected values are kept as string[].
        const selectFilter = filterValue as FilterValue & { value: string | string[] };
        const selected = Array.isArray(selectFilter?.value)
          ? selectFilter.value
          : selectFilter?.value ? [String(selectFilter.value)] : [];
        const options = column.filterOptions || [];
        const query = optionSearch.trim().toLowerCase();
        const visibleOptions = query
          ? options.filter(o => String(o.label).toLowerCase().includes(query))
          : options;
        const toggleValue = (value: string, checked: boolean) => {
          const next = checked
            ? [...selected.filter(v => v !== value), value]
            : selected.filter(v => v !== value);
          onFilterChange(column.field, next.length ? { type: 'select', value: next } : undefined);
        };
        return (
          <div className="space-y-2">
            <Input
              type="search"
              placeholder={`Find ${column.headerText.toLowerCase()}...`}
              value={optionSearch}
              onChange={(e) => setOptionSearch(e.target.value)}
              className="w-full h-8"
              aria-label={`${column.headerText} option search`}
            />
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {visibleOptions.length ? visibleOptions.map((option) => {
                const value = String(option.value);
                return (
                  <label
                    key={value}
                    className="flex items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={selected.includes(value)}
                      onCheckedChange={(checked) => toggleValue(value, !!checked)}
                      aria-label={`Filter ${column.headerText} by ${option.label}`}
                    />
                    <span className="break-words min-w-0">{option.label}</span>
                  </label>
                );
              }) : (
                <div className="text-sm text-muted-foreground px-1 py-1">No matching options</div>
              )}
            </div>
          </div>
        );
      }
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
    if (filterValue.type === 'date-tree') return !!(filterValue.selected && filterValue.selected.length > 0);
    if (filterValue.type === 'select' && (Array.isArray(filterValue.value) ? filterValue.value.length > 0 : !!filterValue.value)) return true;
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
