"use client";

import { readableOn, type SourceSlice } from "@/lib/viz";
import { ChartCard, DataTable } from "./ChartCard";

/** Under this share, a percentage label can't sit inside its own segment. */
const LABEL_FITS_ABOVE = 12;

/**
 * How the books got written — chat, receipt scan, or typed by hand.
 *
 * Part-to-whole over a fixed set of three, so it's a stacked bar rather than a
 * donut: segments share one baseline and stay comparable even when two of them
 * are close. Hand-built instead of charted because the whole geometry is one
 * row, and this way the 2px surface gaps between segments are exactly 2px.
 *
 * Colour follows the source, not its size — the biggest slice today doesn't take
 * slot 1, `chat` always does. Filtering or a quiet week never repaints it.
 */
export function SourceMixBar({
  data,
  title = "How records got logged",
  subtitle,
}: {
  data: SourceSlice[];
  title?: string;
  subtitle?: string;
}) {
  const visible = data.filter((slice) => slice.share > 0);
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      table={
        <DataTable
          columns={["Source", "Records", "Share"]}
          align={["left", "right", "right"]}
          rows={data.map((slice) => [slice.label, slice.count, `${slice.share.toFixed(1)}%`])}
        />
      }
    >
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No records yet.</p>
      ) : (
        <>
          <div className="flex h-8 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100">
            {visible.map((slice, index) => (
              <div
                key={slice.source}
                tabIndex={0}
                aria-label={`${slice.label}: ${slice.count} records, ${slice.share.toFixed(1)}%`}
                className="group relative flex items-center justify-center animate-grow-x focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
                style={
                  {
                    width: `${slice.share}%`,
                    backgroundColor: slice.color,
                    "--draw-delay": `${index * 90}ms`,
                  } as React.CSSProperties
                }
              >
                {/* Only label inside the fill when it actually fits; otherwise the
                    legend, tooltip and table carry the number. */}
                {slice.share >= LABEL_FITS_ABOVE && (
                  <span
                    className="text-xs font-semibold"
                    style={{ color: readableOn(slice.color) }}
                  >
                    {Math.round(slice.share)}%
                  </span>
                )}

                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-slate-900/10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  <span className="font-semibold text-slate-900">{slice.count} records</span>
                  <span className="text-slate-500"> · {slice.label}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Legend doubles as the readout, so every share is visible without
              hovering anything. */}
          <ul className="mt-4 space-y-2">
            {data.map((slice) => (
              <li key={slice.source} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="flex-1 text-slate-600">{slice.label}</span>
                <span className="tabular-nums text-slate-500">{slice.count}</span>
                <span className="w-12 text-right font-medium tabular-nums text-slate-900">
                  {slice.share.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}
