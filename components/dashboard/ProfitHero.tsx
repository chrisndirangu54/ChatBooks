"use client";

import { TrendingUp, TrendingDown, Percent } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { DeepPanelBackdrop } from "@/components/ui/DeepPanel";
import { Parallax } from "@/components/ui/Parallax";
import { Sparkline } from "@/components/ui/Sparkline";
import { formatCurrency } from "@/lib/utils";

/**
 * The dashboard's hero figure — the one number the Overview leads with.
 *
 * Exactly one of these per view: profit for the selected range, at display size,
 * in the same sans as the rest of the UI. Sales, expenses and margin sit under
 * it as supporting context rather than as competing headline numbers, and the
 * sparkline is shape-only (the chart below carries the readable version).
 */
export function ProfitHero({
  profit,
  sales,
  expenses,
  margin,
  currency,
  rangeLabel,
  bucketLabel,
  trend,
}: {
  profit: number;
  sales: number;
  expenses: number;
  /** Null when nothing was sold — a margin of "0%" would be a fabrication. */
  margin: number | null;
  currency: string;
  rangeLabel: string;
  bucketLabel: string;
  trend: number[];
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-[var(--fx-deep)] p-6 text-[var(--fx-ink)] shadow-xl shadow-slate-900/10 ring-1 ring-white/10 sm:p-8">
      <DeepPanelBackdrop />

      {/* Decorative only. Two layers at different rates so they separate as the
          page scrolls; both aria-hidden because neither is content. */}
      <Parallax speed={0.16} max={60} ariaHidden className="pointer-events-none absolute -right-16 -top-24">
        <div className="h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl animate-drift" />
      </Parallax>
      <Parallax speed={-0.1} max={50} ariaHidden className="pointer-events-none absolute -bottom-28 left-1/3">
        <div className="h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl animate-drift" />
      </Parallax>

      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Profit · {rangeLabel}
          </p>
          <p className="mt-1.5 bg-gradient-to-br from-white via-emerald-100 to-emerald-300 bg-clip-text text-5xl font-semibold leading-none tracking-tight text-transparent sm:text-6xl">
            <AnimatedNumber value={profit} format="currency" currency={currency} />
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <TrendingUp size={15} className="text-emerald-400" aria-hidden />
              {formatCurrency(sales, currency)} in
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <TrendingDown size={15} className="text-red-400" aria-hidden />
              {formatCurrency(expenses, currency)} out
            </span>
            {margin != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200">
                <Percent size={13} aria-hidden />
                {margin.toFixed(1)}% margin
              </span>
            )}
          </div>
        </div>

        <div className="w-full max-w-[220px]">
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-400">
            Profit by {bucketLabel}
          </p>
          {/* Emerald rather than white on this surface: it clears AA on the deep
              panel (10:1) and ties the line to the money-in colour. */}
          <Sparkline
            values={trend}
            color="#34d399"
            surface="var(--fx-deep)"
            delay={220}
            className="h-12 w-full"
          />
        </div>
      </div>
    </section>
  );
}
