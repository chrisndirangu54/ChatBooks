import type { ParsedTransaction, TransactionType } from "@/types";
import type { TransactionAIProvider } from "./types";

/**
 * Rule-based stand-in for the real AI layer (e.g. Claude with a structured
 * tool-call schema). Same interface (TransactionAIProvider) so swapping in a
 * live model call later is a one-file change — see src/lib/ai/index.ts.
 */

const SALE_WORDS = ["sold", "sale", "received", "got paid", "customer paid", "income"];
const EXPENSE_WORDS = [
  "bought",
  "paid",
  "spent",
  "purchase",
  "purchased",
  "expense",
  "cost",
  "supplier",
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  inventory: ["stock", "supplier", "goods", "inventory", "wholesale", "rice", "milk", "sugar", "flour"],
  transport: ["transport", "fuel", "petrol", "diesel", "fare", "delivery", "logistics"],
  rent: ["rent", "shop rent", "lease"],
  utilities: ["electricity", "water bill", "power", "generator", "airtime", "data bundle"],
  wages: ["salary", "wages", "staff pay", "worker"],
  sales: ["sold", "sale", "customer"],
  other: [],
};

function extractAmount(message: string): number | null {
  const match = message.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function detectType(message: string): TransactionType {
  const lower = message.toLowerCase();
  const saleHit = SALE_WORDS.some((word) => lower.includes(word));
  const expenseHit = EXPENSE_WORDS.some((word) => lower.includes(word));
  if (saleHit && !expenseHit) return "sale";
  if (expenseHit && !saleHit) return "expense";
  return saleHit ? "sale" : "expense";
}

function detectCategory(message: string, type: TransactionType): string {
  const lower = message.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((word) => lower.includes(word))) return category;
  }
  return type === "sale" ? "sales" : "other";
}

function extractNote(message: string, amount: number): string {
  const withoutAmount = message.replace(String(amount), "").replace(/,/g, "");
  const words = withoutAmount
    .split(/\s+/)
    .filter((word) => word && !SALE_WORDS.includes(word.toLowerCase()) && !EXPENSE_WORDS.includes(word.toLowerCase()));
  return words.join(" ").trim() || message.trim();
}

export class RuleBasedTransactionAI implements TransactionAIProvider {
  async parseMessage(message: string): Promise<ParsedTransaction | null> {
    const amount = extractAmount(message);
    if (amount === null) return null;

    const type = detectType(message);
    const category = detectCategory(message, type);
    const note = extractNote(message, amount);

    const hasTypeKeyword = [...SALE_WORDS, ...EXPENSE_WORDS].some((word) =>
      message.toLowerCase().includes(word),
    );
    const hasCategoryKeyword = category !== "other" && category !== "sales";
    const confidence = 0.55 + (hasTypeKeyword ? 0.25 : 0) + (hasCategoryKeyword ? 0.15 : 0);

    return {
      type,
      amount,
      category,
      note,
      confidence: Math.min(confidence, 0.97),
    };
  }
}
