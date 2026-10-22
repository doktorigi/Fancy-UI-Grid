import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDensityRowMetrics,
  createGridViewSnapshot,
  applyGridViewSnapshot,
  mergeSavedViews,
  describeGridViewSummary,
  rehydrateViewColumnFilters,
} from './savedViews';
import type { DataGridState } from '@/types/data-grid';

function createMockGridState(): DataGridState<any> {
  return {
    currentPage: 3,
    pageSize: 25,
    sortConfig: { field: 'revenue', direction: 'desc' },
    multiSortConfig: [
      { field: 'revenue', direction: 'desc' },
      { field: 'name', direction: 'asc' },
    ],
    globalFilter: 'enterprise',
    columnFilters: {
      revenue: { type: 'number', operator: '>=', value: 50000 },
    },
    visibleColumns: ['name', 'revenue', 'region'],
    selectedRows: new Set([1, 2]),
    columnOrder: ['revenue', 'region'],
    columnWidths: { name: '220px', revenue: '160px' },
    draggedColumn: null,
    draggedOverColumn: null,
    editingCell: null,
    editInputValue: '',
    pinnedColumns: { left: ['name'], right: [] },
    expandedRows: new Set(),
    focusedCell: { rowId: 1, colField: 'name' },
    groupedBy: ['region'],
    expandedGroups: new Set(['region: EMEA']),
    pivotMode: false,
    pivotColumns: [],
    pivotValues: [{ field: 'revenue', aggregate: 'sum' }],
    floatingFiltersOpen: true,
    density: 'compact',
    formulaColumns: [{ field: 'calc_margin', headerText: 'Margin', formula: '=[revenue] * 0.3' }],
    activeViewId: null,
  };
}

test('getDensityRowMetrics returns distinct padding and height metrics for compact, normal, and comfortable', () => {
  const compact = getDensityRowMetrics('compact');
  const normal = getDensityRowMetrics('normal');
  const comfortable = getDensityRowMetrics('comfortable');

  assert.equal(compact.defaultRowHeight, 32);
  assert.equal(normal.defaultRowHeight, 48);
  assert.equal(comfortable.defaultRowHeight, 58);
  assert.notEqual(compact.cellPaddingClass, comfortable.cellPaddingClass);
});

test('createGridViewSnapshot captures a decoupled copy of state and applyGridViewSnapshot restores it cleanly', () => {
  const original = createMockGridState();
  const snapshot = createGridViewSnapshot(original);

  // Mutating original after snapshot should not mutate snapshot
  original.multiSortConfig!.push({ field: 'region', direction: 'asc' });
  assert.equal(snapshot.multiSortConfig!.length, 2);

  const blankState: DataGridState<any> = {
    ...createMockGridState(),
    currentPage: 5,
    globalFilter: '',
    columnFilters: {},
    sortConfig: null,
    multiSortConfig: [],
    groupedBy: [],
    density: 'normal',
    formulaColumns: [],
  };

  const restored = applyGridViewSnapshot(
    blankState,
    snapshot,
    ['name', 'revenue', 'region'],
    10
  );

  assert.equal(restored.currentPage, 1);
  assert.equal(restored.focusedCell, null);
  assert.equal(restored.globalFilter, 'enterprise');
  assert.equal(restored.density, 'compact');
  assert.equal(restored.multiSortConfig?.length, 2);
  assert.deepEqual(restored.groupedBy, ['region']);
  assert.equal(restored.formulaColumns?.length, 1);
  assert.equal(restored.formulaColumns?.[0].field, 'calc_margin');
});

test('rehydrateViewColumnFilters converts serialized ISO dates back to Date instances', () => {
  const raw: any = {
    createdAt: {
      type: 'date',
      preset: 'custom',
      value: '2026-01-15T00:00:00.000Z',
    },
  };
  const hydrated = rehydrateViewColumnFilters(raw);
  assert.ok((hydrated.createdAt as any).value instanceof Date);
});

test('mergeSavedViews deduplicates by id and marks built-in presets', () => {
  const merged = mergeSavedViews(
    [{ id: 'v1', name: 'Built-in 1', state: {} }],
    [
      { id: 'v1', name: 'Duplicate id', state: {} },
      { id: 'v2', name: 'Custom View', state: {} },
    ]
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].builtIn, true);
  assert.equal(merged[1].name, 'Custom View');
  assert.equal(merged[1].builtIn, false);
});

test('describeGridViewSummary formats concise human-readable view badges', () => {
  const summary = describeGridViewSummary({
    pivotMode: true,
    columnFilters: { a: { type: 'text', value: 'x' } },
    multiSortConfig: [{ field: 'a', direction: 'asc' }, { field: 'b', direction: 'desc' }],
    formulaColumns: [{ field: 'calc_x', headerText: 'X', formula: '=1' }],
    density: 'compact',
  });
  assert.equal(summary, 'Pivot · 1 filter · 2 sorts · 1 fx · Compact');
});
