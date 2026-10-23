import * as React from 'react';
import type { GridEdit, GridValidationError } from '@/types/data-grid';
import { Button } from '@/components/ui/button';

export function DataGridEditPanel({ edits, errors, message, saving, editing, canSave, onSave, onDiscard, onDiscardCell }: {
  edits: GridEdit[]; errors: GridValidationError[]; message: string; saving: boolean; editing: boolean; canSave: boolean;
  onSave: () => void; onDiscard: () => void; onDiscardCell: (id: string | number, field: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(edits.length / 50) - 1));
  return <div className="border-b bg-muted/20 p-3" aria-label="Batch editing">
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm" role="status">{edits.length} pending change{edits.length === 1 ? '' : 's'}{errors.length ? ` · ${errors.length} validation error(s)` : ''}</span>
      <Button size="sm" variant="outline" onClick={() => setOpen(!open)} aria-expanded={open}>Review changes</Button>
      {/* Keep the editor focused until click: blur can remove validation text and move these buttons before mouseup. */}
      <Button size="sm" onMouseDown={event => event.preventDefault()} onClick={onSave} disabled={saving || (!edits.length && !editing) || !canSave || (errors.length > 0 && !editing)}>{saving ? 'Saving…' : 'Save all'}</Button>
      <Button size="sm" variant="ghost" onMouseDown={event => event.preventDefault()} onClick={onDiscard} disabled={saving || (!edits.length && !editing)}>Discard all</Button>
    </div>
    {message && <p role="alert" className="mt-2 text-sm text-destructive">{message}</p>}
    {!!errors.length && <div role="alert" className="mt-2 max-h-28 overflow-auto text-sm text-destructive">
      {errors.map((error, index) => <div key={index}>Row {error.rowId}{error.field ? `, ${error.field}` : ''}: {error.message}</div>)}
    </div>}
    {open && <div className="mt-3 max-h-72 overflow-auto">
      <table className="w-full text-left text-sm"><caption className="sr-only">Pending changes</caption>
        <thead><tr><th>Row</th><th>Column</th><th>Original</th><th>Pending</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{edits.slice(currentPage * 50, (currentPage + 1) * 50).map(edit => <tr className="border-t" key={JSON.stringify([edit.rowId, edit.field])}>
          <td>{edit.rowId}</td><td>{edit.field}</td><td>{String(edit.oldValue ?? '')}</td><td>{String(edit.value ?? '')}</td>
          <td><Button size="sm" variant="ghost" disabled={saving} onClick={() => onDiscardCell(edit.rowId, edit.field)}>Discard</Button></td>
        </tr>)}</tbody>
      </table>
      {edits.length > 50 && <div className="flex items-center gap-2"><Button size="sm" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous changes</Button><span>{currentPage + 1} / {Math.ceil(edits.length / 50)}</span><Button size="sm" variant="ghost" disabled={(currentPage + 1) * 50 >= edits.length} onClick={() => setPage(currentPage + 1)}>Next changes</Button></div>}
    </div>}
  </div>;
}
