/**
 * What to do about an order still waiting on a payment result.
 *
 * Pure and separate from the sweep that acts on it, because this is the part
 * that can get someone's money wrong in both directions: give up too early and
 * a customer who paid never gets their goods; never give up and a cancelled
 * prompt pins the cart open forever. Both failure modes are testable here
 * without a Daraja account.
 *
 * Pure module: no imports, so it runs under `node --test`.
 */

export type ReconcileDecision =
  /** Daraja says it was paid — record it, even if the order is ancient. */
  | "settle_paid"
  /** Daraja gave a definite failure — record that and free the cart. */
  | "settle_failed"
  /** Still genuinely in flight. Ask again on the next sweep. */
  | "wait"
  /** Too old to keep asking about; stop tracking it. */
  | "expire";

export interface ReconcileInput {
  /** False when the STK push never returned a CheckoutRequestID to query. */
  hasCheckoutId: boolean;
  /** Daraja's ResultCode, or undefined when the status query itself failed. */
  resultCode?: number;
  /** False for 1037 / "still being processed" — the prompt is live. */
  settled: boolean;
  ageMs: number;
  maxAgeMs: number;
}

export function decideReconciliation(input: ReconcileInput): ReconcileDecision {
  // A confirmed payment outranks everything, including age. Money that has
  // left a customer's account has to be recorded no matter how late we hear.
  if (input.resultCode === 0) return "settle_paid";

  const tooOld = input.ageMs > input.maxAgeMs;

  // No id to query, or the query itself failed: we know nothing. Keep trying
  // until the order is old enough that it's certainly dead.
  if (!input.hasCheckoutId || input.resultCode === undefined) {
    return tooOld ? "expire" : "wait";
  }

  // The prompt is still sitting on the customer's handset.
  if (!input.settled) return tooOld ? "expire" : "wait";

  return "settle_failed";
}
