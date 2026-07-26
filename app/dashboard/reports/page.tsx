"use client";

import { useMemo, useState } from "react";
import { subDays, subMonths } from "date-fns";
import { Download, MessageCircle, ShieldCheck } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { formatCurrency, summarizeTotals } from "@/lib/utils";
import {
  VIZ,
  buildCumulative,
  buildSalesHeatmap,
  buildScopedSeries,
  categoryTotals,
  historySpanDays,
  profitMargin,
  sourceMix,
} from "@/lib/viz";
import { sendWhatsAppReport } from "@/lib/whatsapp";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Label } from "@/components/ui/Input";
import type { Transaction } from "@/types";

type Period = "week" | "month" | "all";

const HEATMAP_WEEKS = 4;

const PERIODS: Array<[Period, string]> = [
  ["week", "This week"],
  ["month", "This month"],
  ["all", "All time"],
];

function filterByPeriod(transactions: Transaction[], period: Period): Transaction[] {
  if (period === "all") return transactions;
  const cutoff = period === "week" ? subDays(new Date(), 7).getTime() : subMonths(new Date(), 1).getTime();
  return transactions.filter((t) => t.createdAt >= cutoff);
}

interface Readiness {
  score: number;
  label: string;
  status: StatusKey;
  factors: Array<{ label: string; earned: number; possible: number; met: boolean; note: string }>;
}

/**
 * Loan-readiness, broken into the factors that produced it.
 *
 * The single score is the headline, but a lender-facing number that won't say
 * *why* isn't actionable — so each factor carries its own earned/possible pair
 * and gets its own meter below the ring.
 */
function loanReadiness(transactions: Transaction[]): Readiness {
  const { profit } = summarizeTotals(transactions);
  const hasHistory = transactions.length >= 10;
  const isProfitable = profit > 0;
  const manualShare =
    transactions.filter((t) => t.source === "manual").length / Math.max(transactions.length, 1);
  const mostlyLive = manualShare < 0.5;

  const factors = [
    {
      label: "Record-keeping baseline",
      earned: 40,
      possible: 40,
      met: true,
      note: "Awarded for keeping books at all.",
    },
    {
      label: "Transaction history",
      earned: hasHistory ? 20 : 0,
      possible: 20,
      met: hasHistory,
      note: hasHistory
        ? `${transactions.length} records on file.`
        : `${transactions.length} of 10 records needed.`,
    },
    {
      label: "Profitability",
      earned: isProfitable ? 25 : 0,
      possible: 25,
      met: isProfitable,
      note: isProfitable ? "Currently trading at a profit." : "Currently spending more than you earn.",
    },
    {
      label: "Logged as it happened",
      earned: mostlyLive ? 15 : 0,
      possible: 15,
      met: mostlyLive,
      note: mostlyLive
        ? `Only ${Math.round(manualShare * 100)}% typed in after the fact.`
        : `${Math.round(manualShare * 100)}% typed in after the fact.`,
    },
  ];

  const score = Math.min(
    100,
    factors.reduce((sum, factor) => sum + factor.earned, 0),
  );

  return {
    score,
    label: score >= 75 ? "Loan-ready" : score >= 50 ? "Almost there" : "Needs more history",
    status: score >= 75 ? "good" : score >= 50 ? "warning" : "serious",
    factors,
  };
}

export default function ReportsPage() {
  const { profile, transactions } = useDashboard();
  const currency = profile?.currency || "USD";
  const [period, setPeriod] = useState<Period>("week");
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  const periodLabel = PERIODS.find(([value]) => value === period)?.[1] ?? "This week";

  // "All time" spans however long this business has been logging — deriving it
  // from the oldest record keeps the chart from padding out a year of empty
  // weeks in front of a book that's three days old.
  const periodDays = useMemo(() => {
    if (period === "week") return 7;
    if (period === "month") return 30;
    return historySpanDays(transactions);
  }, [period, transactions]);

  const report = useMemo(() => {
    const scoped = filterByPeriod(transactions, period);
    const totals = summarizeTotals(scoped);
    const series = buildScopedSeries(scoped, periodDays);

    return {
      scoped,
      totals,
      series,
      cumulative: buildCumulative(series),
      margin: profitMargin(totals.sales, totals.profit),
      // Named for what they are — per-category arrays, not money totals. The
      // totals live on `totals`, and keeping the two obviously distinct stops a
      // `formatCurrency(expenses)` slip.
      expenseCategories: categoryTotals(scoped, "expense"),
      salesCategories: categoryTotals(scoped, "sale"),
      mix: sourceMix(scoped),
      heatmap: buildSalesHeatmap(transactions, HEATMAP_WEEKS),
    };
  }, [transactions, period, periodDays]);

  // Readiness is a property of the whole history, not of the chosen window —
  // a lender cares about the full record, so this one deliberately ignores the
  // period filter, and the caption says so.
  const readiness = useMemo(() => loanReadiness(transactions), [transactions]);

  const { totals, series, cumulative, margin, expenseCategories, salesCategories, mix } = report;

  const reportSummary = [
    `📊 ${profile?.businessName || "ChatBooks"} — ${periodLabel}`,
    `Sales: ${formatCurrency(sales, currency)}`,
    `Expenses: ${formatCurrency(expenses, currency)}`,
    `Profit: ${formatCurrency(profit, currency)}`,
    `Loan-readiness: ${readiness.label} (${readiness.score}/100)`,
  ].join("\n");

  const handleExport = async () => {
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(profile?.businessName || "Business report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${periodLabel}`, 14, 25);

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Sales: ${formatCurrency(totals.sales, currency)}`, 14, 36);
    doc.text(`Expenses: ${formatCurrency(totals.expenses, currency)}`, 14, 43);
    doc.text(`Profit: ${formatCurrency(totals.profit, currency)}`, 14, 50);
    doc.text(`Profit margin: ${margin != null ? `${margin.toFixed(1)}%` : "n/a"}`, 14, 57);
    doc.text(`Loan-readiness: ${readiness.label} (${readiness.score}/100)`, 14, 64);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: 72,
      head: [["Date", "Type", "Category", "Note", "Amount"]],
      body: report.scoped.map((t) => [
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
      {/* ── Filter row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              aria-pressed={period === value}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                period === value
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setWhatsappModalOpen(true)}>
            <MessageCircle size={16} /> Send to WhatsApp
          </Button>
          <Button onClick={handleExport}>
            <Download size={16} /> Export PDF
          </Button>
        </div>
      </div>

      {/* ── Headline numbers ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="Sales"
          value={totals.sales}
          currency={currency}
          icon={TrendingUp}
          accent={VIZ.salesText}
          delay={0}
        />
        <SummaryTile
          label="Expenses"
          value={totals.expenses}
          currency={currency}
          icon={TrendingDown}
          accent={VIZ.expensesText}
          delay={70}
        />
        <SummaryTile
          label="Profit"
          value={totals.profit}
          currency={currency}
          icon={Wallet}
          accent={totals.profit >= 0 ? VIZ.salesText : VIZ.expensesText}
          delay={140}
        />
        <SummaryTile
          label="Profit margin"
          value={margin ?? 0}
          format="percent"
          icon={Percent}
          accent={VIZ.seq[4]}
          hint={margin == null ? "No sales in this period" : undefined}
          delay={210}
        />
      </div>

      {/* ── Loan-readiness, the reason this product exists ─────────────────── */}
      <Reveal direction="up">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-700" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-900">Loan-readiness</h2>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
            <ScoreRing
              score={readiness.score}
              status={readiness.status}
              statusLabel={readiness.label}
              caption="Scored across your whole history, not the selected period"
            />

            <div className="space-y-4">
              {readiness.factors.map((factor, index) => (
                <div key={factor.label}>
                  <Meter
                    label={factor.label}
                    value={factor.earned}
                    max={factor.possible}
                    status={factor.met ? "good" : "warning"}
                    valueLabel={`${factor.earned}/${factor.possible}`}
                    delay={index * 90}
                  />
                  <p className="mt-1 text-xs text-slate-500">{factor.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <Reveal direction="up">
        <TrendChart
          data={series}
          currency={currency}
          subtitle={`Money in against money out · ${periodLabel.toLowerCase()}`}
        />
      </Reveal>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal direction="left">
          <CategoryBars
            data={expenseCategories}
            currency={currency}
            title="Expenses by category"
            subtitle={periodLabel}
          />
        </Reveal>
        <Reveal direction="right" delay={80}>
          <CategoryBars
            data={salesCategories}
            currency={currency}
            title="Sales by category"
            subtitle={periodLabel}
            color={VIZ.seq[5]}
          />
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal direction="left">
          <WeekdayHeatmap
            cells={report.heatmap}
            currency={currency}
            weeks={HEATMAP_WEEKS}
            subtitle={`Sales per day over the last ${HEATMAP_WEEKS} weeks`}
          />
        </Reveal>
        <Reveal direction="right" delay={80}>
          <CumulativeProfitChart
            data={cumulative}
            currency={currency}
            subtitle={`Running profit · ${periodLabel.toLowerCase()}`}
          />
        </Reveal>
      </div>

      <Reveal direction="up">
        <SourceMixBar
          data={mix}
          subtitle="Lenders trust records logged as business happened, not backfilled"
        />
      </Reveal>

      <SendToWhatsAppModal
        open={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        message={reportSummary}
      />
    </div>
  );
}

/**
 * A report headline number. Simpler than the dashboard's StatCard — there's no
 * period-over-period delta here because the period is the thing the reader is
 * choosing, so "vs previous" would be comparing against a moving target.
 */
function SummaryTile({
  label,
  value,
  currency,
  format = "currency",
  icon: Icon,
  accent,
  hint,
  delay = 0,
}: {
  label: string;
  value: number;
  currency?: string;
  format?: "currency" | "percent";
  icon: typeof TrendingUp;
  /** Semantic money colour. Every value passed here clears 4.5:1 on white. */
  accent: string;
  hint?: string;
  delay?: number;
}) {
  return (
    <Reveal direction="up" delay={delay}>
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{label}</p>
          <Icon size={16} style={{ color: accent }} aria-hidden />
        </div>
        <p className="mt-2 text-2xl font-semibold" style={{ color: accent }}>
          <AnimatedNumber
            value={value}
            format={format}
            currency={currency}
            decimals={format === "percent" ? 1 : 0}
            delay={delay}
          />
        </p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    </Reveal>
  );
}

function SendToWhatsAppModal({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message: string;
}) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setStatus("idle");
    try {
      const ok = await sendWhatsAppReport(phone, message);
      setStatus(ok ? "sent" : "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Send report to WhatsApp">
      <form onSubmit={handleSend} className="space-y-3.5">
        <div>
          <Label htmlFor="whatsapp-phone">WhatsApp number</Label>
          <Input
            id="whatsapp-phone"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="254700000000"
          />
        </div>
        <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{message}</pre>
        {status === "sent" && <p className="text-sm text-emerald-700">Sent ✅</p>}
        {status === "error" && (
          <p className="text-sm text-red-700">
            Couldn&apos;t reach the WhatsApp server. Check it&apos;s running and connected in Settings.
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={sending} className="flex-1">
            {sending ? "Sending…" : "Send"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </form>
    </Modal>
  );
}
