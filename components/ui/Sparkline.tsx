"use client";

import { useMemo } from "react";
import { VIZ } from "@/lib/viz";

const WIDTH = 100;
const HEIGHT = 32;
/** Horizontal inset so the end marker's full circle and ring stay in frame. */
const INSET_X = 3;

/**
 * The trend line inside a stat tile — 12-ish points, no axes, no labels.
 *
 * A sparkline is a shape, not a readout: the tile's own value carries the
 * number, and the full series is in the chart card below it. So there's
 * deliberately nothing to hover here.
 *
 * Drawn as raw SVG rather than through recharts because a dozen of these on one
 * screen shouldn't each mount a chart container. `non-scaling-stroke` keeps the
 * 2px line at 2px even though the viewBox stretches to the tile width.
 */
export function Sparkline({
  values,
  color = VIZ.seq[3],
  /** Wash under the line. Off for dense tiles where it muddies the shape. */
  fill = true,
  delay = 0,
  className,
}: {
  values: number[];
  color?: string;
  fill?: boolean;
  delay?: number;
  className?: string;
}) {
  const geometry = useMemo(() => {
    if (values.length === 0) return null;

    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const span = max - min || 1;
    const plotWidth = WIDTH - INSET_X * 2;
    const step = values.length > 1 ? plotWidth / (values.length - 1) : 0;

    const points = values.map((value, index) => ({
      x: values.length > 1 ? INSET_X + index * step : WIDTH / 2,
      // Inset by 3px top and bottom so the stroke and end dot never clip.
      y: HEIGHT - 3 - ((value - min) / span) * (HEIGHT - 6),
    }));

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    // Close the wash down to the baseline at the line's own end points, so the
    // fill doesn't flare out past where the data actually stops.
    const area = `${line} L${WIDTH - INSET_X} ${HEIGHT} L${INSET_X} ${HEIGHT} Z`;

    return { line, area, last: points[points.length - 1] };
  }, [values]);

  if (!geometry) return null;

  const gradientId = `spark-${color.replace("#", "")}`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={className}
      role="presentation"
      aria-hidden="true"
      style={{ "--draw-delay": `${delay}ms` } as React.CSSProperties}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              {/* ~10% wash at the top, gone by the baseline — a hint of volume,
                  never a saturated block. */}
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={geometry.area} fill={`url(#${gradientId})`} className="animate-wash" />
        </>
      )}

      <path
        d={geometry.line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        className="animate-draw"
      />

      {/* End marker: the current period, ringed in the surface colour so it stays
          legible where it sits on the line. */}
      <circle
        cx={geometry.last.x}
        cy={geometry.last.y}
        r={2.5}
        fill={color}
        stroke={VIZ.surface}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        className="animate-wash"
      />
    </svg>
  );
}
