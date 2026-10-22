import * as React from 'react';
import type {
  AggregateFunction,
  ColumnDefinition,
  PivotValueConfig,
} from '@/types/data-grid';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Columns3, Calculator, Layers, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const AGGREGATE_OPTIONS: { value: AggregateFunction; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Avg' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'count', label: 'Count' },
];

interface DataGridPivotPanelProps<TData> {
  allColumns: ColumnDefinition<TData>[];
  allColumnsMap: Map<keyof TData & string, ColumnDefinition<TData>>;
  rowGroupFields: (keyof TData & string)[];
  pivotFields: (keyof TData & string)[];
  valueConfigs: PivotValueConfig<TData>[];
  onAddRowGroup: (field: keyof TData & string) => void;
  onRemoveRowGroup: (field: keyof TData & string) => void;
  onAddPivotColumn: (field: keyof TData & string) => void;
  onRemovePivotColumn: (field: keyof TData & string) => void;
  onAddValueConfig: (field: keyof TData & string, aggregate?: AggregateFunction) => void;
  onChangeValueAggregate: (index: number, aggregate: AggregateFunction) => void;
  onRemoveValueConfig: (index: number) => void;
  onExitPivotMode?: () => void;
}

export function DataGridPivotPanel<TData>({
  allColumns,
  allColumnsMap,
  rowGroupFields,
  pivotFields,
  valueConfigs,
  onAddRowGroup,
  onRemoveRowGroup,
  onAddPivotColumn,
  onRemovePivotColumn,
  onAddValueConfig,
  onChangeValueAggregate,
  onRemoveValueConfig,
  onExitPivotMode,
}: DataGridPivotPanelProps<TData>) {
  const [dragZone, setDragZone] = React.useState<'rows' | 'columns' | 'values' | null>(null);

  const handleDragOver = (zone: 'rows' | 'columns' | 'values') => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragZone(zone);
  };

  const handleDragLeave = () => {
    setDragZone(null);
  };

  const handleDrop = (zone: 'rows' | 'columns' | 'values') => (e: React.DragEvent) => {
    e.preventDefault();
    setDragZone(null);
    const field = e.dataTransfer.getData('text/plain') as keyof TData & string;
    if (!field || !allColumnsMap.has(field)) return;
    if (zone === 'rows') {
      onAddRowGroup(field);
    } else if (zone === 'columns') {
      onAddPivotColumn(field);
    } else {
      onAddValueConfig(field);
    }
  };

  const availableForRowGroup = allColumns.filter(
    c => c.groupable !== false && !c.sparkline && !rowGroupFields.includes(c.field) && !pivotFields.includes(c.field)
  );

  const availableForPivot = allColumns.filter(
    c => c.pivotable !== false && c.groupable !== false && !c.sparkline && !pivotFields.includes(c.field)
  );

  const availableForValues = allColumns.filter(c => !c.sparkline);

  return (
    <div
      className="border-b bg-muted/40 p-3 space-y-2.5"
      aria-label="Pivot table configuration panel"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Columns3 className="h-3.5 w-3.5" />
          <span>Pivot Mode Active</span>
          <span className="font-normal normal-case text-muted-foreground">
            — Drag headers or use + to configure rows, cross-tab columns, and value aggregations
          </span>
        </div>
        {onExitPivotMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExitPivotMode}
            className="h-7 px-2 text-xs"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Exit Pivot Mode
          </Button>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {/* Row Groups Zone */}
        <div
          onDragOver={handleDragOver('rows')}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop('rows')}
          className={cn(
            "rounded-md border bg-card/80 p-2 min-h-[2.75rem] flex flex-wrap items-center gap-1.5 transition-colors",
            dragZone === 'rows' && "border-primary ring-2 ring-primary/20"
          )}
          aria-label="Pivot Row Groups"
        >
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
            <Layers className="h-3.5 w-3.5" />
            Rows:
          </span>
          {rowGroupFields.map(field => {
            const col = allColumnsMap.get(field);
            return (
              <span
                key={field}
                className="inline-flex items-center gap-1 rounded bg-primary/15 text-primary px-2 py-0.5 text-xs font-medium"
              >
                {col?.headerText || field}
                <button
                  type="button"
                  onClick={() => onRemoveRowGroup(field)}
                  className="rounded-full p-0.5 hover:bg-primary/20"
                  aria-label={`Remove ${col?.headerText || field} from row groups`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {availableForRowGroup.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground">
                  <Plus className="h-3 w-3 mr-0.5" />
                  Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {availableForRowGroup.map(col => (
                  <DropdownMenuItem key={col.field} onClick={() => onAddRowGroup(col.field)}>
                    {col.headerText}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Pivot Columns Zone */}
        <div
          onDragOver={handleDragOver('columns')}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop('columns')}
          className={cn(
            "rounded-md border bg-card/80 p-2 min-h-[2.75rem] flex flex-wrap items-center gap-1.5 transition-colors",
            dragZone === 'columns' && "border-primary ring-2 ring-primary/20"
          )}
          aria-label="Pivot Columns"
        >
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
            <Columns3 className="h-3.5 w-3.5" />
            Columns:
          </span>
          {pivotFields.map(field => {
            const col = allColumnsMap.get(field);
            return (
              <span
                key={field}
                className="inline-flex items-center gap-1 rounded bg-accent/15 text-foreground border border-accent/40 px-2 py-0.5 text-xs font-medium"
              >
                {col?.headerText || field}
                <button
                  type="button"
                  onClick={() => onRemovePivotColumn(field)}
                  className="rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove ${col?.headerText || field} from pivot columns`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {availableForPivot.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground">
                  <Plus className="h-3 w-3 mr-0.5" />
                  Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {availableForPivot.map(col => (
                  <DropdownMenuItem key={col.field} onClick={() => onAddPivotColumn(col.field)}>
                    {col.headerText}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Values Zone */}
        <div
          onDragOver={handleDragOver('values')}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop('values')}
          className={cn(
            "rounded-md border bg-card/80 p-2 min-h-[2.75rem] flex flex-wrap items-center gap-1.5 transition-colors",
            dragZone === 'values' && "border-primary ring-2 ring-primary/20"
          )}
          aria-label="Pivot Values"
        >
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
            <Calculator className="h-3.5 w-3.5" />
            Values:
          </span>
          {valueConfigs.map((vc, idx) => {
            const col = allColumnsMap.get(vc.field);
            return (
              <span
                key={`${vc.field}-${vc.aggregate}-${idx}`}
                className="inline-flex items-center gap-1 rounded bg-secondary text-secondary-foreground px-1.5 py-0.5 text-xs font-medium"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded bg-background/70 px-1 py-0 text-[10px] font-bold uppercase tracking-wide text-primary hover:bg-background"
                      title="Change aggregation function"
                    >
                      {vc.aggregate}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {AGGREGATE_OPTIONS.map(opt => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => onChangeValueAggregate(idx, opt.value)}
                      >
                        {opt.label} ({col?.headerText || vc.field})
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span>{col?.headerText || vc.field}</span>
                {valueConfigs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveValueConfig(idx)}
                    className="rounded-full p-0.5 hover:bg-muted"
                    aria-label={`Remove ${col?.headerText || vc.field} value aggregation`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}
          {availableForValues.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground">
                  <Plus className="h-3 w-3 mr-0.5" />
                  Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {availableForValues.map(col => (
                  <DropdownMenuItem
                    key={col.field}
                    onClick={() =>
                      onAddValueConfig(
                        col.field,
                        col.filterType === 'number' ? 'sum' : 'count'
                      )
                    }
                  >
                    {col.headerText}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
