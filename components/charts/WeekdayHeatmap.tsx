"use client";

import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { VIZ, heatStep, type HeatCell } from "@/lib/viz";
import { ChartCard, DataTable } from "./ChartCard";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Sales intensity by weekday across the last few weeks — which days of the week
 * actually earn.
 *
 * Magnitude, so one hue light→dark. The lightest step means "nothing happened"
 * and is allowed to recede almost into the surface; every other bin is a real
 * step of the ramp. A scale legend sits underneath because a continuous encoding
 * can't be read from the cells alone.
 */
export function WeekdayHeatmap({
  cells,
  currency,
  weeks,
  title = "Which days earn",
  subtitle,
}: {
  cells: HeatCell[];
  currency: string;
  weeks: number;
  title?: string;
  subtitle?: string;
}) {
  const max = Math.max(...cells.map((cell) => cell.sales), 0);

  const rows: HeatCell[][] = Array.from({ length: weeks }, (_, week) =>
    cells.filter((cell) => cell.weekIndex === week),
  );

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      table={
        <DataTable
          columns={["Date", "Weekday", "Sales"]}
          align={["left", "left", "right"]}
          rows={cells
            .filter((cell) => cell.sales > 0)
            .map((cell) => [
              format(cell.date, "d MMM"),
              format(cell.date, "EEEE"),
              formatCurrency(cell.sales, currency),
            ])}
        />
      }
    >
      <div className="overflow-x-auto">
        {/* table-fixed so all seven weekday columns are the same width — left to
            auto-size, they'd size to their header letters and the grid would
            come out visibly uneven. */}
        <table className="w-full min-w-[320px] table-fixed border-separate border-spacing-[2px]">
          <thead>
            <tr>
              <th className="w-16" />
              {WEEKDAYS.map((day, index) => (
                <th
                  key={index}
                  scope="col"
                  className="pb-1 text-center text-[11px] font-medium text-slate-400"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, weekIndex) => (
              <tr key={weekIndex}>
                <th
                  scope="row"
                  className="pr-2 text-right text-[11px] font-medium text-slate-400 whitespace-nowrap"
                >
                  {row[0]?.weekLabel}
                </th>
                {row.map((cell, dayIndex) => (
                  <td key={cell.date} className="p-0">
                    <div
                      tabIndex={0}
                      aria-label={`${format(cell.date, "EEEE d MMM")}: ${formatCurrency(cell.sales, currency)}`}
                      className="group relative h-8 w-full rounded animate-cell-in focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25"
                      style={
                        {
                          backgroundColor: heatStep(cell.sales, max),
                          // Diagonal wave, so the grid fills in rather than
                          // snapping on all at once.
                          "--cell-delay": `${(weekIndex + dayIndex) * 26}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-slate-900/10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                      >
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(cell.sales, currency)}
                        </span>
                        <span className="text-slate-500"> · {format(cell.date, "EEE d MMM")}</span>
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <span className="text-[11px] text-slate-500">None</span>
        <div className="flex gap-[2px]">
          <span aria-hidden className="h-3 w-5 rounded-sm" style={{ backgroundColor: VIZ.grid }} />
          {VIZ.seq.slice(1).map((step) => (
            <span
              key={step}
              aria-hidden
              className="h-3 w-5 rounded-sm"
              style={{ backgroundColor: step }}
            />
          ))}
        </div>
        <span className="text-[11px] text-slate-500">
          {max > 0 ? formatCurrency(max, currency) : "—"}
        </span>
      </div>
    </ChartCard>
  );
}
