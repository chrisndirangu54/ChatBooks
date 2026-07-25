"use client";

import { useId, useState, type ReactNode } from "react";
import { BarChart3, TableProperties } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The shell every chart on the dashboard sits in.
 *
 * It exists mostly to guarantee two things the charts shouldn't each reinvent:
 *  · a **table view** for the same numbers, so no value is reachable only by
 *    hovering a coloured mark, and
 *  · a **held frame** on refresh — stale data dims rather than collapsing into a
 *    skeleton, so cards never jump while new data lands.
 *
 * The legend lives in the header rather than under the plot, so series identity
 * is on screen before the reader reaches the marks.
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  action,
  stale = false,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  /** The same data as a table. Omit only for cards that are already a table. */
  table?: ReactNode;
  action?: ReactNode;
  stale?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const panelId = useId();

  return (
    <section
      className={cn(
        // h-full so cards sitting side by side in a grid align at the bottom
        // edge rather than each ending wherever its own plot happens to.
        "flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          {view === "chart" && legend}
          {action}
          {table && (
            <div
              role="group"
              aria-label={`${title} view`}
              className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5"
            >
              <ViewToggle
                active={view === "chart"}
                onClick={() => setView("chart")}
                label="Chart"
                controls={panelId}
              >
                <BarChart3 size={14} />
              </ViewToggle>
              <ViewToggle
                active={view === "table"}
                onClick={() => setView("table")}
                label="Table"
                controls={panelId}
              >
                <TableProperties size={14} />
              </ViewToggle>
            </div>
          )}
        </div>
      </header>

      <div id={panelId} data-stale={stale ? "true" : undefined} className={cn(bodyClassName)}>
        {view === "chart" ? children : table}
      </div>
    </section>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  controls,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  controls: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-controls={controls}
      title={`${label} view`}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
      )}
    >
      {children}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}

/**
 * Series key for a chart header. Mirrors the mark it stands for — a short stroke
 * for lines, a small rounded chip for bars and area fills — and keeps the label
 * in ink rather than in the series colour, which would be illegible for the
 * lighter hues and reads as decoration for the rest.
 */
export function LegendKey({
  items,
}: {
  items: Array<{ label: string; color: string; shape?: "line" | "chip" }>;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-slate-600">
          {item.shape === "line" ? (
            <span
              aria-hidden
              className="h-0.5 w-4 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          ) : (
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** A plain data table — the WCAG-clean twin of any chart on this dashboard. */
export function DataTable({
  columns,
  rows,
  align = [],
}: {
  columns: string[];
  rows: Array<Array<string | number>>;
  /** Per-column alignment; numeric columns should be "right". */
  align?: Array<"left" | "right">;
}) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={cn("py-2 pr-3", align[index] === "right" && "text-right")}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-6 text-center text-sm text-slate-400">
                No data for this period.
              </td>
            </tr>
          )}
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-50 last:border-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "py-2 pr-3 text-slate-600",
                    // Tabular figures here, where numbers stack vertically and
                    // need to line up — never on the big standalone values.
                    align[cellIndex] === "right" && "text-right font-medium tabular-nums text-slate-900",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
