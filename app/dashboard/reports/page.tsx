"use client";

import { useMemo, useState } from "react";
import { subDays, subMonths } from "date-fns";
import { Download, ShieldCheck } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { formatCurrency, summarizeTotals } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { Transaction } from "@/types";

type Period = "week" | "month" | "all";

function filterByPeriod(transactions: Transaction[], period: Period): Transaction[] {
  if (period === "all") return transactions;
  const cutoff = period === "week" ? subDays(new Date(), 7).getTime() : subMonths(new Date(), 1).getTime();
  return transactions.filter((t) => t.createdAt >= cutoff);
}

function categoryBreakdown(transactions: Transaction[]) {
  const map = new Map<string, number>();
  transactions.forEach((t) => {
    const signed = t.type === "sale" ? t.amount : -t.amount;
    map.set(t.category, (map.get(t.category) || 0) + signed);
  });
  return Array.from(map.entries()).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}

function loanReadinessScore(transactions: Transaction[]): { score: number; label: string; reasons: string[] } {
  const reasons: string[] = [];
  let score = 40;

  if (transactions.length >= 10) {
    score += 20;
    reasons.push("You have a healthy transaction history.");
  } else {
    reasons.push("Log more transactions to strengthen your history.");
  }

  const { profit } = summarizeTotals(transactions);
  if (profit > 0) {
    score += 25;
    reasons.push("Your business is currently profitable.");
  } else {
    reasons.push("Work towards a positive profit margin.");
  }

  const manualShare = transactions.filter((t) => t.source === "manual").length / Math.max(transactions.length, 1);
  if (manualShare < 0.5) {
    score += 15;
    reasons.push("Most records come from real-time logging, not manual backfill.");
  }

  return {
    score: Math.min(score, 100),
    label: score >= 75 ? "Loan-ready" : score >= 50 ? "Almost there" : "Needs more history",
    reasons,
  };
}

export default function ReportsPage() {
  const { profile, transactions } = useDashboard();
  const currency = profile?.currency || "USD";
  const [period, setPeriod] = useState<Period>("week");

  const scoped = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);
  const { sales, expenses, profit } = summarizeTotals(scoped);
  const breakdown = categoryBreakdown(scoped);
  const readiness = loanReadinessScore(transactions);

  const handleExport = async () => {
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(profile?.businessName || "Business report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${period === "week" ? "Last 7 days" : period === "month" ? "Last 30 days" : "All time"}`, 14, 25);

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Sales: ${formatCurrency(sales, currency)}`, 14, 36);
    doc.text(`Expenses: ${formatCurrency(expenses, currency)}`, 14, 43);
    doc.text(`Profit: ${formatCurrency(profit, currency)}`, 14, 50);
    doc.text(`Loan-readiness: ${readiness.label} (${readiness.score}/100)`, 14, 57);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: 65,
      head: [["Date", "Type", "Category", "Note", "Amount"]],
      body: scoped.map((t) => [
        new Date(t.createdAt).toLocaleDateString(),
        t.type,
        t.category,
        t.note,
        formatCurrency(t.amount, currency),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [5, 150, 105] },
    });

    doc.save(`${(profile?.businessName || "chatbooks").replace(/\s+/g, "-").toLowerCase()}-report.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {([
            ["week", "This week"],
            ["month", "This month"],
            ["all", "All time"],
          ] as [Period, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                period === value ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button onClick={handleExport}>
          <Download size={16} /> Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">Sales</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{formatCurrency(sales, currency)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">Expenses</p>
          <p className="mt-2 text-2xl font-semibold text-red-600">{formatCurrency(expenses, currency)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">Profit</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(profit, currency)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Breakdown by category</h2>
          <div className="space-y-3">
            {breakdown.length === 0 && <p className="text-sm text-slate-400">No data for this period.</p>}
            {breakdown.map(([category, net]) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-600">{category}</span>
                <span className={net >= 0 ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                  {net >= 0 ? "+" : ""}
                  {formatCurrency(net, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">Loan-readiness</h2>
          </div>
          <p className="text-3xl font-semibold text-slate-900">{readiness.score}/100</p>
          <p className="mb-3 text-sm font-medium text-emerald-600">{readiness.label}</p>
          <ul className="space-y-1.5 text-xs text-slate-500">
            {readiness.reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
