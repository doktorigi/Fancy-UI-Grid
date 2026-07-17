import assert from 'node:assert/strict';
import test from 'node:test';
import type { ColumnDefinition, HierarchicalData, ProcessedRow } from '@/types/data-grid';
import {
  availableChartTypes,
  extractRangeChartData,
  foldPieSlices,
  formatCompact,
  niceTicks,
  pickDefaultChartType,
  stackSeries,
} from './rangeChart';

interface Row extends HierarchicalData<Row> {
  id: number;
  state?: string | null;
  premium?: number | string | null;
  fees?: number | null;
  trend?: number[];
}

function row(originalRow: Row): ProcessedRow<Row> {
  return { originalRow, id: originalRow.id, level: 0, hasChildren: false };
}

const columns: ColumnDefinition<Row>[] = [
  { field: 'state', headerText: 'State' },
  { field: 'premium', headerText: 'Premium' },
  { field: 'fees', headerText: 'Fees' },
  { field: 'trend', headerText: 'Trend', sparkline: { type: 'line' } },
];

const rows = [
  row({ id: 1, state: 'CA', premium: 100, fees: 10, trend: [1, 2] }),
  row({ id: 2, state: 'FL', premium: '250', fees: 20, trend: [2, 1] }),
  { ...row({ id: 99 }), isGroupHeader: true } as ProcessedRow<Row>,
  row({ id: 3, state: 'NY', premium: 300, fees: null, trend: [3, 1] }),
];

test('extractRangeChartData: first text column is the category axis, numeric columns are series', () => {
  const data = extractRangeChartData(rows, columns, { top: 0, bottom: 3, left: 0, right: 2 });
  assert.ok(data);
  assert.equal(data!.categoryLabel, 'State');
  assert.deepEqual(data!.categories, ['CA', 'FL', 'NY']); // group header skipped
  assert.deepEqual(data!.series.map(s => s.name), ['Premium', 'Fees']);
  assert.deepEqual(data!.series[0].values, [100, 250, 300]); // numeric strings coerce
  assert.deepEqual(data!.series[1].values, [10, 20, null]); // empty cell -> null
  assert.deepEqual(data!.droppedSeriesNames, []);
});

test('extractRangeChartData: all-numeric range falls back to Row N categories', () => {
  const data = extractRangeChartData(rows, columns, { top: 0, bottom: 1, left: 1, right: 2 });
  assert.ok(data);
  assert.equal(data!.categoryLabel, 'Row');
  assert.deepEqual(data!.categories, ['Row 1', 'Row 2']);
});

test('extractRangeChartData: sparkline columns are ignored, no numeric columns -> null', () => {
  assert.equal(extractRangeChartData(rows, columns, { top: 0, bottom: 1, left: 3, right: 3 }), null);
  assert.equal(extractRangeChartData(rows, columns, { top: 0, bottom: 1, left: 0, right: 0 }), null);
});

test('availableChartTypes: area/pie require non-negative; pie requires single series', () => {
  const single = { categories: ['a'], categoryLabel: 'X', droppedSeriesNames: [], series: [{ name: 's', values: [1] }] };
  assert.deepEqual(availableChartTypes(single), ['bar', 'line', 'area', 'pie']);
  const negative = { ...single, series: [{ name: 's', values: [1, -2] }] };
  assert.deepEqual(availableChartTypes(negative), ['bar', 'line']);
  const multi = { ...single, series: [{ name: 'a', values: [1] }, { name: 'b', values: [2] }] };
  assert.deepEqual(availableChartTypes(multi), ['bar', 'line', 'area']);
});

test('pickDefaultChartType: bars for few categories, line for many', () => {
  const few = { categories: ['a', 'b'], categoryLabel: '', droppedSeriesNames: [], series: [] };
  assert.equal(pickDefaultChartType(few), 'bar');
  const many = { ...few, categories: Array.from({ length: 30 }, (_, i) => String(i)) };
  assert.equal(pickDefaultChartType(many), 'line');
});

test('niceTicks produces 1/2/5-step ticks spanning the domain, always including zero-crossing domains', () => {
  const t = niceTicks(0, 97);
  assert.equal(t.niceMin, 0);
  assert.ok(t.niceMax >= 97);
  assert.deepEqual(t.ticks, [0, 20, 40, 60, 80, 100]);
  const neg = niceTicks(-50, 100);
  assert.ok(neg.ticks.includes(0));
  assert.ok(neg.niceMin <= -50 && neg.niceMax >= 100);
  const flat = niceTicks(5, 5);
  assert.ok(flat.ticks.length >= 2); // degenerate domain widens to include 0
});

test('formatCompact', () => {
  assert.equal(formatCompact(950), '950');
  assert.equal(formatCompact(1200), '1.2K');
  assert.equal(formatCompact(3400000), '3.4M');
  assert.equal(formatCompact(-2500), '-2.5K');
  assert.equal(formatCompact(2000), '2K');
});

test('stackSeries accumulates per category', () => {
  const stacked = stackSeries([
    { name: 'a', values: [1, 2] },
    { name: 'b', values: [10, null] },
  ]);
  assert.deepEqual(stacked, [[1, 2], [11, 2]]);
});

test('foldPieSlices sorts, drops non-positives, folds the tail into Other', () => {
  const slices = foldPieSlices(['a', 'b', 'c'], [30, 60, 10]);
  assert.deepEqual(slices.map(s => s.label), ['b', 'a', 'c']);
  assert.ok(Math.abs(slices[0].share - 0.6) < 1e-9);
  const many = foldPieSlices(
    Array.from({ length: 12 }, (_, i) => `c${i}`),
    Array.from({ length: 12 }, (_, i) => 12 - i),
    4
  );
  assert.equal(many.length, 4);
  assert.equal(many[many.length - 1].label, 'Other');
  assert.ok(Math.abs(many.reduce((a, s) => a + s.share, 0) - 1) < 1e-9);
  assert.deepEqual(foldPieSlices(['a'], [0]), []);
});
