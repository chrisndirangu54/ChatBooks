import { format, startOfDay, subDays } from "date-fns";
import type { Transaction, TransactionSource, WeeklySummary } from "@/types";
import { summarizeTotals } from "@/lib/utils";

/* ───────────────────────────────────────────────────────────────────────────
   Palette.

   Mirrors the CSS custom properties in globals.css. Recharts needs real colour
   strings for SVG fills and gradient stops (a `var(--x)` works in most places
   but not inside the gradient defs it generates), so the hexes live here too —
   this file and the `:root` block are the two halves of one source of truth.

   Every value below was produced by the dataviz validator against this app's
   chart surface (#ffffff), not chosen by eye. See globals.css for the numbers.
   ─────────────────────────────────────────────────────────────────────────── */

export const VIZ = {
  surface: "#ffffff",
  ink: "#0f172a",
  inkSecondary: "#475569",
  inkMuted: "#64748b",
  grid: "#eef2f6",
  axis: "#cbd5e1",

  /** Money direction. Marks use these; text uses the `*Text` steps. */
  sales: "#059669",
  expenses: "#dc2626",
  zero: "#e2e8f0",
  salesText: "#047857",
  expensesText: "#b91c1c",

  /** Sequential ramp — one hue, light→dark. Magnitude only. */
  seq: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],

  /** Categorical slots, fixed order. Only the logging-source mix uses these. */
  cat: ["#2a78d6", "#eb6834", "#4a3aa7"],

  /** De-emphasis grey — context marks in sparklines and emphasis charts. */
  muted: "#cbd5e1",
} as const;

/**
 * Ink or white for a label sitting *inside* a filled mark, chosen by the fill's
 * own luminance. A label inside a colour is the one place text may leave the ink
 * tokens, and only if it still clears contrast — slot-2 orange, for instance, is
 * light enough that white text on it would fail while dark ink passes.
 */
export function readableOn(fill: string): string {
  const hex = fill.replace("#", "");
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // Compare the two candidates rather than guessing at a cut-off.
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithInk = (luminance + 0.05) / 0.0533;
  return contrastWithWhite >= contrastWithInk ? "#ffffff" : VIZ.ink;
}

/* ─────────────────────────────── Derived series ─────────────────────────── */

export interface CategorySlice {
  category: string;
  amount: number;
  share: number;
}

/**
 * Totals per category for one side of the ledger. Magnitudes only, sorted
 * descending — these are drawn as one-colour bars, so the ranking is carried by
 * bar length rather than by hue.
 */
export function categoryTotals(
  transactions: Transaction[],
  type: "sale" | "expense",
): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== type) continue;
    totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amount);
  }

  const grandTotal = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);

  return Array.from(totals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      share: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface SourceSlice {
  source: TransactionSource;
  label: string;
  count: number;
  share: number;
  color: string;
}

const SOURCE_LABELS: Record<TransactionSource, string> = {
  chat: "WhatsApp chat",
  receipt: "Receipt scan",
  manual: "Typed in",
};

/**
 * How records got into the books. Part-to-whole over a fixed set of three, so
 * the slots are assigned by source — not by rank — and a source dropping to
 * zero never repaints the others.
 */
export function sourceMix(transactions: Transaction[]): SourceSlice[] {
  const order: TransactionSource[] = ["chat", "receipt", "manual"];
  const counts = new Map<TransactionSource, number>();
  for (const transaction of transactions) {
    counts.set(transaction.source, (counts.get(transaction.source) || 0) + 1);
  }

  const total = transactions.length;
  return order.map((source, index) => {
    const count = counts.get(source) || 0;
    return {
      source,
      label: SOURCE_LABELS[source],
      count,
      share: total > 0 ? (count / total) * 100 : 0,
      color: VIZ.cat[index],
    };
  });
}

/**
 * Everything from the last `days` days.
 *
 * The clock read lives here rather than in a component so that render stays
 * pure — same reason `buildDailySeries` and `previousWindowTotals` own theirs.
 */
export function scopeToWindow(transactions: Transaction[], days: number): Transaction[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return transactions.filter((t) => t.createdAt >= cutoff);
}

/**
 * How many days of history exist, floored at a week. Used for an "all time"
 * range, so a three-day-old book doesn't get a year of empty buckets in front
 * of it.
 */
export function historySpanDays(transactions: Transaction[], cap = 365): number {
  if (transactions.length === 0) return 7;
  const oldest = Math.min(...transactions.map((t) => t.createdAt));
  const spanDays = Math.ceil((Date.now() - oldest) / (24 * 60 * 60 * 1000));
  return Math.min(cap, Math.max(7, spanDays));
}

/**
 * Buckets a window of transactions for plotting, switching granularity so the
 * x-axis never turns into a picket fence: daily up to a fortnight, weekly beyond
 * it. A 90-day chart with 90 daily ticks is unreadable and mostly noise.
 */
export function buildScopedSeries(transactions: Transaction[], days: number): WeeklySummary[] {
  const bucketDays = days <= 14 ? 1 : 7;
  const bucketCount = Math.ceil(days / bucketDays);
  const today = startOfDay(new Date());
  const buckets: WeeklySummary[] = [];

  for (let index = bucketCount - 1; index >= 0; index -= 1) {
    const end = subDays(today, index * bucketDays);
    const start = subDays(end, bucketDays - 1);
    const startMs = start.getTime();
    const endMs = end.getTime() + 24 * 60 * 60 * 1000;

    const inBucket = transactions.filter((t) => t.createdAt >= startMs && t.createdAt < endMs);
    const { sales, expenses, profit } = summarizeTotals(inBucket);

    buckets.push({
      label: bucketDays === 1 ? format(end, "EEE") : format(start, "d MMM"),
      sales,
      expenses,
      profit,
    });
  }

  return buckets;
}

export interface CumulativePoint extends WeeklySummary {
  cumulativeProfit: number;
}

/** Running profit across a daily series — the "is the line going up" view. */
export function buildCumulative(series: WeeklySummary[]): CumulativePoint[] {
  let running = 0;
  return series.map((point) => {
    running += point.profit;
    return { ...point, cumulativeProfit: running };
  });
}

export interface HeatCell {
  weekLabel: string;
  weekIndex: number;
  weekday: string;
  weekdayIndex: number;
  date: number;
  sales: number;
}

/**
 * Sales per day laid out as weeks × weekdays, for a sequential heatmap. Weeks
 * run oldest-first top to bottom so the most recent week sits at the bottom
 * edge, next to the axis the reader just came from.
 */
export function buildSalesHeatmap(transactions: Transaction[], weeks = 4): HeatCell[] {
  const cells: HeatCell[] = [];
  const today = startOfDay(new Date());
  const totalDays = weeks * 7;

  // Wind back to the Monday that starts the earliest week in range.
  const mondayOffset = (today.getDay() + 6) % 7;
  const firstDay = subDays(today, mondayOffset + (weeks - 1) * 7);

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + dayIndex);
    const dayStart = day.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const sales = transactions
      .filter((t) => t.type === "sale" && t.createdAt >= dayStart && t.createdAt < dayEnd)
      .reduce((sum, t) => sum + t.amount, 0);

    const weekIndex = Math.floor(dayIndex / 7);
    cells.push({
      weekIndex,
      weekLabel: weekIndex === weeks - 1 ? "This week" : `${weeks - 1 - weekIndex}w ago`,
      weekday: format(day, "EEEEE"),
      weekdayIndex: dayIndex % 7,
      date: dayStart,
      sales,
    });
  }

  return cells;
}

/**
 * Picks a step from the sequential ramp for a value. Bin 0 means "nothing here"
 * and is allowed to recede almost to the surface; every other bin is a real
 * step so adjacent bins stay tellable apart.
 */
export function heatStep(value: number, max: number): string {
  if (value <= 0 || max <= 0) return VIZ.grid;
  const ratio = value / max;
  const index = Math.min(VIZ.seq.length - 1, Math.max(1, Math.ceil(ratio * (VIZ.seq.length - 1))));
  return VIZ.seq[index];
}

/** Profit as a share of sales. Undefined (not zero) when nothing was sold. */
export function profitMargin(sales: number, profit: number): number | null {
  if (sales <= 0) return null;
  return (profit / sales) * 100;
}

/**
 * Percentage change between two periods. Returns null when the baseline is zero
 * — "up ∞%" from nothing is noise, not a trend, and a fabricated 100% is worse.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** The same daily buckets as the previous window, for period-over-period deltas. */
export function previousWindowTotals(transactions: Transaction[], days: number) {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  const previous = transactions.filter(
    (t) => t.createdAt >= now - 2 * windowMs && t.createdAt < now - windowMs,
  );
  return summarizeTotals(previous);
}
