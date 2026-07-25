"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProfitChart } from "@/components/dashboard/ProfitChart";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { formatCurrency, buildDailySeries, summarizeTotals, startOfCurrentWeek } from "@/lib/utils";

export default function OverviewPage() {
  const { profile, transactions, loading } = useDashboard();
  const currency = profile?.currency || "USD";

  const weekStart = startOfCurrentWeek();
  const weekTransactions = transactions.filter((t) => t.createdAt >= weekStart);
  const { sales, expenses, profit } = summarizeTotals(weekTransactions);
  const needsReview = transactions.filter((t) => t.confidence < 0.75).length;

  const series = buildDailySeries(transactions, 7);
  const recent = transactions.slice(0, 6);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Wallet size={28} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">No transactions yet</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Log your first sale over WhatsApp-style chat, or load sample data to preview your dashboard.
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            href="/dashboard/chat"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Log a transaction
          </Link>
          <Link
            href="/dashboard/settings"
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Load demo data
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="This week's sales" value={formatCurrency(sales, currency)} icon={TrendingUp} tone="emerald" trend="Since Monday" />
        <StatCard label="This week's expenses" value={formatCurrency(expenses, currency)} icon={TrendingDown} tone="red" trend="Since Monday" />
        <StatCard label="This week's profit" value={formatCurrency(profit, currency)} icon={Wallet} tone="sky" trend={profit >= 0 ? "You're in the green" : "Spending more than earning"} />
        <StatCard label="Needs review" value={String(needsReview)} icon={Receipt} tone="amber" trend="Low-confidence entries" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Sales vs expenses — last 7 days</h2>
          </div>
          <ProfitChart data={series} currency={currency} />
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
            <Link href="/dashboard/transactions" className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
              View all
            </Link>
          </div>
          <div>
            {recent.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} currency={currency} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
