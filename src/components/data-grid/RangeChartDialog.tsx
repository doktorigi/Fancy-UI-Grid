import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  availableChartTypes,
  foldPieSlices,
  formatCompact,
  niceTicks,
  pickDefaultChartType,
  stackSeries,
  type RangeChartData,
  type RangeChartType,
} from '@/lib/rangeChart';

// Categorical slots in fixed order — a series keeps its color regardless of how
// many others render (color follows the entity, never its rank).
const SLOT = (i: number) => `hsl(var(--chart-${i + 1}))`;

const CHART_W = 680;
const CHART_H = 340;
const MARGIN = { top: 16, right: 20, bottom: 44, left: 60 };
const PLOT_W = CHART_W - MARGIN.left - MARGIN.right;
const PLOT_H = CHART_H - MARGIN.top - MARGIN.bottom;

const TYPE_LABELS: Record<RangeChartType, string> = {
  bar: 'Bar',
  line: 'Line',
  area: 'Stacked Area',
  pie: 'Pie',
};
const TYPE_DISABLED_REASON: Record<RangeChartType, string> = {
  bar: '',
  line: '',
  area: 'Stacked area needs all values ≥ 0',
  pie: 'Pie needs a single series of non-negative values',
};

interface RangeChartDialogProps {
  data: RangeChartData;
  onClose: () => void;
}

interface HoverState {
  catIndex: number;
  seriesIndex: number | null; // null = crosshair (all series)
  clientX: number;
  clientY: number;
}

export function RangeChartDialog({ data, onClose }: RangeChartDialogProps) {
  const allowed = React.useMemo(() => availableChartTypes(data), [data]);
  const [type, setType] = React.useState<RangeChartType>(() => pickDefaultChartType(data));
  const [hover, setHover] = React.useState<HoverState | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const { categories, series } = data;
  const n = categories.length;

  // One y-scale across every series (stacked area scales by the stack top).
  const stackedTops = React.useMemo(() => (type === 'area' ? stackSeries(series) : null), [type, series]);
  const yDomain = React.useMemo(() => {
    const values = stackedTops
      ? stackedTops.flat()
      : series.flatMap(s => s.values).filter((v): v is number => v !== null);
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    return niceTicks(lo, hi);
  }, [series, stackedTops]);

  const yOf = (v: number) =>
    MARGIN.top + PLOT_H - ((v - yDomain.niceMin) / (yDomain.niceMax - yDomain.niceMin || 1)) * PLOT_H;
  const baselineY = yOf(0);

  // Bars use a band scale; line/area a point scale.
  const bandW = PLOT_W / Math.max(1, n);
  const bandCenter = (i: number) => MARGIN.left + bandW * i + bandW / 2;
  const pointX = (i: number) => (n === 1 ? MARGIN.left + PLOT_W / 2 : MARGIN.left + (i / (n - 1)) * PLOT_W);
  const xOf = type === 'bar' ? bandCenter : pointX;

  // At most ~10 x labels, evenly thinned, each truncated.
  const labelEvery = Math.max(1, Math.ceil(n / 10));
  const truncate = (s: string) => (s.length > 12 ? s.slice(0, 11) + '…' : s);

  const showTooltipAt = (catIndex: number, seriesIndex: number | null, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = rect.width / CHART_W; // SVG can render responsively scaled
    setHover({
      catIndex,
      seriesIndex,
      clientX: rect.left + xOf(catIndex) * scale,
      clientY,
    });
  };

  // Crosshair only for line/area — on bars the mark itself is the hit target.
  const hasCrosshair = type === 'line' || type === 'area';
  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    if (!hasCrosshair) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = rect.width / CHART_W;
    const px = (e.clientX - rect.left) / scale;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xOf(i) - px);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    showTooltipAt(best, null, rect.top + MARGIN.top * scale);
  };

  // Direct end labels on lines for <= 4 series when they don't collide (>= 14px
  // apart) — the CVD relief the palette WARN obligates; legend covers the rest.
  const endLabels = React.useMemo(() => {
    if (type !== 'line' || series.length < 2 || series.length > 4) return null;
    const entries = series
      .map((s, si) => {
        const lastIdx = s.values.length - 1;
        const v = s.values[lastIdx];
        return v === null ? null : { si, name: s.name, y: 0, value: v };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map(e => ({ ...e, y: yOf(e.value) }));
    entries.sort((a, b) => a.y - b.y);
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].y - entries[i - 1].y < 14) return null; // collide -> legend only
    }
    return entries;
  }, [type, series, yDomain]); // eslint-disable-line react-hooks/exhaustive-deps

  const pieSlices = React.useMemo(
    () => (type === 'pie' ? foldPieSlices(categories, series[0]?.values ?? []) : null),
    [type, categories, series]
  );

  const formatValue = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const renderAxes = () => (
    <g>
      {yDomain.ticks.map(t => (
        <g key={t}>
          <line
            x1={MARGIN.left}
            x2={MARGIN.left + PLOT_W}
            y1={yOf(t)}
            y2={yOf(t)}
            stroke="hsl(var(--border))"
            strokeWidth={t === 0 ? 1.25 : 1}
            opacity={t === 0 ? 0.9 : 0.5}
          />
          <text
            x={MARGIN.left - 8}
            y={yOf(t)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            fontSize={11}
          >
            {formatCompact(t)}
          </text>
        </g>
      ))}
      {categories.map((c, i) =>
        i % labelEvery === 0 ? (
          <text
            key={i}
            x={xOf(i)}
            y={MARGIN.top + PLOT_H + 16}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={11}
          >
            {truncate(c)}
          </text>
        ) : null
      )}
      <text
        x={MARGIN.left + PLOT_W / 2}
        y={CHART_H - 4}
        textAnchor="middle"
        className="fill-muted-foreground"
        fontSize={11}
      >
        {data.categoryLabel}
      </text>
    </g>
  );

  // Rounded only at the data end, anchored square at the baseline.
  const barPath = (x: number, w: number, vy: number, positive: boolean) => {
    const r = Math.min(3, w / 2, Math.abs(baselineY - vy));
    if (r < 1) {
      const top = Math.min(vy, baselineY);
      return `M${x} ${top}h${w}v${Math.max(1, Math.abs(baselineY - vy))}h${-w}Z`;
    }
    if (positive) {
      return `M${x} ${baselineY}V${vy + r}Q${x} ${vy} ${x + r} ${vy}H${x + w - r}Q${x + w} ${vy} ${x + w} ${vy + r}V${baselineY}Z`;
    }
    return `M${x} ${baselineY}V${vy - r}Q${x} ${vy} ${x + r} ${vy}H${x + w - r}Q${x + w} ${vy} ${x + w} ${vy - r}V${baselineY}Z`;
  };

  const renderBars = () => {
    const innerPad = Math.min(8, bandW * 0.15);
    const gap = 2; // surface gap between adjacent bars — identity survives without hue
    const groupW = bandW - innerPad * 2;
    const barW = Math.min(40, Math.max(2, (groupW - gap * (series.length - 1)) / series.length));
    const groupActualW = barW * series.length + gap * (series.length - 1);
    return series.map((s, si) => (
      <g key={s.name}>
        {s.values.map((v, ci) => {
          if (v === null) return null;
          const x = bandCenter(ci) - groupActualW / 2 + si * (barW + gap);
          const dim = hover && hover.catIndex !== ci;
          return (
            <path
              key={ci}
              d={barPath(x, barW, yOf(v), v >= 0)}
              fill={SLOT(si)}
              opacity={dim ? 0.45 : 1}
              onMouseEnter={(e) => showTooltipAt(ci, si, (e.target as SVGPathElement).getBoundingClientRect().top)}
            />
          );
        })}
      </g>
    ));
  };

  const linePathOf = (values: (number | null)[], yAt: (v: number, i: number) => number) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${round2(pointX(i))} ${round2(yAt(v, i))}`;
      pen = true;
    });
    return d;
  };

  const renderLines = () =>
    series.map((s, si) => (
      <g key={s.name}>
        <path
          d={linePathOf(s.values, v => yOf(v))}
          fill="none"
          stroke={SLOT(si)}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover && s.values[hover.catIndex] !== null && (
          <circle cx={pointX(hover.catIndex)} cy={yOf(s.values[hover.catIndex]!)} r={4}
            fill={SLOT(si)} stroke="hsl(var(--card))" strokeWidth={1.5} />
        )}
      </g>
    ));

  const renderAreas = () => {
    if (!stackedTops) return null;
    return series.map((s, si) => {
      const tops = stackedTops[si];
      const bottoms = si === 0 ? null : stackedTops[si - 1];
      let d = '';
      tops.forEach((t, i) => { d += `${i === 0 ? 'M' : 'L'}${round2(pointX(i))} ${round2(yOf(t))}`; });
      for (let i = n - 1; i >= 0; i--) {
        d += `L${round2(pointX(i))} ${round2(bottoms ? yOf(bottoms[i]) : baselineY)}`;
      }
      d += 'Z';
      return (
        <g key={s.name}>
          <path d={d} fill={SLOT(si)} opacity={0.28} stroke="none" />
          {/* band edge reads as the series line */}
          <path d={linePathOf(s.values.map((_, i) => tops[i]), v => yOf(v))} fill="none"
            stroke={SLOT(si)} strokeWidth={2} strokeLinejoin="round" />
          {hover && (
            <circle cx={pointX(hover.catIndex)} cy={yOf(tops[hover.catIndex])} r={4}
              fill={SLOT(si)} stroke="hsl(var(--card))" strokeWidth={1.5} />
          )}
        </g>
      );
    });
  };

  const renderPie = () => {
    if (!pieSlices || pieSlices.length === 0) {
      return (
        <text x={CHART_W / 2} y={CHART_H / 2} textAnchor="middle" className="fill-muted-foreground" fontSize={12}>
          No positive values to chart.
        </text>
      );
    }
    const cx = CHART_W / 2;
    const cy = MARGIN.top + PLOT_H / 2;
    const r = Math.min(PLOT_W, PLOT_H) / 2 - 4;
    let angle = -Math.PI / 2;
    return pieSlices.map((slice, i) => {
      const sweep = slice.share * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + sweep;
      angle = a1;
      const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
      const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      const large = sweep > Math.PI ? 1 : 0;
      const d = pieSlices.length === 1
        ? `M${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}Z`
        : `M${cx} ${cy}L${round2(p0[0])} ${round2(p0[1])}A${r} ${r} 0 ${large} 1 ${round2(p1[0])} ${round2(p1[1])}Z`;
      return (
        <path
          key={slice.label}
          d={d}
          fill={SLOT(i)}
          stroke="hsl(var(--card))"
          strokeWidth={2}
          opacity={hover && hover.catIndex !== i ? 0.5 : 1}
          onMouseEnter={(e) => {
            const rect = svgRef.current?.getBoundingClientRect();
            if (rect) setHover({ catIndex: i, seriesIndex: 0, clientX: e.clientX, clientY: rect.top + 24 });
          }}
        />
      );
    });
  };

  const legendEntries = type === 'pie'
    ? (pieSlices ?? []).map((s, i) => ({ name: `${s.label} — ${(s.share * 100).toFixed(0)}%`, color: SLOT(i) }))
    : series.map((s, si) => ({ name: s.name, color: SLOT(si) }));
  const showLegend = type === 'pie' || series.length >= 2;

  const tooltip = hover && (
    <div
      className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
      style={{ left: hover.clientX, top: hover.clientY - 6 }}
      role="status"
    >
      {type === 'pie' && pieSlices ? (
        <span>
          <span className="text-muted-foreground mr-1">{pieSlices[hover.catIndex]?.label}</span>
          <span className="font-medium">{formatValue(pieSlices[hover.catIndex]?.value ?? 0)}</span>
          <span className="text-muted-foreground"> ({((pieSlices[hover.catIndex]?.share ?? 0) * 100).toFixed(1)}%)</span>
        </span>
      ) : (
        <span>
          <div className="mb-0.5 text-muted-foreground">{categories[hover.catIndex]}</div>
          {(hover.seriesIndex !== null ? [series[hover.seriesIndex]] : series).map(s => {
            const si = series.indexOf(s);
            const v = s.values[hover.catIndex];
            return (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: SLOT(si) }} />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="ml-auto pl-2 font-medium">{v === null ? '—' : formatValue(v)}</span>
              </div>
            );
          })}
        </span>
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Chart Selection</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-1.5">
          {(['bar', 'line', 'area', 'pie'] as RangeChartType[]).map(t => (
            <Button
              key={t}
              size="sm"
              variant={type === t ? 'default' : 'outline'}
              disabled={!allowed.includes(t)}
              title={allowed.includes(t) ? undefined : TYPE_DISABLED_REASON[t]}
              onClick={() => { setType(t); setHover(null); }}
            >
              {TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
        <div onMouseLeave={() => setHover(null)}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="w-full"
            role="img"
            aria-label={`${TYPE_LABELS[type]} chart of ${series.map(s => s.name).join(', ')} by ${data.categoryLabel}`}
          >
            {type !== 'pie' && renderAxes()}
            {type === 'bar' && renderBars()}
            {type === 'line' && renderLines()}
            {type === 'area' && renderAreas()}
            {type === 'pie' && renderPie()}
            {endLabels?.map(e => (
              <text key={e.name} x={MARGIN.left + PLOT_W + 6} y={e.y} dominantBaseline="middle"
                fontSize={11} className="fill-muted-foreground">
                {truncate(e.name)}
              </text>
            ))}
            {hasCrosshair && hover && (
              <line
                x1={xOf(hover.catIndex)} x2={xOf(hover.catIndex)}
                y1={MARGIN.top} y2={MARGIN.top + PLOT_H}
                stroke="hsl(var(--muted-foreground))" strokeWidth={1} opacity={0.4}
                pointerEvents="none"
              />
            )}
            {hasCrosshair && (
              <rect
                x={MARGIN.left} y={MARGIN.top} width={PLOT_W} height={PLOT_H}
                fill="transparent"
                onMouseMove={handleOverlayMouseMove}
              />
            )}
          </svg>
        </div>
        {showLegend && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legend">
            {legendEntries.map(e => (
              <span key={e.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                {e.name}
              </span>
            ))}
          </div>
        )}
        {data.droppedSeriesNames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Only the first 8 numeric columns are charted — not shown: {data.droppedSeriesNames.join(', ')}.
          </p>
        )}
        {tooltip}
      </DialogContent>
    </Dialog>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
