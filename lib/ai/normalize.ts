import type { ParsedTransaction } from "@/types";

/**
 * Turns Claude's raw extraction into a ParsedTransaction, or null.
 *
 * Structured outputs guarantee the *shape* of the response — this guarantees
 * the *values*. A schema can promise "amount is a number"; it cannot promise
 * the number is positive, finite, or sane. Everything that writes to someone's
 * books passes through here, so this function is deliberately paranoid and
 * deliberately pure: no SDK, no network, no clock, so it can be tested
 * directly.
 */

/** Above this, an "amount" is a hallucination or a misread balance, not money. */
const MAX_PLAUSIBLE_AMOUNT = 1e12;
/** Notes are shown in list rows and written to Firestore; keep them bounded. */
const MAX_NOTE_LENGTH = 140;

/** Structural shape only — the caller may hand us anything JSON-shaped. */
type MaybeExtraction = {
  isTransaction?: unknown;
  type?: unknown;
  amount?: unknown;
  category?: unknown;
  note?: unknown;
  confidence?: unknown;
  reasoning?: unknown;
};

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(n)) return 0.5; // unusable → mid, so it lands in review
  return Math.min(1, Math.max(0, n));
}

/**
 * Prefers the business's own spelling of a category so the dashboard groups
 * "Inventory" and "inventory" together instead of charting them apart.
 */
function resolveCategory(
  raw: unknown,
  knownCategories: string[],
  type: "sale" | "expense",
): string {
  const candidate = typeof raw === "string" ? raw.trim() : "";
  if (candidate) {
    const match = knownCategories.find((k) => k.toLowerCase() === candidate.toLowerCase());
    if (match) return match;
    return candidate.toLowerCase();
  }
  // Mirrors the rule-based parser's default so behaviour doesn't shift when
  // one provider falls back to the other.
  return type === "sale" ? "sales" : "other";
}

export function normalizeExtraction(
  raw: MaybeExtraction | null | undefined,
  message: string,
  knownCategories: string[],
): ParsedTransaction | null {
  if (!raw || typeof raw !== "object") return null;

  // An explicit "this isn't a transaction" is a valid, useful answer.
  if (raw.isTransaction !== true) return null;

  const amount = typeof raw.amount === "number" ? raw.amount : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_PLAUSIBLE_AMOUNT) return null;

  const type: "sale" | "expense" = raw.type === "expense" ? "expense" : "sale";

  const rawNote = typeof raw.note === "string" ? raw.note.trim() : "";
  // Falling back to the owner's own words beats an empty row in the ledger.
  const note = (rawNote || message.trim()).slice(0, MAX_NOTE_LENGTH);

  return {
    type,
    amount: Math.round(amount * 100) / 100,
    category: resolveCategory(raw.category, knownCategories, type),
    note,
    confidence: clampConfidence(raw.confidence),
  };
}

/**
 * Pulls the JSON object out of a response.
 *
 * With structured outputs the text *is* the object, so this is normally a
 * plain parse. The salvage path exists because a truncated response (thinking
 * plus output exceeding max_tokens) yields invalid JSON, and we would rather
 * fall back to the rule-based parser than throw at the user.
 */
export function extractJson(text: string): MaybeExtraction | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as MaybeExtraction;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as MaybeExtraction;
    } catch {
      return null;
    }
  }
}
