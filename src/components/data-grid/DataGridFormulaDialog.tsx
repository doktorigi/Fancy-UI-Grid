import * as React from 'react';
import type {
  AggregateFunction,
  ColumnDefinition,
  FormulaColumnConfig,
} from '@/types/data-grid';
import {
  evaluateFormula,
  slugifyFormulaField,
  validateFormula,
} from '@/lib/formulaEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calculator, Pencil, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface DataGridFormulaDialogProps<TData> {
  allColumns: ColumnDefinition<TData>[];
  formulaColumns: FormulaColumnConfig[];
  sampleRow?: Record<string, any>;
  onSaveFormulaColumn: (col: FormulaColumnConfig, previousField?: string) => void;
  onRemoveFormulaColumn: (field: string) => void;
}

const QUICK_FUNCTIONS = [
  { label: 'IF', snippet: 'IF(condition, trueVal, falseVal)' },
  { label: 'ROUND', snippet: 'ROUND(, 2)' },
  { label: 'MIN', snippet: 'MIN(, )' },
  { label: 'MAX', snippet: 'MAX(, )' },
  { label: 'ABS', snippet: 'ABS()' },
  { label: 'IFERROR', snippet: 'IFERROR(, 0)' },
  { label: 'CONCAT', snippet: 'CONCAT(, )' },
];

const AGGREGATE_OPTIONS: { value: '' | AggregateFunction; label: string }[] = [
  { value: '', label: 'No Footer Aggregate' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average (Avg)' },
  { value: 'min', label: 'Minimum (Min)' },
  { value: 'max', label: 'Maximum (Max)' },
  { value: 'count', label: 'Count' },
];

export function DataGridFormulaDialog<TData>({
  allColumns,
  formulaColumns,
  sampleRow,
  onSaveFormulaColumn,
  onRemoveFormulaColumn,
}: DataGridFormulaDialogProps<TData>) {
  const [open, setOpen] = React.useState(false);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [headerText, setHeaderText] = React.useState('');
  const [formula, setFormula] = React.useState('');
  const [aggregate, setAggregate] = React.useState<'' | AggregateFunction>('');

  const builtInFormulaColumns = React.useMemo(
    () =>
      allColumns.filter(
        c => !!c.formula && !formulaColumns.some(fc => fc.field === c.field)
      ),
    [allColumns, formulaColumns]
  );

  const totalFormulaCount = builtInFormulaColumns.length + formulaColumns.length;

  const validation = React.useMemo(() => {
    if (!formula.trim()) {
      return { valid: false, error: undefined, preview: undefined };
    }
    const res = validateFormula(formula);
    if (!res.valid) {
      return { valid: false, error: res.error, preview: undefined };
    }
    const preview = sampleRow ? evaluateFormula(formula, sampleRow) : undefined;
    return { valid: true, error: undefined, preview };
  }, [formula, sampleRow]);

  const resetForm = () => {
    setEditingField(null);
    setHeaderText('');
    setFormula('');
    setAggregate('');
  };

  const handleStartEdit = (col: FormulaColumnConfig) => {
    setEditingField(col.field);
    setHeaderText(col.headerText);
    setFormula(col.formula);
    setAggregate(typeof col.aggregate === 'string' ? col.aggregate : '');
  };

  const handleInsertToken = (token: string) => {
    setFormula(prev => {
      if (!prev.trim()) return `=${token}`;
      return `${prev} ${token}`;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerText.trim() || !validation.valid) return;

    const existingFields = allColumns
      .map(c => String(c.field))
      .filter(f => f !== editingField);

    const field =
      editingField || slugifyFormulaField(headerText.trim(), existingFields);

    const previewVal = validation.preview;
    const inferredFilterType =
      typeof previewVal === 'number'
        ? 'number'
        : typeof previewVal === 'boolean'
          ? 'boolean'
          : 'text';

    onSaveFormulaColumn(
      {
        field,
        headerText: headerText.trim(),
        formula: formula.trim().startsWith('=') ? formula.trim() : `=${formula.trim()}`,
        aggregate: aggregate || undefined,
        filterType: inferredFilterType,
      },
      editingField || undefined
    );
    resetForm();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={totalFormulaCount > 0 ? 'secondary' : 'outline'}
          size="sm"
          aria-label="Manage formula columns"
        >
          <Calculator className="mr-1.5 h-4 w-4" />
          <span>Formulas</span>
          {totalFormulaCount > 0 && (
            <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px]">
              {totalFormulaCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-3 space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider">
              Calculated Formula Columns
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Reference fields with <code className="text-foreground">[field]</code> and Excel functions
            </p>
          </div>
          {editingField && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={resetForm}
            >
              Cancel Edit
            </Button>
          )}
        </div>

        {(builtInFormulaColumns.length > 0 || formulaColumns.length > 0) && (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {builtInFormulaColumns.map(col => (
              <div
                key={String(col.field)}
                className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium truncate">
                    <span>{col.headerText}</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      Schema
                    </Badge>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                    {col.formula}
                  </div>
                </div>
              </div>
            ))}
            {formulaColumns.map(col => (
              <div
                key={col.field}
                className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium truncate">
                    <span>{col.headerText}</span>
                    {col.aggregate && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1 uppercase">
                        {Array.isArray(col.aggregate) ? col.aggregate.join(',') : col.aggregate}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                    {col.formula}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(col)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title={`Edit ${col.headerText}`}
                    aria-label={`Edit ${col.headerText}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (editingField === col.field) resetForm();
                      onRemoveFormulaColumn(col.field);
                    }}
                    className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                    title={`Remove ${col.headerText}`}
                    aria-label={`Remove ${col.headerText}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5 pt-1 border-t">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Column Header
            </label>
            <Input
              value={headerText}
              onChange={e => setHeaderText(e.target.value)}
              placeholder="e.g. Margin % or Net Revenue"
              className="h-8 text-xs"
              aria-label="Formula column header"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Formula Expression
            </label>
            <Input
              value={formula}
              onChange={e => setFormula(e.target.value)}
              placeholder="=ROUND(([newPrice] - [oldPrice]) / [oldPrice] * 100, 1)"
              className="h-8 text-xs font-mono"
              aria-label="Formula expression"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">Insert Field:</span>
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {allColumns.map(col => (
                <button
                  key={String(col.field)}
                  type="button"
                  onClick={() => handleInsertToken(`[${String(col.field)}]`)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-muted/40 hover:bg-muted transition-colors"
                  title={`Insert [${String(col.field)}] (${col.headerText})`}
                >
                  [{String(col.field)}]
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">Insert Function:</span>
            <div className="flex flex-wrap gap-1">
              {QUICK_FUNCTIONS.map(fn => (
                <button
                  key={fn.label}
                  type="button"
                  onClick={() => handleInsertToken(fn.snippet)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-primary/5 hover:bg-primary/15 text-primary transition-colors"
                >
                  {fn.label}()
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <select
              value={aggregate}
              onChange={e => setAggregate(e.target.value as '' | AggregateFunction)}
              className="h-8 rounded border bg-background px-2 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Formula column summary aggregate"
            >
              {AGGREGATE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs"
              disabled={!headerText.trim() || !validation.valid}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {editingField ? 'Update Column' : 'Add Column'}
            </Button>
          </div>

          {formula.trim() && (
            <div
              className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-[11px] ${
                validation.valid
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {validation.valid ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    Preview row 1:{' '}
                    <strong className="font-mono">
                      {validation.preview !== undefined && validation.preview !== null
                        ? String(validation.preview)
                        : 'null'}
                    </strong>
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{validation.error}</span>
                </>
              )}
            </div>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
}
