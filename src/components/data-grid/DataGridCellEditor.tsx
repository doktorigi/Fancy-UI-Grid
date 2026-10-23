import type { GridCellEditorProps } from '@/types/data-grid';
import { editorType } from '@/lib/gridEditing';
import { Input } from '@/components/ui/input';

export function DataGridCellEditor<T>(props: GridCellEditorProps<T>) {
  const { column, value, row, onChange, onCommit, onCancel } = props;
  if (column.cellEditor) { const Editor = column.cellEditor; return <Editor {...props} />; }
  const kind = editorType(column, row[column.field]);
  const onKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Enter') { event.preventDefault(); onCommit(); }
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
  };
  if (kind === 'select' || kind === 'boolean') {
    const options = kind === 'boolean' ? [{ label: 'True', value: true }, { label: 'False', value: false }] : column.editorOptions ?? [];
    return <select autoFocus aria-label={`Edit ${column.headerText}`} className="h-6 w-full rounded border bg-background px-1" value={String(value ?? '')} onChange={e => onChange(options.find(o => String(o.value) === e.target.value)?.value ?? '')} onBlur={onCommit} onKeyDown={onKeyDown}>
      <option value="">Choose…</option>{options.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
    </select>;
  }
  return <Input autoFocus aria-label={`Edit ${column.headerText}`} type={kind} step={kind === 'number' ? 'any' : undefined} value={value ?? ''} onChange={e => onChange(e.target.value)} onBlur={onCommit} onKeyDown={onKeyDown} className="h-6 p-1 border-ring" />;
}
