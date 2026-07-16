import * as React from 'react';
import {
  buildSparklineGeometry,
  coerceSparklineValues,
  nearestSparklineIndex,
  type SparklineType,
} from '@/lib/sparkline';

export interface SparklineProps {
  values: any; // number[] expected; anything else renders nothing
  type?: SparklineType;
  width?: number;
  height?: number;
  color?: string; // stroke/fill for line/area/bar positives. Default: theme primary.
  negativeColor?: string; // bar/winloss negatives. Default: theme sparkline-negative.
  labels?: string[]; // per-point tooltip labels (e.g. months), aligned by index
  format?: (value: number) => string; // tooltip value formatting
  ariaLabel?: string;
}

// The line is drawn de-emphasized with the current (last) period accented — a
// sparkline answers "where is it now, how did it get here", so the newest point
// carries the emphasis.
const LINE_DE_EMPHASIS = 0.75;

export function Sparkline({
  values: rawValues,
  type = 'line',
  width = 120,
  height = 28,
  color,
  negativeColor,
  labels,
  format,
  ariaLabel,
}: SparklineProps) {
  const values = React.useMemo(() => coerceSparklineValues(rawValues), [rawValues]);
  const geometry = React.useMemo(
    () => buildSparklineGeometry(values, { type, width, height }),
    [values, type, width, height]
  );
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  if (values.length === 0) return null;

  const stroke = color || 'hsl(var(--primary))';
  const negFill = negativeColor || 'hsl(var(--sparkline-negative))';
  const posFill = type === 'winloss' || type === 'bar'
    ? (color || 'hsl(var(--sparkline-positive))')
    : stroke;

  const formatValue = format || ((v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }));

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const idx = nearestSparklineIndex(geometry, e.clientX - rect.left);
    setHoverIndex(idx);
    setTooltipPos({ x: e.clientX, y: rect.top });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setTooltipPos(null);
  };

  const hoverPoint = hoverIndex !== null ? geometry.points[hoverIndex] : undefined;
  const hoverBar = hoverIndex !== null ? geometry.bars[hoverIndex] : undefined;
  const hoverValue = hoverIndex !== null ? values[hoverIndex] : null;
  const lastPoint = geometry.points[geometry.points.length - 1];

  return (
    <span className="relative inline-flex align-middle" onMouseLeave={handleMouseLeave}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel || `Trend of ${values.length} values, latest ${formatValue(values[values.length - 1])}`}
        onMouseMove={handleMouseMove}
        className="overflow-visible"
      >
        {type === 'area' && geometry.areaPath && (
          <path d={geometry.areaPath} fill={stroke} opacity={0.14} stroke="none" />
        )}
        {(type === 'line' || type === 'area') && (
          <>
            <path
              d={geometry.linePath}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={LINE_DE_EMPHASIS}
            />
            {lastPoint && (
              <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill={stroke} stroke="none" />
            )}
            {hoverPoint && (
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r={3.5}
                fill={stroke}
                stroke="hsl(var(--card))"
                strokeWidth={1.5}
              />
            )}
          </>
        )}
        {(type === 'bar' || type === 'winloss') &&
          geometry.bars.map(bar => (
            <rect
              key={bar.index}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={Math.min(1.5, bar.width / 2)}
              fill={bar.positive ? posFill : negFill}
              opacity={hoverIndex === null || hoverIndex === bar.index ? 1 : 0.45}
            />
          ))}
      </svg>
      {hoverIndex !== null && tooltipPos && hoverValue !== null && (
        <span
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          style={{
            left: (hoverPoint ? (svgRef.current?.getBoundingClientRect().left ?? 0) + hoverPoint.x : hoverBar ? (svgRef.current?.getBoundingClientRect().left ?? 0) + hoverBar.x + hoverBar.width / 2 : tooltipPos.x),
            top: tooltipPos.y - 4,
          }}
          role="status"
        >
          {labels?.[hoverIndex] ? (
            <span className="mr-1 text-muted-foreground">{labels[hoverIndex]}</span>
          ) : null}
          <span className="font-medium">{formatValue(hoverValue)}</span>
        </span>
      )}
    </span>
  );
}
