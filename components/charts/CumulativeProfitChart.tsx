"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatCurrency } from "@/lib/utils";
import { VIZ, type CumulativePoint } from "@/lib/viz";
import { usePrefersReducedMotion } from "@/lib/motion";
import { ChartCard, DataTable } from "./ChartCard";
import { VizTooltip } from "./VizTooltip";

/**
 * Profit added up day after day — the "are we ahead" line.
 *
 * A single series, so there's no legend box: the title already says what's
 * plotted, and a one-swatch legend would just restate it. The zero rule stays
 * visible because crossing it is the only event on this chart that matters.
 */
export function CumulativeProfitChart({
  data,
  currency,
  title = "Profit, adding up",
  subtitle,
}: {
  data: CumulativePoint[];
  currency: string;
  title?: string;
  subtitle?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const final = data[data.length - 1]?.cumulativeProfit ?? 0;
  // The line's own colour follows the outcome: ahead reads as sales, behind as
  // expenses — the same two poles used everywhere else for money direction.
  const color = final >= 0 ? VIZ.sales : VIZ.expenses;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      table={
        <DataTable
          columns={["Day", "Profit that day", "Running total"]}
          align={["left", "right", "right"]}
          rows={data.map((point) => [
            point.label,
            formatCurrency(point.profit, currency),
            formatCurrency(point.cumulativeProfit, currency),
          ])}
        />
      }
    >
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cumulative-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="" vertical={false} stroke={VIZ.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: VIZ.axis }}
              tick={{ fontSize: 12, fill: VIZ.inkMuted }}
              dy={4}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: VIZ.inkMuted }}
              tickFormatter={(value: number) => formatCompact(value)}
              width={44}
            />
            <ReferenceLine y={0} stroke={VIZ.axis} strokeWidth={1} />
            <Tooltip
              cursor={{ stroke: VIZ.axis, strokeWidth: 1 }}
              content={({ active, label, payload }) => (
                <VizTooltip
                  active={active}
                  label={label}
                  currency={currency}
                  rows={[
                    { name: "Running profit", value: Number(payload?.[0]?.value ?? 0), color },
                  ]}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="cumulativeProfit"
              name="Running profit"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              fill="url(#cumulative-fill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: VIZ.surface }}
              isAnimationActive={!reducedMotion}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
