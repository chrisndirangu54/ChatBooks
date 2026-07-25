"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
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
import { VizTooltip, toRows } from "./VizTooltip";

/** Below this separation the two end labels would sit on top of each other. */
const LABEL_COLLISION_RATIO = 0.12;

/**
 * The subset of recharts' label-content props we read. Written wide enough that
 * recharts' own `Props` is assignable to it — `value` really can arrive as a
 * boolean or null, so narrowing it to number here would not type-check.
 */
type LabelRenderProps = {
  x?: string | number;
  y?: string | number;
  value?: string | number | boolean | null;
  index?: number;
};

/**
 * Money in against money out, over time.
 *
 * Two series on **one** axis — both are amounts in the same currency, so they
 * share a scale and the comparison is real rather than an artefact of two
 * arbitrary scalings.
 *
 * End labels are conditional: they only appear when the final values are far
 * enough apart to sit beside their own lines. When the lines converge, nudging
 * the labels apart would detach them from the data, so they drop out and the
 * legend plus tooltip carry identity instead.
 */
export function TrendChart({
  data,
  currency,
  title = "Sales vs expenses",
  subtitle,
}: {
  data: WeeklySummary[];
  currency: string;
  title?: string;
  subtitle?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const lastIndex = data.length - 1;

  const peak = Math.max(...data.map((d) => Math.max(d.sales, d.expenses)), 1);
  const lastSales = data[lastIndex]?.sales ?? 0;
  const lastExpenses = data[lastIndex]?.expenses ?? 0;
  const labelsFit = Math.abs(lastSales - lastExpenses) / peak >= LABEL_COLLISION_RATIO;

  // The dataKey on each LabelList matters: without it recharts has no value to
  // hand this renderer and the label silently never appears.
  const endLabel = () =>
    function render(props: LabelRenderProps) {
      if (!labelsFit || props.index !== lastIndex) return <g />;
      return (
        <text
          x={Number(props.x) - 6}
          y={Number(props.y) - 9}
          textAnchor="end"
          fontSize={12}
          fontWeight={600}
          // Ink, not the series colour — the line end beside it carries identity.
          fill={VIZ.ink}
        >
          {formatCompact(Number(props.value ?? 0))}
        </text>
      );
    };

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      legend={
        <LegendKey
          items={[
            { label: "Sales", color: VIZ.sales, shape: "line" },
            { label: "Expenses", color: VIZ.expenses, shape: "line" },
          ]}
        />
      }
      table={
        <DataTable
          columns={["Day", "Sales", "Expenses", "Profit"]}
          align={["left", "right", "right", "right"]}
          rows={data.map((point) => [
            point.label,
            formatCurrency(point.sales, currency),
            formatCurrency(point.expenses, currency),
            formatCurrency(point.profit, currency),
          ])}
        />
      }
    >
      {/* Height covers the plot *and* the x-axis band, so the axis labels never
          get cut off into a nested scrollbar. */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trend-sales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VIZ.sales} stopOpacity={0.14} />
                <stop offset="100%" stopColor={VIZ.sales} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trend-expenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VIZ.expenses} stopOpacity={0.12} />
                <stop offset="100%" stopColor={VIZ.expenses} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Hairline, solid, horizontal only — recessive by design. */}
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
            <Tooltip
              // The crosshair finds the X so the reader aims at a day, never at
              // a 2px line.
              cursor={{ stroke: VIZ.axis, strokeWidth: 1 }}
              content={({ active, label, payload }) => (
                <VizTooltip
                  active={active}
                  label={label}
                  currency={currency}
                  rows={toRows(payload)}
                />
              )}
            />

            <Area
              type="monotone"
              dataKey="sales"
              name="Sales"
              stroke={VIZ.sales}
              strokeWidth={2}
              strokeLinecap="round"
              fill="url(#trend-sales)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: VIZ.surface }}
              isAnimationActive={!reducedMotion}
              animationDuration={900}
            >
              <LabelList dataKey="sales" content={endLabel()} />
            </Area>
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke={VIZ.expenses}
              strokeWidth={2}
              strokeLinecap="round"
              fill="url(#trend-expenses)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: VIZ.surface }}
              isAnimationActive={!reducedMotion}
              animationDuration={900}
              animationBegin={120}
            >
              <LabelList dataKey="expenses" content={endLabel()} />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
