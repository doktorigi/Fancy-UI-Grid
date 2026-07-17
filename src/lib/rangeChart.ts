// Pure logic for "Chart Selection": turning a cell range into chart-ready data,
// plus the scale/format helpers the renderer needs. No DOM, no React.

import type { ColumnDefinition, HierarchicalData, ProcessedRow } from '@/types/data-grid';
import { getCellValue } from './utils';
import { toStrictNumber } from './gridProcessing';

export const MAX_CHART_SERIES = 8; // categorical slots are fixed — never cycle hues

export type RangeChartType = 'bar' | 'line' | 'area' | 'pie';

export interface RangeChartSeries {
  name: string;
  values: (number | null)[]; // aligned with categories; null = empty/non-numeric cell
}

export interface RangeChartData {
  categories: string[];
  categoryLabel: string; // header of the category column, or 'Row'
  series: RangeChartSeries[];
  droppedSeriesNames: string[]; // numeric columns beyond MAX_CHART_SERIES — never dropped silently
}

// A column is a series candidate when every non-empty cell in the range coerces to a
// number; the first non-numeric column (left to right) becomes the category axis.
export function extractRangeChartData<TData extends HierarchicalData<TData>>(
  rows: ProcessedRow<TData>[],
  columns: ColumnDefinition<TData>[],
  bounds: { top: number; bottom: number; left: number; right: number }
): RangeChartData | null {
  const dataRows: ProcessedRow<TData>[] = [];
  for (let r = bounds.top; r <= bounds.bottom; r++) {
    const row = rows[r];
    if (row && !row.isGroupHeader) dataRows.push(row);
  }
  if (dataRows.length === 0) return null;

  const rangeCols = columns.slice(bounds.left, bounds.right + 1).filter(Boolean);
  if (rangeCols.length === 0) return null;

  const numericCols: ColumnDefinition<TData>[] = [];
  let categoryCol: ColumnDefinition<TData> | null = null;
  rangeCols.forEach(col => {
    // Sparkline columns hold arrays — they are neither series nor categories.
    if (col.sparkline) return;
    const cells = dataRows
      .map(row => getCellValue(row, col.field))
      .filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    const isNumeric = cells.length > 0 && cells.every(v => toStrictNumber(v) !== null);
    if (isNumeric) {
      numericCols.push(col);
    } else if (!categoryCol) {
      categoryCol = col;
    }
  });

  if (numericCols.length === 0) return null;

  const kept = numericCols.slice(0, MAX_CHART_SERIES);
  const series: RangeChartSeries[] = kept.map(col => ({
    name: col.headerText,
    values: dataRows.map(row => toStrictNumber(getCellValue(row, col.field))),
  }));

  const catCol = categoryCol as ColumnDefinition<TData> | null;
  const categories = catCol
    ? dataRows.map(row => {
        const v = getCellValue(row, catCol.field);
        return v === null || v === undefined ? '' : String(v);
      })
    : dataRows.map((_, i) => `Row ${i + 1}`);

  return {
    categories,
    categoryLabel: catCol ? catCol.headerText : 'Row',
    series,
    droppedSeriesNames: numericCols.slice(MAX_CHART_SERIES).map(c => c.headerText),
  };
}

// Which chart types make sense for this data. One y-scale only, so every type
// charts the same domain; area stacks, so it requires non-negative values; pie is
// a single series of non-negative parts.
export function availableChartTypes(data: RangeChartData): RangeChartType[] {
  const types: RangeChartType[] = ['bar', 'line'];
  const allNonNegative = data.series.every(s => s.values.every(v => v === null || v >= 0));
  if (allNonNegative) types.push('area');
  if (data.series.length === 1 && allNonNegative) types.push('pie');
  return types;
}

export function pickDefaultChartType(data: RangeChartData): RangeChartType {
  // Many categories read better as a line; few as bars.
  return data.categories.length > 24 ? 'line' : 'bar';
}

// Standard nice-number ticks: ~count steps of 1/2/5 × 10^n covering [min, max].
export function niceTicks(min: number, max: number, count = 5): { ticks: number[]; niceMin: number; niceMax: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ticks: [0], niceMin: 0, niceMax: 0 };
  if (min === max) {
    if (min === 0) return { ticks: [0, 1], niceMin: 0, niceMax: 1 };
    min = Math.min(min, 0);
    max = Math.max(max, 0);
    if (min === max) return { ticks: [0, 1], niceMin: 0, niceMax: 1 };
  }
  const span = max - min;
  const rawStep = span / Math.max(1, count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  // d3-style thresholds (sqrt of 50/10/2) round to the nearest 1/2/5 step rather
  // than always up, giving denser, nicer ticks.
  const step = (norm >= 7.07 ? 10 : norm >= 3.16 ? 5 : norm >= 1.41 ? 2 : 1) * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // Guard float drift with an epsilon-bounded loop.
  for (let t = niceMin; t <= niceMax + step / 1e6; t += step) {
    ticks.push(Math.abs(t) < step / 1e6 ? 0 : Number(t.toPrecision(12)));
  }
  return { ticks, niceMin, niceMax };
}

// Axis-label formatting: compact, no decimals noise (1200 -> 1.2K, 3400000 -> 3.4M).
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return trimZero(value / 1e9) + 'B';
  if (abs >= 1e6) return trimZero(value / 1e6) + 'M';
  if (abs >= 1e3) return trimZero(value / 1e3) + 'K';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function trimZero(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

// Cumulative sums per category for stacked areas: out[s][c] = sum of series 0..s at c.
export function stackSeries(series: RangeChartSeries[]): number[][] {
  const n = series[0]?.values.length ?? 0;
  const out: number[][] = [];
  const running = new Array(n).fill(0);
  series.forEach(s => {
    const tops = s.values.map((v, c) => {
      running[c] += v ?? 0;
      return running[c];
    });
    out.push(tops);
  });
  return out;
}

export interface PieSlice {
  label: string;
  value: number;
  share: number; // 0..1
}

// Pie readability caps at MAX_CHART_SERIES slices — the tail folds into 'Other'
// (a fold, not a silent drop).
export function foldPieSlices(categories: string[], values: (number | null)[], maxSlices = MAX_CHART_SERIES): PieSlice[] {
  const entries = categories
    .map((label, i) => ({ label, value: values[i] ?? 0 }))
    .filter(e => e.value > 0);
  entries.sort((a, b) => b.value - a.value);
  const total = entries.reduce((a, e) => a + e.value, 0);
  if (total <= 0) return [];
  let head = entries;
  if (entries.length > maxSlices) {
    head = entries.slice(0, maxSlices - 1);
    const otherValue = entries.slice(maxSlices - 1).reduce((a, e) => a + e.value, 0);
    head = [...head, { label: 'Other', value: otherValue }];
  }
  return head.map(e => ({ ...e, share: e.value / total }));
}
