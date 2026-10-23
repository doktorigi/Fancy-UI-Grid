import * as React from 'react';
import type { DataGridProps, GridValidationError, HierarchicalData } from '@/types/data-grid';
import { draftEdits, overlayDrafts, stageEdits, validateDrafts, type DraftRows, type EditInput } from '@/lib/gridEditing';

export function useGridDrafts<T extends HierarchicalData<T>>({ rows, columns, onBatchSave, validateRow, onPendingEditsChange, onSaved }: {
  rows: T[];
  columns: DataGridProps<T>['columnDefs'];
  onBatchSave: DataGridProps<T>['onBatchSave'];
  validateRow: DataGridProps<T>['validateRow'];
  onPendingEditsChange: DataGridProps<T>['onPendingEditsChange'];
  onSaved: () => void;
}) {
  const [drafts, setDrafts] = React.useState<DraftRows<T>>(() => new Map());
  const draftRef = React.useRef(drafts);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [serverErrors, setServerErrors] = React.useState<GridValidationError[]>([]);
  const [message, setMessage] = React.useState('');
  const latest = React.useRef({ rows, columns, onBatchSave, validateRow, onSaved });
  latest.current = { rows, columns, onBatchSave, validateRow, onSaved };
  const callbackRef = React.useRef(onPendingEditsChange);
  callbackRef.current = onPendingEditsChange;
  const edits = React.useMemo(() => draftEdits(drafts), [drafts]);
  React.useEffect(() => { callbackRef.current?.(edits); }, [edits]);
  const errors = React.useMemo(() => [...validateDrafts(drafts, rows, columns, validateRow), ...serverErrors], [drafts, rows, columns, validateRow, serverErrors]);
  const data = React.useMemo(() => overlayDrafts(rows, drafts), [rows, drafts]);

  const replace = (next: DraftRows<T>) => {
    draftRef.current = next;
    setDrafts(next);
    setServerErrors([]);
    setMessage('');
  };
  const stage = (inputs: EditInput<T>[]) => {
    if (!savingRef.current) replace(stageEdits(draftRef.current, latest.current.rows, inputs));
  };
  const discard = () => { if (!savingRef.current) replace(new Map()); };
  const discardCell = (rowId: string | number, field: string) => {
    const original = draftRef.current.get(rowId)?.original;
    if (original) stage([{ rowId, field: field as keyof T & string, value: original[field] }]);
  };
  const save = async () => {
    const context = latest.current;
    if (savingRef.current || !context.onBatchSave || !draftRef.current.size) return;
    const validation = validateDrafts(draftRef.current, context.rows, context.columns, context.validateRow);
    if (validation.length) { setMessage('Correct the validation errors before saving.'); return; }
    savingRef.current = true;
    setSaving(true);
    setMessage('');
    setServerErrors([]);
    try {
      const result = await context.onBatchSave(draftEdits(draftRef.current));
      if (result?.errors?.length || result?.message) {
        setServerErrors(result.errors ?? []);
        setMessage(result.message || 'The server rejected these changes. Correct them and retry.');
      } else {
        replace(new Map());
        context.onSaved();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed. Your changes are still available.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return { data, drafts, edits, errors, message, saving, stage, discard, discardCell, save };
}
