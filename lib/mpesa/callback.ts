import { parseDarajaDate } from "./wire.ts";

/**
 * Parser for the STK Push result callback Daraja POSTs to us.
 *
 * Kept pure and separate from the route so the branch that decides "this order
 * is paid" can be tested against real callback shapes — including the failure
 * ones, which are the shapes that actually differ. A success callback carries
 * `CallbackMetadata`; a cancelled or timed-out one omits it entirely, and
 * reading `Item` off `undefined` there is the classic way this route 500s and
 * makes Daraja retry a payment we already took.
 */

export interface StkCallbackResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  /** 0 means paid. 1032 = cancelled by user, 1037 = no response, 1 = insufficient funds. */
  resultCode: number;
  resultDesc: string;
  success: boolean;
  /** Present only on success. */
  receiptNumber?: string;
  /** What M-Pesa actually collected — not what we asked for. */
  amount?: number;
  phone?: string;
  paidAt?: number;
}

type MetadataItem = { Name?: unknown; Value?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function metadataValue(items: MetadataItem[], name: string): unknown {
  return items.find((item) => item.Name === name)?.Value;
}

/**
 * Returns null when the body isn't a recognisable STK callback at all — the
 * caller should treat that as a bad request rather than as a failed payment.
 */
export function parseStkCallback(body: unknown): StkCallbackResult | null {
  if (!isRecord(body)) return null;
  const stkCallback = isRecord(body.Body) ? body.Body.stkCallback : undefined;
  if (!isRecord(stkCallback)) return null;

  const checkoutRequestId = String(stkCallback.CheckoutRequestID ?? "");
  if (!checkoutRequestId) return null;

  // Daraja has been seen sending ResultCode as both a number and a string.
  const resultCode = Number(stkCallback.ResultCode);
  if (!Number.isFinite(resultCode)) return null;

  const result: StkCallbackResult = {
    merchantRequestId: String(stkCallback.MerchantRequestID ?? ""),
    checkoutRequestId,
    resultCode,
    resultDesc: String(stkCallback.ResultDesc ?? ""),
    success: resultCode === 0,
  };

  const metadata = isRecord(stkCallback.CallbackMetadata)
    ? stkCallback.CallbackMetadata.Item
    : undefined;
  if (!Array.isArray(metadata)) return result;

  const items = metadata.filter(isRecord) as MetadataItem[];

  const receipt = metadataValue(items, "MpesaReceiptNumber");
  if (typeof receipt === "string" && receipt) result.receiptNumber = receipt;

  const amount = Number(metadataValue(items, "Amount"));
  if (Number.isFinite(amount)) result.amount = amount;

  const phone = metadataValue(items, "PhoneNumber");
  if (phone !== undefined && phone !== null) result.phone = String(phone);

  const transactionDate = metadataValue(items, "TransactionDate");
  if (typeof transactionDate === "number" || typeof transactionDate === "string") {
    result.paidAt = parseDarajaDate(transactionDate);
  }

  return result;
}

/** Human-readable reason for the customer, keyed off Daraja's result codes. */
export function describeFailure(result: StkCallbackResult): string {
  switch (result.resultCode) {
    case 1032:
      return "You cancelled the M-Pesa request.";
    case 1037:
      return "The M-Pesa prompt timed out before it was answered.";
    case 1:
      return "There wasn't enough money in the M-Pesa account.";
    case 2001:
      return "The M-Pesa PIN entered was wrong.";
    default:
      return result.resultDesc || "The M-Pesa payment didn't go through.";
  }
}
