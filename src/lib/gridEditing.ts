import type { ColumnDefinition, GridEdit, GridValidationError, HierarchicalData, RowValidator } from '@/types/data-grid';

export type EditInput<T> = Pick<GridEdit<T>, 'rowId' | 'field' | 'value'>;
export type DraftRows<T> = Map<string | number, { original: T; values: Partial<T> }>;
export const cellKey = (id: string | number, field: string) => JSON.stringify([id, field]);

export function indexRows<T extends HierarchicalData<T>>(rows: T[]): Map<string | number, T> {
  const result = new Map<string | number, T>();
  const visit = (items: T[]) => items.forEach(row => {
    result.set(row.id, row);
    if (row.children) visit(row.children);
  });
  visit(rows);
  return result;
}

export function stageEdits<T extends HierarchicalData<T>>(drafts: DraftRows<T>, rows: T[], edits: EditInput<T>[]): DraftRows<T> {
  const next = new Map(drafts);
  const byId = indexRows(rows);
  for (const edit of edits) {
    const existing = next.get(edit.rowId);
    const original = existing?.original ?? byId.get(edit.rowId);
    if (!original) continue;
    const values = { ...existing?.values, [edit.field]: edit.value } as Partial<T>;
    if (Object.is(original[edit.field], edit.value)) delete values[edit.field];
    if (Object.keys(values).length) next.set(edit.rowId, { original, values });
    else next.delete(edit.rowId);
  }
  return next;
}

export function draftEdits<T>(drafts: DraftRows<T>): GridEdit<T>[] {
  return Array.from(drafts, ([rowId, draft]) => Object.keys(draft.values).map(field => ({
    rowId, field: field as keyof T & string,
    oldValue: draft.original[field as keyof T], value: draft.values[field as keyof T],
  }))).flat();
}

export function overlayDrafts<T extends HierarchicalData<T>>(rows: T[], drafts: DraftRows<T>): T[] {
  if (!drafts.size) return rows;
  return rows.map(row => {
    const draft = drafts.get(row.id);
    const children = row.children ? overlayDrafts(row.children, drafts) : undefined;
    return draft || children ? { ...row, ...draft?.values, ...(children ? { children } : {}) } : row;
  });
}

export function editorType<T>(column: ColumnDefinition<T>, value: any) {
  return column.editor ?? (column.filterType === 'number' || typeof value === 'number' ? 'number'
    : column.filterType === 'boolean' || typeof value === 'boolean' ? 'boolean'
    : column.filterType === 'date' || column.filterType === 'date-tree' ? 'date' : 'text');
}

/** Invalid input is kept in the draft so validation can explain it, never silently skipped. */
export function parseEditValue<T>(column: ColumnDefinition<T>, raw: any, previous: any): any {
  const kind = editorType(column, previous);
  if (kind === 'select') {
    return column.editorOptions?.find(option => String(option.value) === String(raw))?.value ?? raw;
  }
  if (kind === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (/^(true|1)$/i.test(String(raw).trim())) return true;
    if (/^(false|0)$/i.test(String(raw).trim())) return false;
    return raw;
  }
  if (kind === 'number') {
    if (raw === null || (typeof raw === 'string' && raw.trim() === '')) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : raw;
  }
  return raw;
}

export function validateCell<T>(column: ColumnDefinition<T>, value: any, row: T): string | undefined {
  const rules = column.validation ?? {};
  const empty = value === null || value === undefined || value === '';
  if (rules.required && empty) return 'A value is required.';
  if (!empty) {
    const kind = editorType(column, value);
    if (kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) return 'Enter a valid number.';
    if (kind === 'boolean' && typeof value !== 'boolean') return 'Choose true or false.';
    if (kind === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ||
        !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) return 'Enter a valid date (YYYY-MM-DD).';
    if (kind === 'select' && column.editorOptions && !column.editorOptions.some(o => Object.is(o.value, value))) return 'Choose a value from the list.';
    if (rules.min !== undefined && Number(value) < rules.min) return `Minimum is ${rules.min}.`;
    if (rules.max !== undefined && Number(value) > rules.max) return `Maximum is ${rules.max}.`;
    if (rules.minLength !== undefined && String(value).length < rules.minLength) return `Use at least ${rules.minLength} characters.`;
    if (rules.maxLength !== undefined && String(value).length > rules.maxLength) return `Use at most ${rules.maxLength} characters.`;
    if (rules.pattern) {
      try { if (!new RegExp(rules.pattern).test(String(value))) return 'Value does not match the required format.'; }
      catch { return 'This column has an invalid validation pattern.'; }
    }
  }
  try { return column.validate?.(value, row) || undefined; }
  catch (error) { return error instanceof Error ? error.message : 'Validation failed.'; }
}

export function validateDrafts<T extends HierarchicalData<T>>(
  drafts: DraftRows<T>, rows: T[], columns: ColumnDefinition<T>[], validateRow?: RowValidator<T>,
): GridValidationError[] {
  const errors: GridValidationError[] = [];
  const byId = indexRows(rows);
  for (const [rowId, draft] of drafts) {
    const current = byId.get(rowId) ?? draft.original;
    const row = { ...current, ...draft.values };
    for (const field of Object.keys(draft.values)) {
      if (!Object.is(current[field], draft.original[field]) && !Object.is(current[field], row[field])) {
        errors.push({ rowId, field, message: 'This value changed outside the grid. Discard this edit and try again.' });
      }
    }
    for (const column of columns) {
      if (column.formula || (!column.editable && !column.validate && !column.validation)) continue;
      const message = validateCell({ ...column, editor: editorType(column, current[column.field]) }, row[column.field], row);
      if (message) errors.push({ rowId, field: column.field, message });
    }
    try {
      const result = validateRow?.(row);
      if (typeof result === 'string' && result) errors.push({ rowId, message: result });
      else if (result && typeof result === 'object') {
        for (const [field, message] of Object.entries(result)) if (message) errors.push({ rowId, field, message });
      }
    } catch (error) { errors.push({ rowId, message: error instanceof Error ? error.message : 'Row validation failed.' }); }
  }
  return errors;
}
