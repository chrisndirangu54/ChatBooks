import { clsx, type ClassValue } from "clsx";
import { format, startOfWeek, subDays } from "date-fns";
import type { Transaction, WeeklySummary } from "@/types";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Short form for axis ticks and stat tiles, where a full currency string would
 * collide with its neighbours: 1284 → "1.3K", 4_200_000 → "4.2M".
 */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${sign}${Math.round(abs)}`;
}

export function summarizeTotals(transactions: Transaction[]) {
  const sales = transactions.filter((t) => t.type === "sale").reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  return { sales, expenses, profit: sales - expenses };
}

export function buildDailySeries(transactions: Transaction[], days: number): WeeklySummary[] {
  const buckets: WeeklySummary[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = subDays(new Date(), i);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const dayTransactions = transactions.filter(
      (t) => t.createdAt >= dayStart && t.createdAt < dayEnd,
    );
    const { sales, expenses, profit } = summarizeTotals(dayTransactions);
    buckets.push({ label: format(day, "EEE"), sales, expenses, profit });
  }
  return buckets;
}

export function startOfCurrentWeek(): number {
  return startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
}

export function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
