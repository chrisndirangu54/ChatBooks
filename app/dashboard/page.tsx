"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Percent, Receipt, Wallet, ArrowRight } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { ProfitHero } from "@/components/dashboard/ProfitHero";
import { StatCard } from "@/components/dashboard/StatCard";
import { TrendChart } from "@/components/charts/TrendChart";
import { NetProfitBars } from "@/components/charts/NetProfitBars";
import { CumulativeProfitChart } from "@/components/charts/CumulativeProfitChart";
import { CategoryBars } from "@/components/charts/CategoryBars";
import { SourceMixBar } from "@/components/charts/SourceMixBar";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { Reveal } from "@/components/ui/Reveal";
import { summarizeTotals } from "@/lib/utils";
import {
  buildCumulative,
  buildScopedSeries,
  categoryTotals,
  percentChange,
  previousWindowTotals,
  profitMargin,
  scopeToWindow,
  sourceMix,
} from "@/lib/viz";

const RANGES: Array<{ days: number; label: string; comparison: string }> = [
  { days: 7, label: "Last 7 days", comparison: "vs previous 7 days" },
  { days: 30, label: "Last 30 days", comparison: "vs previous 30 days" },
  { days: 90, label: "Last 90 days", comparison: "vs previous 90 days" },
];

export default function OverviewPage() {
  const { profile, transactions, loading } = useDashboard();
  const currency = profile?.currency || "USD";

  // One range control, above everything it scopes — every stat, chart and table
  // below re-renders against this same slice, so the numbers always agree.
  const [days, setDays] = useState(7);
  const range = RANGES.find((option) => option.days === days) ?? RANGES[0];

  const stats = useMemo(() => {
    const scoped = scopeToWindow(transactions, days);
    const totals = summarizeTotals(scoped);
    const previous = previousWindowTotals(transactions, days);
    const series = buildScopedSeries(transactions, days);

    return {
      scoped,
      series,
      cumulative: buildCumulative(series),
      totals,
      previous,
      margin: profitMargin(totals.sales, totals.profit),
      previousMargin: profitMargin(previous.sales, previous.profit),
      expenseCategories: categoryTotals(scoped, "expense"),
      mix: sourceMix(scoped),
      needsReview: scoped.filter((t) => t.confidence < 0.75).length,
    };
  }, [transactions, days]);

  const recent = transactions.slice(0, 6);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return <EmptyState />;
  }

  const { totals, previous, series, cumulative, margin, previousMargin, expenseCategories, mix, needsReview } =
    stats;

  return (
    <div className="space-y-6">
      {/* ── Filter row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((option) => (
          <button
            key={option.days}
            onClick={() => setDays(option.days)}
            aria-pressed={days === option.days}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
              days === option.days
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* ── Hero figure: the one number this view leads with ───────────────── */}
      <Reveal direction="up">
        <ProfitHero
          profit={totals.profit}
          sales={totals.sales}
          expenses={totals.expenses}
          margin={margin}
          currency={currency}
          rangeLabel={range.label.toLowerCase()}
          bucketLabel={days <= 14 ? "day" : "week"}
          trend={series.map((point) => point.profit)}
        />
      </Reveal>

      {/* ── KPI row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal direction="up" delay={0}>
          <StatCard
            label="Sales"
            value={totals.sales}
            currency={currency}
            icon={TrendingUp}
            tone="emerald"
            delta={percentChange(totals.sales, previous.sales)}
            deltaLabel={range.comparison}
            hint={`No sales in the ${range.comparison.replace("vs ", "")} to compare`}
            trend={series.map((point) => point.sales)}
            delay={60}
          />
        </Reveal>
        <Reveal direction="up" delay={70}>
          <StatCard
            label="Expenses"
            value={totals.expenses}
            currency={currency}
            icon={TrendingDown}
            tone="red"
            delta={percentChange(totals.expenses, previous.expenses)}
            deltaLabel={range.comparison}
            // Spending more is not an improvement, so the delta's colours flip.
            upIsGood={false}
            hint={`No expenses in the ${range.comparison.replace("vs ", "")} to compare`}
            trend={series.map((point) => point.expenses)}
            delay={130}
          />
        </Reveal>
        <Reveal direction="up" delay={140}>
          <StatCard
            label="Profit margin"
            value={margin ?? 0}
            format="percent"
            icon={Percent}
            tone="sky"
            delta={margin != null && previousMargin != null ? margin - previousMargin : null}
            deltaLabel="points vs previous period"
            hint={margin == null ? "Log a sale to see your margin" : "No prior period to compare"}
            delay={200}
          />
        </Reveal>
        <Reveal direction="up" delay={210}>
          <StatCard
            label="Needs review"
            value={needsReview}
            format="integer"
            icon={Receipt}
            tone="amber"
            hint="Low-confidence entries to confirm"
            delay={260}
          />
        </Reveal>
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Reveal direction="up" className="lg:col-span-2">
          <TrendChart
            data={series}
            currency={currency}
            subtitle={`Money in against money out · ${range.label.toLowerCase()}`}
          />
        </Reveal>

        <Reveal direction="right" delay={80}>
          <section className="h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
              <Link
                href="/dashboard/transactions"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                View all <ArrowRight size={13} />
              </Link>
            </div>
            <div>
              {recent.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} currency={currency} />
              ))}
            </div>
          </section>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal direction="left">
          <NetProfitBars
            data={series}
            currency={currency}
            subtitle="Which days made money, and which cost you"
          />
        </Reveal>
        <Reveal direction="right" delay={80}>
          <CumulativeProfitChart
            data={cumulative}
            currency={currency}
            subtitle="Every day's profit, stacked on the one before"
          />
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal direction="up">
          <CategoryBars
            data={expenseCategories}
            currency={currency}
            title="Where the money went"
            subtitle={`Expenses by category · ${range.label.toLowerCase()}`}
          />
        </Reveal>
        <Reveal direction="up" delay={80}>
          <SourceMixBar data={mix} subtitle="Chat beats typing — that's the point" />
        </Reveal>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Reveal direction="scale">
      <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 h-64 w-64 rounded-full bg-emerald-50 blur-3xl animate-drift"
        />
        <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Wallet size={28} />
        </div>
        <h2 className="relative text-lg font-semibold text-slate-900">No transactions yet</h2>
        <p className="relative mt-1 max-w-sm text-sm text-slate-500">
          Log your first sale over WhatsApp-style chat, or load sample data to preview your dashboard.
        </p>
        <div className="relative mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard/chat"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
          >
            Log a transaction
          </Link>
          <Link
            href="/dashboard/settings"
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
          >
            Load demo data
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
