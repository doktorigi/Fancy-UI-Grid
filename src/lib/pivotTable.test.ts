import assert from 'node:assert/strict';
import test from 'node:test';
import type { ColumnDefinition, HierarchicalData, ProcessedRow } from '@/types/data-grid';
import {
  buildPivotTable,
  computeNumericAggregate,
  deriveDefaultPivotValues,
} from './pivotTable';

interface PolicyRow extends HierarchicalData<PolicyRow> {
  id: number;
  program: string;
  state: string;
  premium: number;
  lossRatio: number;
}

function makeProcessed(r: PolicyRow): ProcessedRow<PolicyRow> {
  return {
    id: r.id,
    originalRow: r,
    level: 0,
    hasChildren: false,
  };
}

const sampleColumns: ColumnDefinition<PolicyRow>[] = [
  { field: 'program', headerText: 'Program', filterType: 'select' },
  { field: 'state', headerText: 'State', filterType: 'select' },
  {
    field: 'premium',
    headerText: 'Premium',
    filterType: 'number',
    aggregate: 'sum',
    cellRenderer: v => `$${Number(v).toLocaleString('en-US')}`,
  },
  {
    field: 'lossRatio',
    headerText: 'Loss Ratio',
    filterType: 'number',
    aggregate: 'avg',
  },
];

const sampleRows: ProcessedRow<PolicyRow>[] = [
  makeProcessed({ id: 1, program: 'Umbrella', state: 'CA', premium: 1000, lossRatio: 40 }),
  makeProcessed({ id: 2, program: 'Umbrella', state: 'CA', premium: 2000, lossRatio: 60 }),
  makeProcessed({ id: 3, program: 'Umbrella', state: 'NY', premium: 1500, lossRatio: 50 }),
  makeProcessed({ id: 4, program: 'CPL', state: 'CA', premium: 500, lossRatio: 20 }),
  makeProcessed({ id: 5, program: 'CPL', state: 'TX', premium: 800, lossRatio: 80 }),
];

test('deriveDefaultPivotValues extracts aggregate columns in order', () => {
  const defaults = deriveDefaultPivotValues(sampleColumns);
  assert.deepEqual(defaults, [
    { field: 'premium', aggregate: 'sum', headerText: 'Premium' },
    { field: 'lossRatio', aggregate: 'avg', headerText: 'Loss Ratio' },
  ]);
});

test('computeNumericAggregate computes sum, avg, min, max, count and handles empty buckets', () => {
  assert.equal(computeNumericAggregate([], 'premium', 'sum'), null);
  assert.equal(computeNumericAggregate(sampleRows, 'premium', 'count'), 5);
  assert.equal(computeNumericAggregate(sampleRows, 'premium', 'sum'), 5800);
  assert.equal(computeNumericAggregate(sampleRows, 'premium', 'avg'), 1160);
  assert.equal(computeNumericAggregate(sampleRows, 'premium', 'min'), 500);
  assert.equal(computeNumericAggregate(sampleRows, 'premium', 'max'), 2000);
});

test('buildPivotTable cross-tabulates single value metric by pivot column with row and column grand totals', () => {
  const result = buildPivotTable({
    rows: sampleRows,
    columns: sampleColumns,
    rowGroupFields: ['program'],
    pivotFields: ['state'],
    valueConfigs: [{ field: 'premium', aggregate: 'sum', headerText: 'Premium' }],
    showRowTotals: true,
  });

  // Sorted unique state pivot keys
  assert.deepEqual(result.pivotKeys, ['CA', 'NY', 'TX']);

  // Columns: Program (pinned left) + CA + NY + TX + Total
  assert.deepEqual(
    result.columns.map(c => c.field),
    [
      'program',
      '__pivot_col__CA__premium__sum',
      '__pivot_col__NY__premium__sum',
      '__pivot_col__TX__premium__sum',
      '__pivot_total__premium__sum',
    ]
  );

  // 2 row groups: Umbrella and CPL
  assert.equal(result.rows.length, 2);
  const umbrellaRow = result.rows.find(r => r.originalRow.program === 'Umbrella')!.originalRow as any;
  const cplRow = result.rows.find(r => r.originalRow.program === 'CPL')!.originalRow as any;

  assert.equal(umbrellaRow['__pivot_col__CA__premium__sum'], 3000);
  assert.equal(umbrellaRow['__pivot_col__NY__premium__sum'], 1500);
  assert.equal(umbrellaRow['__pivot_col__TX__premium__sum'], null);
  assert.equal(umbrellaRow['__pivot_total__premium__sum'], 4500);

  assert.equal(cplRow['__pivot_col__CA__premium__sum'], 500);
  assert.equal(cplRow['__pivot_col__NY__premium__sum'], null);
  assert.equal(cplRow['__pivot_col__TX__premium__sum'], 800);
  assert.equal(cplRow['__pivot_total__premium__sum'], 1300);

  // Column grand totals across all rows
  assert.equal(result.grandTotalValues['__pivot_col__CA__premium__sum'], 3500);
  assert.equal(result.grandTotalValues['__pivot_col__NY__premium__sum'], 1500);
  assert.equal(result.grandTotalValues['__pivot_col__TX__premium__sum'], 800);
  assert.equal(result.grandTotalValues['__pivot_total__premium__sum'], 5800);

  // Cell renderer preserves currency formatting for non-null values and returns '—' for null
  const caCol = result.columns.find(c => c.field === '__pivot_col__CA__premium__sum')!;
  assert.equal(caCol.cellRenderer!(3000, umbrellaRow), '$3,000');
  assert.equal(caCol.cellRenderer!(null, umbrellaRow), '—');
});

test('buildPivotTable supports multiple value metrics and computes true underlying averages for grand totals', () => {
  const result = buildPivotTable({
    rows: sampleRows,
    columns: sampleColumns,
    rowGroupFields: ['program'],
    pivotFields: ['state'],
    valueConfigs: [
      { field: 'premium', aggregate: 'sum', headerText: 'Premium' },
      { field: 'lossRatio', aggregate: 'avg', headerText: 'Loss Ratio' },
    ],
    showRowTotals: true,
  });

  // In CA: Umbrella has two rows (40, 60 -> avg 50), CPL has one row (20 -> avg 20).
  // True grand total average across all 3 CA rows is (40 + 60 + 20) / 3 = 40 (NOT (50 + 20) / 2 = 35).
  assert.equal(result.grandTotalValues['__pivot_col__CA__lossRatio__avg'], 40);
  assert.equal(result.grandTotalValues['__pivot_total__lossRatio__avg'], 50);
});
