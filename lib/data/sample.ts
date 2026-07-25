import type { WeeklySummary } from "@/types";
import type { CategorySlice, SourceSlice } from "@/lib/viz";
import { VIZ } from "@/lib/viz";

/**
 * Illustrative figures for the marketing page only.
 *
 * These are a worked example, not product metrics — nothing here claims how many
 * businesses use ChatBooks or what results they got. The totals deliberately
 * match the numbers quoted in the landing page's chat transcript (15,000 in,
 * 9,000 out, 6,000 profit) so the page never contradicts itself, and Wednesday
 * is a loss so the sample shows a real week rather than a flattering one.
 */

export const SAMPLE_CURRENCY = "USD";

export const SAMPLE_WEEK: WeeklySummary[] = [
  { label: "Mon", sales: 1800, expenses: 1200, profit: 600 },
  { label: "Tue", sales: 2100, expenses: 900, profit: 1200 },
  { label: "Wed", sales: 1500, expenses: 2300, profit: -800 },
  { label: "Thu", sales: 2400, expenses: 1100, profit: 1300 },
  { label: "Fri", sales: 2600, expenses: 1300, profit: 1300 },
  { label: "Sat", sales: 3100, expenses: 1400, profit: 1700 },
  { label: "Sun", sales: 1500, expenses: 800, profit: 700 },
];

export const SAMPLE_TOTALS = {
  sales: 15000,
  expenses: 9000,
  profit: 6000,
} as const;

const SAMPLE_EXPENSE_AMOUNTS: Array<[string, number]> = [
  ["inventory", 4200],
  ["wages", 2100],
  ["transport", 1300],
  ["utilities", 900],
  ["packaging", 500],
];

export const SAMPLE_EXPENSES: CategorySlice[] = SAMPLE_EXPENSE_AMOUNTS.map(([category, amount]) => ({
  category,
  amount,
  share: (amount / SAMPLE_TOTALS.expenses) * 100,
}));

const SAMPLE_SOURCE_COUNTS: Array<[SourceSlice["source"], string, number]> = [
  ["chat", "WhatsApp chat", 18],
  ["receipt", "Receipt scan", 7],
  ["manual", "Typed in", 3],
];

const SAMPLE_RECORD_COUNT = SAMPLE_SOURCE_COUNTS.reduce((sum, [, , count]) => sum + count, 0);

export const SAMPLE_MIX: SourceSlice[] = SAMPLE_SOURCE_COUNTS.map(([source, label, count], index) => ({
  source,
  label,
  count,
  share: (count / SAMPLE_RECORD_COUNT) * 100,
  color: VIZ.cat[index],
}));
