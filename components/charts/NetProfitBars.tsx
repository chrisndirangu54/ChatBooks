"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklySummary } from "@/types";
import { formatCompact, formatCurrency } from "@/lib/utils";
import { VIZ } from "@/lib/viz";
import { usePrefersReducedMotion } from "@/lib/motion";
import { ChartCard, DataTable, LegendKey } from "./ChartCard";
import { VizTooltip } from "./VizTooltip";

/**
 * Rounds only the data-end of a bar — the end away from the baseline — and
 * leaves the baseline end square, so the bar visibly grows *from* zero.
 * Recharts' own `radius` prop rounds a fixed pair of corners, which puts the
 * curve on the wrong end once a value goes negative.
 */
function DivergingBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { profit?: number };
}) {
  const x = Number(props.x ?? 0);
  const width = Number(props.width ?? 0);
  const profit = props.payload?.profit ?? 0;

  // Recharts reports a bar hanging below the baseline as a *negative* height
  // with y still on the baseline, so normalise to a top edge and a positive
  // length before doing any geometry. Treating a negative height as "empty"
  // silently drops every loss day off the chart.
  const rawY = Number(props.y ?? 0);
  const rawHeight = Number(props.height ?? 0);
  const top = rawHeight >= 0 ? rawY : rawY + rawHeight;
  const height = Math.abs(rawHeight);

  if (width <= 0) return <g />;

  // A break-even day gets a sliver on the baseline rather than nothing at all,
  // so "logged, but made no profit" doesn't look like "no data".
  if (height < 1) {
    return <rect x={x} y={top - 1} width={width} height={2} fill={VIZ.zero} rx={1} />;
  }

  const fill = profit >= 0 ? VIZ.sales : VIZ.expenses;
  const r = Math.min(4, height / 2, width / 2);
  const bottom = top + height;

  // Round only the end away from the baseline.
  const path =
    profit >= 0
      ? `M${x},${bottom} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${bottom} Z`
      : `M${x},${top} L${x},${bottom - r} Q${x},${bottom} ${x + r},${bottom} L${x + width - r},${bottom} Q${x + width},${bottom} ${x + width},${bottom - r} L${x + width},${top} Z`;

  return <path d={path} fill={fill} />;
}

/**
 * Daily profit as a diverging bar chart: above the line is a day that made
 * money, below is a day that lost it.
 *
 * This is the polarity view of the same numbers the trend chart shows as two
 * series — which side of zero each day landed on is the whole question, so the
 * baseline is the subject and the colours are the two poles.
 */
export function NetProfitBars({
  data,
  currency,
  title = "Daily profit",
  subtitle,
}: {
  data: WeeklySummary[];
  currency: string;
  title?: string;
  subtitle?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      legend={
        <LegendKey
          items={[
            { label: "Profit", color: VIZ.sales },
            { label: "Loss", color: VIZ.expenses },
          ]}
        />
      }
      table={
        <DataTable
          columns={["Day", "Profit"]}
          align={["left", "right"]}
          rows={data.map((point) => [point.label, formatCurrency(point.profit, currency)])}
        />
      }
    >
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="" vertical={false} stroke={VIZ.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
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
            {/* The baseline is the reference the whole chart is read against, so
                it gets a visible neutral rule rather than a gridline. */}
            <ReferenceLine y={0} stroke={VIZ.axis} strokeWidth={1} />
            <Tooltip
              cursor={{ fill: VIZ.grid, fillOpacity: 0.7 }}
              content={({ active, label, payload }) => {
                const profit = Number(payload?.[0]?.value ?? 0);
                return (
                  <VizTooltip
                    active={active}
                    label={label}
                    currency={currency}
                    rows={[
                      {
                        name: profit >= 0 ? "Profit" : "Loss",
                        value: profit,
                        color: profit >= 0 ? VIZ.sales : VIZ.expenses,
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="profit"
              name="Profit"
              maxBarSize={24}
              shape={DivergingBar}
              isAnimationActive={!reducedMotion}
              animationDuration={780}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
