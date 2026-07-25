"use client";

/**
 * TEMPORARY visual-check harness — delete before shipping.
 *
 * Renders every chart and tile against fixed sample data so the layout can be
 * screenshotted without signing in to Firebase.
 */

import { TrendingUp, TrendingDown, Percent, Receipt } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { TrendChart } from "@/components/charts/TrendChart";
import { NetProfitBars } from "@/components/charts/NetProfitBars";
import { CumulativeProfitChart } from "@/components/charts/CumulativeProfitChart";
import { CategoryBars } from "@/components/charts/CategoryBars";
import { SourceMixBar } from "@/components/charts/SourceMixBar";
import { WeekdayHeatmap } from "@/components/charts/WeekdayHeatmap";
import { ScoreRing } from "@/components/charts/ScoreRing";
import { Meter } from "@/components/ui/Meter";
import { SAMPLE_CURRENCY, SAMPLE_EXPENSES, SAMPLE_MIX, SAMPLE_WEEK } from "@/lib/data/sample";
import { buildCumulative, buildSalesHeatmap } from "@/lib/viz";
import type { Transaction } from "@/types";

const DAY = 24 * 60 * 60 * 1000;

function sampleTransactions(): Transaction[] {
  const amounts = [1500, 800, 2300, 2200, 400, 1750, 900, 3100, 1200, 1950, 2600, 700];
  return amounts.map((amount, index) => ({
    id: `t${index}`,
    type: index % 3 === 2 ? "expense" : "sale",
    amount,
    category: ["sales", "inventory", "transport", "wages"][index % 4],
    note: `Sample ${index}`,
    source: index % 4 === 0 ? "chat" : index % 4 === 1 ? "receipt" : "manual",
    confidence: 0.9,
    createdAt: Date.now() - index * 2 * DAY,
  }));
}

export default function PreviewCheckPage() {
  const transactions = sampleTransactions();
  const cumulative = buildCumulative(SAMPLE_WEEK);
  const heatmap = buildSalesHeatmap(transactions, 4);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-lg font-semibold text-slate-900">Visual check harness</h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Sales"
            value={15000}
            currency={SAMPLE_CURRENCY}
            icon={TrendingUp}
            tone="emerald"
            delta={12.4}
            deltaLabel="vs previous 7 days"
            trend={SAMPLE_WEEK.map((d) => d.sales)}
          />
          <StatCard
            label="Expenses"
            value={9000}
            currency={SAMPLE_CURRENCY}
            icon={TrendingDown}
            tone="red"
            delta={8.1}
            deltaLabel="vs previous 7 days"
            upIsGood={false}
            trend={SAMPLE_WEEK.map((d) => d.expenses)}
          />
          <StatCard
            label="Profit margin"
            value={40}
            format="percent"
            icon={Percent}
            tone="sky"
            delta={-3.2}
            deltaLabel="points vs previous period"
          />
          <StatCard
            label="Needs review"
            value={2}
            format="integer"
            icon={Receipt}
            tone="amber"
            hint="Low-confidence entries to confirm"
          />
        </div>

        <TrendChart data={SAMPLE_WEEK} currency={SAMPLE_CURRENCY} subtitle="Sample week" />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <NetProfitBars data={SAMPLE_WEEK} currency={SAMPLE_CURRENCY} subtitle="Sample week" />
          <CumulativeProfitChart data={cumulative} currency={SAMPLE_CURRENCY} subtitle="Sample week" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CategoryBars
            data={SAMPLE_EXPENSES}
            currency={SAMPLE_CURRENCY}
            title="Where the money went"
            subtitle="Sample expenses by category"
          />
          <SourceMixBar data={SAMPLE_MIX} subtitle="Sample record sources" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WeekdayHeatmap
            cells={heatmap}
            currency={SAMPLE_CURRENCY}
            weeks={4}
            subtitle="Sales per day over the last 4 weeks"
          />
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Loan-readiness</h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
              <ScoreRing score={82} status="good" statusLabel="Loan-ready" caption="Whole history" />
              <div className="space-y-4">
                <Meter label="Record-keeping baseline" value={40} max={40} valueLabel="40/40" />
                <Meter label="Transaction history" value={20} max={20} valueLabel="20/20" />
                <Meter
                  label="Profitability"
                  value={0}
                  max={25}
                  status="warning"
                  valueLabel="0/25"
                />
                <Meter label="Logged as it happened" value={15} max={15} valueLabel="15/15" />
              </div>
            </div>
          </section>
        </div>

        {/* A deliberately awkward case: one long category name and a tiny value,
            to confirm labels don't clip or overflow their marks. */}
        <CategoryBars
          data={[
            { category: "telecommunications", amount: 12400, share: 88.9 },
            { category: "packaging materials", amount: 1200, share: 8.6 },
            { category: "misc", amount: 45, share: 0.3 },
          ]}
          currency={SAMPLE_CURRENCY}
          title="Edge case: long names, tiny values"
        />

        <SourceMixBar
          data={[
            { source: "chat", label: "WhatsApp chat", count: 47, share: 95.9, color: "#2a78d6" },
            { source: "receipt", label: "Receipt scan", count: 1, share: 2.0, color: "#eb6834" },
            { source: "manual", label: "Typed in", count: 1, share: 2.0, color: "#4a3aa7" },
          ]}
          title="Edge case: one dominant segment"
          subtitle="Two segments too small to hold a label"
        />
      </div>
    </main>
  );
}
