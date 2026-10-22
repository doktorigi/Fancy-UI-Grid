import * as React from 'react';
import type {
  BooleanFilterValue,
  ColumnDefinition,
  DateFilterValue,
  DateRangePreset,
  DateTreeFilterValue,
  FilterValue,
  NumberFilterValue,
  SelectFilterValue,
  TextFilterValue,
} from '@/types/data-grid';
import { dateRangePresetOptions } from '@/types/data-grid';
import { formatFloatingNumberFilter, parseFloatingNumberFilter } from '@/lib/gridProcessing';
import { X } from 'lucide-react';

interface DataGridFloatingFilterCellProps<TData> {
  column: ColumnDefinition<TData>;
  filterValue?: FilterValue;
  onFilterChange: (field: keyof TData & string, value?: FilterValue) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function DataGridFloatingFilterCell<TData>({
  column,
  filterValue,
  onFilterChange,
}: DataGridFloatingFilterCellProps<TData>) {
  const numFilter = filterValue?.type === 'number' ? (filterValue as NumberFilterValue) : undefined;
  const formattedNum = formatFloatingNumberFilter(numFilter);
  const [numberDraft, setNumberDraft] = React.useState(formattedNum);

  React.useEffect(() => {
    setNumberDraft(formattedNum);
  }, [formattedNum]);

  if (!column.filterable || !column.filterType) {
    return <div className="h-7 px-2" />;
  }

  const clearButton = filterValue ? (
    <button
      type="button"
      onClick={() => {
        setNumberDraft('');
        onFilterChange(column.field, undefined);
      }}
      className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={`Clear quick filter for ${column.headerText}`}
      title="Clear filter"
    >
      <X className="h-3 w-3" />
    </button>
  ) : null;

  switch (column.filterType) {
    case 'text': {
      const val = (filterValue as TextFilterValue | undefined)?.value ?? '';
      return (
        <div className="flex items-center px-2 py-1">
          <input
            type="text"
            value={val}
            onChange={e =>
              onFilterChange(
                column.field,
                e.target.value ? { type: 'text', value: e.target.value } : undefined
              )
            }
            placeholder={`Filter ${column.headerText}…`}
            aria-label={`Quick filter ${column.headerText}`}
            className="h-6 w-full min-w-0 rounded border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {clearButton}
        </div>
      );
    }

    case 'number': {
      return (
        <div className="flex items-center px-2 py-1">
          <input
            type="text"
            value={numberDraft}
            onChange={e => {
              const raw = e.target.value;
              setNumberDraft(raw);
              if (!raw.trim()) {
                onFilterChange(column.field, undefined);
                return;
              }
              const parsed = parseFloatingNumberFilter(raw, numFilter?.operator || '=');
              if (parsed) {
                onFilterChange(column.field, parsed);
              }
            }}
            placeholder="= / >100 / 10..50"
            title="Enter a number, comparison (>100, <=50, !=0), or range (10..50)"
            aria-label={`Quick number filter ${column.headerText}`}
            className="h-6 w-full min-w-0 rounded border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {clearButton}
        </div>
      );
    }

    case 'select': {
      const selFilter = filterValue as SelectFilterValue | undefined;
      const selectedArr = Array.isArray(selFilter?.value)
        ? selFilter!.value
        : selFilter?.value
          ? [String(selFilter.value)]
          : [];
      const selectValue =
        selectedArr.length === 0
          ? '__all__'
          : selectedArr.length === 1
            ? selectedArr[0]
            : '__multi__';
      const options = column.filterOptions || [];

      return (
        <div className="flex items-center px-2 py-1">
          <select
            value={selectValue}
            onChange={e => {
              const v = e.target.value;
              if (v === '__all__' || v === '__multi__') {
                onFilterChange(column.field, undefined);
              } else {
                onFilterChange(column.field, { type: 'select', value: [v] });
              }
            }}
            aria-label={`Quick select filter ${column.headerText}`}
            className="h-6 w-full min-w-0 rounded border border-input bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="__all__">All</option>
            {selectedArr.length > 1 && (
              <option value="__multi__">{selectedArr.length} selected</option>
            )}
            {options.map(opt => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
          {clearButton}
        </div>
      );
    }

    case 'boolean': {
      const boolFilter = filterValue as BooleanFilterValue | undefined;
      const val =
        boolFilter?.value === true
          ? 'true'
          : boolFilter?.value === false
            ? 'false'
            : '__all__';
      return (
        <div className="flex items-center px-2 py-1">
          <select
            value={val}
            onChange={e => {
              const v = e.target.value;
              if (v === '__all__') onFilterChange(column.field, undefined);
              else onFilterChange(column.field, { type: 'boolean', value: v === 'true' });
            }}
            aria-label={`Quick boolean filter ${column.headerText}`}
            className="h-6 w-full min-w-0 rounded border border-input bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="__all__">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          {clearButton}
        </div>
      );
    }

    case 'date': {
      const dFilter = filterValue as DateFilterValue | undefined;
      const preset = dFilter?.preset || 'all';
      return (
        <div className="flex items-center px-2 py-1">
          <select
            value={preset}
            onChange={e => {
              const nextPreset = e.target.value as DateRangePreset;
              if (nextPreset === 'all') {
                onFilterChange(column.field, undefined);
              } else {
                onFilterChange(column.field, { type: 'date', preset: nextPreset });
              }
            }}
            aria-label={`Quick date filter ${column.headerText}`}
            className="h-6 w-full min-w-0 rounded border border-input bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {dateRangePresetOptions
              .filter(o => o.value !== 'custom')
              .map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
          </select>
          {clearButton}
        </div>
      );
    }

    case 'date-tree': {
      const dtFilter = filterValue as DateTreeFilterValue | undefined;
      const selected = dtFilter?.selected || [];
      const buckets = column.dateTreeBuckets || [];

      let currentVal = '__all__';
      if (selected.length === 1) {
        currentVal = selected[0];
      } else if (selected.length > 1) {
        const matchedBucket = buckets.find(
          b =>
            b.months.length === selected.length &&
            b.months.every(m => selected.includes(`${b.year}-${m}`))
        );
        currentVal = matchedBucket ? `year:${matchedBucket.year}` : '__multi__';
      }

      return (
        <div className="flex items-center px-2 py-1">
          <select
            value={currentVal}
            onChange={e => {
              const v = e.target.value;
              if (v === '__all__' || v === '__multi__') {
                onFilterChange(column.field, undefined);
              } else if (v.startsWith('year:')) {
                const yr = v.slice(5);
                const bucket = buckets.find(b => b.year === yr);
                if (bucket) {
                  onFilterChange(column.field, {
                    type: 'date-tree',
                    selected: bucket.months.map(m => `${yr}-${m}`),
                  });
                }
              } else {
                onFilterChange(column.field, { type: 'date-tree', selected: [v] });
              }
            }}
            aria-label={`Quick date-tree filter ${column.headerText}`}
            className="h-6 w-full min-w-0 rounded border border-input bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="__all__">All Dates</option>
            { currentVal === '__multi__' && (
              <option value="__multi__">{selected.length} months</option>
            )}
            {buckets.map(b => (
              <optgroup key={b.year} label={b.year}>
                <option value={`year:${b.year}`}>{b.year} (All)</option>
                {b.months.map(m => (
                  <option key={`${b.year}-${m}`} value={`${b.year}-${m}`}>
                    {MONTH_NAMES[Number(m) - 1]} {b.year}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {clearButton}
        </div>
      );
    }

    default:
      return <div className="h-7 px-2" />;
  }
}
