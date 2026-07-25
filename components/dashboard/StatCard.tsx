"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn } from "@/lib/utils";
import { VIZ } from "@/lib/viz";

type Tone = "emerald" | "red" | "sky" | "amber";

const TONES: Record<Tone, { chip: string; spark: string }> = {
  emerald: { chip: "bg-emerald-50 text-emerald-700", spark: VIZ.sales },
  red: { chip: "bg-red-50 text-red-700", spark: VIZ.expenses },
  sky: { chip: "bg-sky-50 text-sky-700", spark: VIZ.seq[3] },
  amber: { chip: "bg-amber-50 text-amber-700", spark: VIZ.seq[4] },
};

/**
 * The stat-tile contract: label · value · delta · trend.
 *
 * Not a one-bar bar chart — when the data is a single current number, the number
 * *is* the chart, and the sparkline is shape-only context behind it.
 *
 * The delta's colour is direction × whether up is good, which is why `upIsGood`
 * exists: rising expenses and rising sales are both "up", and only one of them
 * is worth colouring green.
 */
export function StatCard({
  label,
  value,
  format = "currency",
  currency = "USD",
  icon: Icon,
  tone = "emerald",
  delta,
  deltaLabel,
  upIsGood = true,
  hint,
  trend,
  delay = 0,
}: {
  label: string;
  value: number;
  format?: "currency" | "integer" | "percent" | "compact";
  currency?: string;
  icon: LucideIcon;
  tone?: Tone;
  /** Percentage change vs the previous period. `null` when there's no baseline. */
  delta?: number | null;
  deltaLabel?: string;
  upIsGood?: boolean;
  /** Shown in place of the delta when no comparison is possible. */
  hint?: string;
  /** 7–12 points of context. Omitted for tiles where a trend is meaningless. */
  trend?: number[];
  delay?: number;
}) {
  const toneStyle = TONES[tone];

  const direction = delta == null ? "flat" : delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
  const isGood = direction === "flat" ? null : (direction === "up") === upIsGood;

  const DeltaIcon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md hover:ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
            toneStyle.chip,
          )}
        >
          <Icon size={18} />
        </div>
      </div>

      {/* Proportional figures, not tabular — this is a standalone display number,
          not a column that has to line up. */}
      <p className="mt-3 text-2xl font-semibold text-slate-900">
        <AnimatedNumber value={value} format={format} currency={currency} delay={delay} />
      </p>

      {delta != null && direction !== "flat" ? (
        <p
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-xs font-medium",
            isGood ? "text-emerald-700" : "text-red-700",
          )}
        >
          <DeltaIcon size={13} aria-hidden />
          {/* Sign is explicit, and the period it's measured against is named —
              a bare "12%" says nothing on its own. */}
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}%{deltaLabel ? ` ${deltaLabel}` : ""}
        </p>
      ) : (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
          {delta != null && <Minus size={13} aria-hidden />}
          {hint || deltaLabel}
        </p>
      )}

      {trend && trend.length > 1 && (
        <div className="mt-3 h-8 w-full">
          <Sparkline values={trend} color={toneStyle.spark} delay={delay + 180} className="h-full w-full" />
        </div>
      )}
    </div>
  );
}
