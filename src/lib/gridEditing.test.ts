import assert from 'node:assert/strict';
import test from 'node:test';
import { draftEdits, overlayDrafts, parseEditValue, stageEdits, validateDrafts } from './gridEditing';
import type { ColumnDefinition } from '@/types/data-grid';

type Row = { id: number; low: number; high: number; date: string; active: boolean; status: number };
const rows: Row[] = [{ id: 1, low: 10, high: 20, date: '2026-01-01', active: true, status: 1 }];
const columns: ColumnDefinition<Row>[] = [
  { field: 'low', headerText: 'Low', editable: true, editor: 'number', validation: { required: true, min: 0 } },
  { field: 'high', headerText: 'High', editable: true, editor: 'number' },
  { field: 'date', headerText: 'Date', editable: true, editor: 'date' },
  { field: 'active', headerText: 'Active', editable: true, editor: 'boolean' },
  { field: 'status', headerText: 'Status', editable: true, editor: 'select', editorOptions: [{ label: 'New', value: 1 }, { label: 'Done', value: 2 }] },
];

test('draft edits coalesce, preserve original values, and disappear on reversion without mutating input', () => {
  let drafts = stageEdits(new Map(), rows, [{ rowId: 1, field: 'low', value: 11 }]);
  drafts = stageEdits(drafts, rows, [{ rowId: 1, field: 'low', value: 12 }]);
  assert.deepEqual(draftEdits(drafts), [{ rowId: 1, field: 'low', oldValue: 10, value: 12 }]);
  assert.equal(overlayDrafts(rows, drafts)[0].low, 12);
  assert.equal(rows[0].low, 10);
  assert.equal(stageEdits(drafts, rows, [{ rowId: 1, field: 'low', value: 10 }]).size, 0);
});
test('cross-field validation sees the entire paste transaction, not intermediate invalid states', () => {
  const validate = (row: Row) => row.low > row.high ? { high: 'High must be at least Low' } : null;
  const drafts = stageEdits(new Map(), rows, [{ rowId: 1, field: 'low', value: 30 }, { rowId: 1, field: 'high', value: 40 }]);
  assert.deepEqual(validateDrafts(drafts, rows, columns, validate), []);
  assert.equal(validateDrafts(stageEdits(drafts, rows, [{ rowId: 1, field: 'high', value: 25 }]), rows, columns, validate)[0].field, 'high');
});
test('invalid numeric paste stays visible as a draft and cannot pass validation', () => {
  const value = parseEditValue(columns[0], '123oops', 10);
  assert.equal(value, '123oops');
  assert.match(validateDrafts(stageEdits(new Map(), rows, [{ rowId: 1, field: 'low', value }]), rows, columns)[0].message, /number/);
  const inferred: ColumnDefinition<Row> = { field: 'low', headerText: 'Low', editable: true };
  assert.match(validateDrafts(stageEdits(new Map(), rows, [{ rowId: 1, field: 'low', value }]), rows, [inferred])[0].message, /number/);
  assert.equal(parseEditValue(columns[0], '   ', 10), null);
});
test('typed editors preserve select/boolean values and reject impossible dates', () => {
  assert.equal(parseEditValue(columns[4], '2', 1), 2);
  assert.equal(parseEditValue(columns[3], 'false', true), false);
  const drafts = stageEdits(new Map(), rows, [{ rowId: 1, field: 'date', value: '2026-02-30' }]);
  assert.match(validateDrafts(drafts, rows, columns)[0].message, /valid date/);
});
test('drafts survive unloaded server blocks and detect conflicting external changes', () => {
  const drafts = stageEdits(new Map(), rows, [{ rowId: 1, field: 'low', value: 12 }]);
  assert.deepEqual(validateDrafts(drafts, [], columns), []);
  assert.match(validateDrafts(drafts, [{ ...rows[0], low: 11 }], columns)[0].message, /outside the grid/);
  assert.deepEqual(validateDrafts(drafts, [{ ...rows[0], high: 25 }], columns), []);
});
