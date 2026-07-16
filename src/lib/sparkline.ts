// Pure geometry for in-cell sparklines. No DOM, no React — everything here is
// deterministic from (values, options) so it can be unit-tested directly. The
// Sparkline component consumes this and only adds SVG + hover.

export type SparklineType = 'line' | 'area' | 'bar' | 'winloss';

export interface SparklineBar {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  index: number;
  positive: boolean; // value >= 0
}

export interface SparklinePoint {
  x: number;
  y: number;
  value: number;
  index: number;
}

export interface SparklineGeometry {
  type: SparklineType;
  width: number;
  height: number;
  points: SparklinePoint[]; // line/area (empty for bar types)
  linePath: string; // '' for bar types
  areaPath: string; // '' unless type === 'area'
  bars: SparklineBar[]; // bar/winloss (empty for line types)
  min: number;
  max: number;
  last: number | null;
}

export interface SparklineGeometryOptions {
  type: SparklineType;
  width: number;
  height: number;
  padding?: number; // inner padding so 2px strokes/markers don't clip. Default 3.
  barGap?: number; // horizontal gap between bars. Default 1.
}

const EMPTY: Omit<SparklineGeometry, 'type' | 'width' | 'height'> = {
  points: [],
  linePath: '',
  areaPath: '',
  bars: [],
  min: 0,
  max: 0,
  last: null,
};

export function coerceSparklineValues(raw: any): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(v => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter(n => Number.isFinite(n));
}

export function buildSparklineGeometry(
  values: number[],
  { type, width, height, padding = 3, barGap = 1 }: SparklineGeometryOptions
): SparklineGeometry {
  const base: SparklineGeometry = { type, width, height, ...EMPTY };
  if (values.length === 0 || width <= 0 || height <= 0) return base;

  const min = Math.min(...values);
  const max = Math.max(...values);
  base.min = min;
  base.max = max;
  base.last = values[values.length - 1];

  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);

  if (type === 'line' || type === 'area') {
    // Flat series draw as a midline rather than collapsing onto an edge.
    const span = max - min;
    const yOf = (v: number) =>
      span === 0 ? padding + innerH / 2 : padding + (1 - (v - min) / span) * innerH;
    const xOf = (i: number) =>
      values.length === 1 ? padding + innerW / 2 : padding + (i / (values.length - 1)) * innerW;

    base.points = values.map((value, index) => ({
      x: round2(xOf(index)),
      y: round2(yOf(value)),
      value,
      index,
    }));
    base.linePath = base.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`)
      .join('');
    if (type === 'area' && base.points.length > 1) {
      const floor = round2(padding + innerH);
      const first = base.points[0];
      const lastPt = base.points[base.points.length - 1];
      base.areaPath = `${base.linePath}L${lastPt.x} ${floor}L${first.x} ${floor}Z`;
    }
    return base;
  }

  // Bar variants. Bars split the inner width evenly with barGap between them.
  const n = values.length;
  const barW = Math.max(1, (innerW - barGap * (n - 1)) / n);
  const xOfBar = (i: number) => round2(padding + i * (barW + barGap));

  if (type === 'winloss') {
    // Sign-only encoding: equal-height blocks above/below the midline, magnitude
    // deliberately ignored. Zero renders a thin tick on the midline.
    const mid = padding + innerH / 2;
    const block = Math.max(1, innerH / 2 - 1);
    base.bars = values.map((value, index) => {
      const positive = value >= 0;
      const height2 = value === 0 ? 1 : block;
      return {
        x: xOfBar(index),
        y: round2(value === 0 ? mid - 0.5 : positive ? mid - block : mid),
        width: round2(barW),
        height: round2(height2),
        value,
        index,
        positive,
      };
    });
    return base;
  }

  // 'bar': magnitude bars anchored to a zero baseline clamped into the domain.
  const domainMin = Math.min(0, min);
  const domainMax = Math.max(0, max);
  const span = domainMax - domainMin || 1;
  const yOfVal = (v: number) => padding + (1 - (v - domainMin) / span) * innerH;
  const baselineY = yOfVal(0);
  base.bars = values.map((value, index) => {
    const yTop = Math.min(yOfVal(value), baselineY);
    const h = Math.max(1, Math.abs(yOfVal(value) - baselineY));
    return {
      x: xOfBar(index),
      y: round2(yTop),
      width: round2(barW),
      height: round2(h),
      value,
      index,
      positive: value >= 0,
    };
  });
  return base;
}

// Nearest sample index for a pointer x offset — the whole strip is the hit target,
// not just the 2px mark.
export function nearestSparklineIndex(
  geometry: SparklineGeometry,
  pointerX: number
): number | null {
  if (geometry.points.length > 0) {
    let best = 0;
    let bestDist = Infinity;
    geometry.points.forEach((p, i) => {
      const d = Math.abs(p.x - pointerX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }
  if (geometry.bars.length > 0) {
    let best = 0;
    let bestDist = Infinity;
    geometry.bars.forEach((b, i) => {
      const center = b.x + b.width / 2;
      const d = Math.abs(center - pointerX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
