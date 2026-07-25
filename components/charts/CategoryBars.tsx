"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatCurrency } from "@/lib/utils";
import { VIZ, type CategorySlice } from "@/lib/viz";
import { usePrefersReducedMotion } from "@/lib/motion";
import { ChartCard, DataTable } from "./ChartCard";
import { VizTooltip } from "./VizTooltip";

/**
 * Where the money went, ranked.
 *
 * Categories here are nominal — "inventory" isn't more or less than "transport",
 * it's just a different thing — so every bar wears the **same** hue. Shading
 * them by value would spend the identity channel re-encoding the one thing bar
 * length already says. One series, so no legend: the title names it.
 *
 * Horizontal because category names are words, and words want a straight
 * left-aligned run rather than rotated column labels.
 */
export function CategoryBars({
  data,
  currency,
  title,
  subtitle,
  color = VIZ.seq[3],
}: {
  data: CategorySlice[];
  currency: string;
  title: string;
  subtitle?: string;
  color?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  // ~34px per row keeps the bars thin and the gaps generous; the floor stops a
  // one-category chart from collapsing to a sliver.
  const height = Math.max(140, data.length * 34 + 24);

  // Size the label gutter to the longest name actually present, rather than
  // trusting a fixed width — "telecommunications" gets its first characters
  // sliced off at 96px. Anything past the cap is ellipsised, so a label is
  // either fully readable or visibly shortened, never half-cropped.
  const longest = data.reduce((max, slice) => Math.max(max, slice.category.length), 0);
  const axisWidth = Math.min(150, Math.max(80, longest * 7 + 14));
  const maxChars = Math.floor((axisWidth - 14) / 7);

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      table={
        <DataTable
          columns={["Category", "Amount", "Share"]}
          align={["left", "right", "right"]}
          rows={data.map((slice) => [
            slice.category,
            formatCurrency(slice.amount, currency),
            `${slice.share.toFixed(1)}%`,
          ])}
        />
      }
    >
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No data for this period.</p>
      ) : (
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              // Right margin leaves room for the value at each bar's tip, so a
              // label never has to be clipped or pushed inside a short bar.
              margin={{ top: 0, right: 56, left: 0, bottom: 0 }}
              barCategoryGap="30%"
            >
              {/* No gridlines: every bar is already labelled at its tip, and
                  there's no visible x-axis to read a gridline against, so they'd
                  be ink that carries nothing. */}
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="category"
                tickLine={false}
                axisLine={false}
                width={axisWidth}
                tick={{ fontSize: 12, fill: VIZ.inkSecondary }}
                // Capitalised here rather than with a CSS text-transform, which
                // recharts' tick props don't carry through to the SVG text.
                tickFormatter={(value: string) => {
                  const label = value.charAt(0).toUpperCase() + value.slice(1);
                  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
                }}
              />
              <Tooltip
                cursor={{ fill: VIZ.grid, fillOpacity: 0.7 }}
                content={({ active, label, payload }) => (
                  <VizTooltip
                    active={active}
                    label={label}
                    currency={currency}
                    rows={[{ name: "Total", value: Number(payload?.[0]?.value ?? 0), color }]}
                  />
                )}
              />
              <Bar
                dataKey="amount"
                name="Total"
                fill={color}
                maxBarSize={20}
                // Rounded at the data end, square against the baseline.
                radius={[0, 4, 4, 0]}
                isAnimationActive={!reducedMotion}
                animationDuration={780}
              >
                <LabelList
                  dataKey="amount"
                  position="right"
                  offset={10}
                  fontSize={12}
                  fontWeight={600}
                  fill={VIZ.ink}
                  // Recharts hands the raw label through, which is typed wider
                  // than number, so coerce rather than assume.
                  formatter={(value: string | number | boolean | null | undefined) =>
                    formatCompact(Number(value ?? 0))
                  }
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
