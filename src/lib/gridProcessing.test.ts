import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActiveFilters, ColumnDefinition, HierarchicalData, ProcessedRow, SortConfig } from '@/types/data-grid';
import { computeAggregate, filterRows, sortRows } from './gridProcessing';

interface Row extends HierarchicalData<Row> {
  id: number;
  amount?: number | string | null;
  name?: string | null;
  group?: string | null;
  createdAt?: string | null;
  active?: boolean | null;
}

function row(originalRow: Row): ProcessedRow<Row> {
  return {
    originalRow,
    id: originalRow.id,
    level: 0,
    hasChildren: false,
  };
}

const amountColumn = (aggregate: ColumnDefinition<Row>['aggregate']): ColumnDefinition<Row> => ({
  field: 'amount',
  headerText: 'Amount',
  aggregate,
});

const columns = new Map<keyof Row & string, ColumnDefinition<Row>>([
  ['id', { field: 'id', headerText: 'ID' }],
  ['amount', { field: 'amount', headerText: 'Amount', filterType: 'number' }],
  ['name', { field: 'name', headerText: 'Name', filterType: 'text' }],
  ['group', { field: 'group', headerText: 'Group', filterType: 'text' }],
  ['createdAt', { field: 'createdAt', headerText: 'Created', filterType: 'date' }],
  ['active', { field: 'active', headerText: 'Active', filterType: 'boolean' }],
]);

const columnDefs = Array.from(columns.values());
const allVisibleColumns = columnDefs.map(column => column.field);

function sortBy(field: keyof Row & string, direction: SortConfig<Row>['direction']): SortConfig<Row> {
  return { field, direction };
}

function rowIds(processedRows: ProcessedRow<Row>[]): number[] {
  return processedRows.map(processedRow => Number(processedRow.id));
}

function applyFilters(
  processedRows: ProcessedRow<Row>[],
  columnFilters: ActiveFilters<Row>,
  globalFilter = '',
  visibleColumns = allVisibleColumns
): number[] {
  return rowIds(
    filterRows({
      rows: processedRows,
      columns: columnDefs,
      visibleColumns,
      globalFilter,
      columnFilters,
      now: new Date('2026-07-09T12:00:00Z'),
    })
  );
}

const rows = [
  row({ id: 1, amount: 10 }),
  row({ id: 2, amount: '20.5' }),
  row({ id: 3, amount: null }),
  row({ id: 4, amount: 'not a number' }),
];

test('computeAggregate counts rows', () => {
  assert.equal(computeAggregate(rows, amountColumn('count')), '4');
});

test('computeAggregate sums numeric cell values', () => {
  assert.equal(computeAggregate(rows, amountColumn('sum')), '30.5');
});

test('computeAggregate averages numeric cell values', () => {
  assert.equal(computeAggregate(rows, amountColumn('avg')), '15.25');
});

test('computeAggregate returns min and max numeric cell values', () => {
  assert.equal(computeAggregate(rows, amountColumn('min')), '10');
  assert.equal(computeAggregate(rows, amountColumn('max')), '20.5');
});

test('computeAggregate ignores unsupported or empty aggregates', () => {
  assert.equal(computeAggregate(rows, amountColumn(undefined)), '');
  assert.equal(computeAggregate([row({ id: 1, amount: null })], amountColumn('sum')), '');
});

test('sortRows sorts numeric values by direction with nulls last for ascending', () => {
  const unsortedRows = [
    row({ id: 1, amount: 10 }),
    row({ id: 2, amount: null }),
    row({ id: 3, amount: 5 }),
  ];

  assert.deepEqual(rowIds(sortRows(unsortedRows, columns, sortBy('amount', 'asc'))), [3, 1, 2]);
  assert.deepEqual(rowIds(sortRows(unsortedRows, columns, sortBy('amount', 'desc'))), [2, 1, 3]);
});

test('sortRows sorts strings and date-like values', () => {
  const unsortedRows = [
    row({ id: 1, name: 'Charlie', createdAt: '2026-07-09' }),
    row({ id: 2, name: 'Alice', createdAt: '2026-07-07' }),
    row({ id: 3, name: 'Bob', createdAt: '2026-07-08' }),
  ];

  assert.deepEqual(rowIds(sortRows(unsortedRows, columns, sortBy('name', 'asc'))), [2, 3, 1]);
  assert.deepEqual(rowIds(sortRows(unsortedRows, columns, sortBy('createdAt', 'desc'))), [1, 3, 2]);
});

test('sortRows applies grouped fields before the active sort', () => {
  const unsortedRows = [
    row({ id: 1, group: 'B', amount: 2 }),
    row({ id: 2, group: 'A', amount: 3 }),
    row({ id: 3, group: 'B', amount: 1 }),
    row({ id: 4, group: 'A', amount: 4 }),
  ];

  assert.deepEqual(
    rowIds(sortRows(unsortedRows, columns, sortBy('amount', 'asc'), ['group'])),
    [2, 4, 3, 1]
  );
});

test('sortRows leaves tree data out of grouped precedence', () => {
  const unsortedRows = [
    row({ id: 1, group: 'B', amount: 2 }),
    row({ id: 2, group: 'A', amount: 3 }),
    row({ id: 3, group: 'B', amount: 1 }),
  ];

  assert.deepEqual(
    rowIds(sortRows(unsortedRows, columns, sortBy('amount', 'asc'), ['group'], true)),
    [3, 1, 2]
  );
});

test('filterRows applies global filter only to visible columns', () => {
  const unfilteredRows = [
    row({ id: 1, name: 'Alpha', group: 'HiddenMatch' }),
    row({ id: 2, name: 'VisibleMatch', group: 'Other' }),
  ];

  assert.deepEqual(
    applyFilters(unfilteredRows, {}, 'match', ['id', 'name']),
    [2]
  );
});

test('filterRows applies text, select, and boolean filters', () => {
  const unfilteredRows = [
    row({ id: 1, name: 'Alpha', group: 'A', active: true }),
    row({ id: 2, name: 'Beta', group: 'B', active: false }),
    row({ id: 3, name: 'Alphabet', group: 'A', active: true }),
  ];

  assert.deepEqual(applyFilters(unfilteredRows, { name: { type: 'text', value: 'alpha' } }), [1, 3]);
  assert.deepEqual(applyFilters(unfilteredRows, { group: { type: 'select', value: 'B' } }), [2]);
  assert.deepEqual(applyFilters(unfilteredRows, { active: { type: 'boolean', value: true } }), [1, 3]);
  assert.deepEqual(applyFilters(unfilteredRows, { active: { type: 'boolean', value: undefined } }), [1, 2, 3]);
});

test('filterRows applies number filters', () => {
  const unfilteredRows = [
    row({ id: 1, amount: 10 }),
    row({ id: 2, amount: 20 }),
    row({ id: 3, amount: 30 }),
  ];

  assert.deepEqual(applyFilters(unfilteredRows, { amount: { type: 'number', operator: '>', value: 10 } }), [2, 3]);
  assert.deepEqual(applyFilters(unfilteredRows, { amount: { type: 'number', operator: 'between', value: 15, value2: 25 } }), [2]);
  assert.deepEqual(applyFilters(unfilteredRows, { amount: { type: 'number', operator: 'between', value2: 20 } }), [1, 2]);
});

test('filterRows applies date presets and custom ranges', () => {
  const unfilteredRows = [
    row({ id: 1, createdAt: '2026-07-09T12:00:00' }),
    row({ id: 2, createdAt: '2026-07-08T12:00:00' }),
    row({ id: 3, createdAt: '2026-07-03T12:00:00' }),
    row({ id: 4, createdAt: '2026-06-15T12:00:00' }),
  ];

  assert.deepEqual(applyFilters(unfilteredRows, { createdAt: { type: 'date', preset: 'today' } }), [1]);
  assert.deepEqual(applyFilters(unfilteredRows, { createdAt: { type: 'date', preset: 'yesterday' } }), [2]);
  assert.deepEqual(applyFilters(unfilteredRows, { createdAt: { type: 'date', preset: 'last7days' } }), [1, 2, 3]);
  assert.deepEqual(applyFilters(unfilteredRows, { createdAt: { type: 'date', preset: 'thisMonth' } }), [1, 2, 3]);
  assert.deepEqual(applyFilters(unfilteredRows, { createdAt: { type: 'date', preset: 'lastMonth' } }), [4]);
  assert.deepEqual(
    applyFilters(unfilteredRows, {
      createdAt: {
        type: 'date',
        preset: 'custom',
        value: new Date(2026, 6, 2),
        value2: new Date(2026, 6, 9),
      },
    }),
    [1, 2, 3]
  );
});

test('filterRows ignores filters for hidden or unknown columns', () => {
  const unfilteredRows = [
    row({ id: 1, name: 'Alpha' }),
    row({ id: 2, name: 'Beta' }),
  ];

  assert.deepEqual(applyFilters(unfilteredRows, { name: { type: 'text', value: 'alpha' } }, '', ['id']), [1, 2]);
  assert.deepEqual(applyFilters(unfilteredRows, { missing: { type: 'text', value: 'alpha' } }), [1, 2]);
});
