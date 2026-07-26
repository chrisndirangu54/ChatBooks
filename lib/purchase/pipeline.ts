import { describeFailure, type StkCallbackResult } from "@/lib/mpesa/callback";
import { darajaAmount } from "@/lib/mpesa/wire";
import { isMpesaConfigured, queryStkStatus, stkPush } from "@/lib/mpesa/daraja";
import { fileOrder } from "@/lib/etims/provider";
import {
  attachCheckout,
  createOrder,
  findStaleAwaitingOrders,
  getOrder,
  getProfile,
  getSession,
  listProducts,
  markOrderExpired,
  markOrderFailed,
  markOrderPaid,
  nextEtimsInvoiceNumber,
  saveEtimsFiling,
  saveSession,
} from "@/lib/server/shop-repo";
import { availableStock } from "@/lib/shop/conversation";
import { formatMoney } from "@/lib/shop/format";
import type { OrderTotals } from "@/lib/shop/tax";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { decideReconciliation } from "./reconcile-policy";
import type { BusinessProfile, EtimsFiling, Order, OrderItem } from "@/types";

/**
 * The purchase lifecycle, end to end: checkout → STK push → settle → book →
 * file → notify.
 *
 * This module exists because that lifecycle had been split across the WhatsApp
 * webhook and the M-Pesa callback route, with no single place that owned it —
 * and the gap showed. Two failure modes lived in it:
 *
 *   1. A lost callback left an order in `awaiting_payment` forever, with the
 *      customer's money already gone. `reconcileStaleOrders` closes that by
 *      asking Daraja directly on a schedule.
 *   2. A failed eTIMS filing had no way back. `retryEtimsFiling` closes that.
 *
 * Both callbacks and the reconciliation sweep funnel through the same
 * `settlePayment`, so an order settled by a poll is booked, stocked, filed and
 * receipted identically to one settled by a callback. Divergence between those
 * two paths is exactly the kind of bug that only shows up in the accounts.
 *
 * **Import from route handlers only** — reaches the Admin SDK and Daraja.
 */

// ── Checkout ────────────────────────────────────────────────────────────────

export interface CheckoutResult {
  ok: boolean;
  order?: Order;
  /** Text to send back to the customer. */
  message: string;
}

/**
 * Take a cart to a live M-Pesa prompt.
 *
 * Re-checks stock immediately before charging. The cart was validated when
 * items were added, but minutes may have passed and another customer may have
 * bought the last of something — and refusing here costs a message, whereas
 * discovering it after payment costs a refund.
 */
export async function startCheckout(input: {
  uid: string;
  profile: BusinessProfile | null;
  /** Normalised 2547… number. */
  phone: string;
  items: OrderItem[];
  totals: OrderTotals;
  now: number;
}): Promise<CheckoutResult> {
  const { uid, profile, phone, items, totals, now } = input;
  const currency = profile?.currency || "KES";

  if (!isMpesaConfigured()) {
    return {
      ok: false,
      message: "Sorry — M-Pesa payments aren't switched on for this shop yet. Your cart is saved.",
    };
  }

  const shortfalls = await findStockShortfalls(uid, items);
  if (shortfalls.length > 0) {
    return {
      ok: false,
      message: [
        "Sorry, someone got there first:",
        ...shortfalls.map((s) => `• ${s.name} — only ${s.available} left`),
        "",
        "Reply *CART* to adjust your order.",
      ].join("\n"),
    };
  }

  const order = await createOrder(uid, {
    customerPhone: phone,
    items,
    total: totals.total,
    taxTotal: totals.taxTotal,
    netTotal: totals.netTotal,
    now,
  });

  const push = await stkPush({
    phone,
    amount: totals.total,
    // Safaricom truncates both fields, so the order id goes in the reference
    // where it's needed for reconciliation rather than in the description.
    accountReference: order.id,
    description: "Order",
  });

  if (!push.ok) {
    console.error(`[ChatBooks Purchase] STK push failed for order ${order.id}: ${push.error}`);
    return {
      ok: false,
      order,
      message: `Sorry, the M-Pesa request didn't go through (${push.error}).\n\nYour cart is saved — reply *PAY* to try again.`,
    };
  }

  await attachCheckout(
    uid,
    order.id,
    { merchantRequestId: push.merchantRequestId, checkoutRequestId: push.checkoutRequestId },
    now,
  );

  return {
    ok: true,
    order,
    message: `Sending an M-Pesa request for ${formatMoney(totals.total, currency)} — check your phone and enter your PIN. 📲\n\nAmount: ${formatMoney(totals.total, currency)}`,
  };
}

async function findStockShortfalls(
  uid: string,
  items: OrderItem[],
): Promise<Array<{ name: string; available: number }>> {
  const catalog = await listProducts(uid);
  const shortfalls: Array<{ name: string; available: number }> = [];

  for (const item of items) {
    const product = catalog.find((p) => p.id === item.productId);
    if (!product) {
      shortfalls.push({ name: item.name, available: 0 });
      continue;
    }
    const available = availableStock(product);
    if (available !== null && available < item.quantity) {
      shortfalls.push({ name: item.name, available });
    }
  }

  return shortfalls;
}

// ── Settlement ──────────────────────────────────────────────────────────────

export type SettlementOutcome =
  | { kind: "paid"; order: Order; transactionId: string; oversold: string[] }
  | { kind: "duplicate"; order: Order }
  | { kind: "failed"; order: Order }
  | { kind: "unknown_order" };

/**
 * Apply a payment result to an order, whatever produced it.
 *
 * Both the Daraja callback and the reconciliation sweep call this, and it is
 * safe to call twice for the same order: `markOrderPaid` re-reads the status
 * inside a Firestore transaction and short-circuits, which is what stops a
 * retry from double-booking a sale or double-decrementing stock.
 */
export async function settlePayment(input: {
  uid: string;
  orderId: string;
  result: StkCallbackResult;
  now: number;
  /** True when this came from polling rather than a callback. */
  reconciled?: boolean;
}): Promise<SettlementOutcome> {
  const { uid, orderId, result, now, reconciled = false } = input;

  if (!result.success) {
    const order = await markOrderFailed(
      uid,
      orderId,
      { resultCode: result.resultCode, resultDesc: result.resultDesc },
      now,
    );
    if (!order) return { kind: "unknown_order" };

    // A late failure must never overwrite a payment we already recorded.
    if (order.status === "paid") return { kind: "duplicate", order };

    await restoreCartAfterFailure(uid, order, now);
    await sendWhatsAppMessage({
      phone: order.customerPhone,
      message: `${describeFailure(result)}\n\nYour cart is still saved — reply *PAY* to try again.`,
    });
    return { kind: "failed", order };
  }

  const paid = await markOrderPaid(
    uid,
    orderId,
    {
      receiptNumber: result.receiptNumber,
      paidAt: result.paidAt ?? now,
      resultCode: result.resultCode,
      resultDesc: result.resultDesc,
    },
    now,
    { reconciled },
  );

  if (!paid) return { kind: "unknown_order" };
  if (paid.alreadyPaid) return { kind: "duplicate", order: paid.order };

  const { order } = paid;

  // Worth an alert, never worth overriding the stored total with: the order is
  // what the customer agreed to.
  if (result.amount !== undefined && result.amount !== darajaAmount(order.total)) {
    console.error(
      `[ChatBooks Purchase] Amount mismatch on order ${orderId}: collected ${result.amount}, expected ${darajaAmount(order.total)}`,
    );
  }

  const profile = await getProfile(uid);
  const currency = profile?.currency || "KES";

  await clearCartAfterPurchase(uid, order, now);
  const filing = await fileSale(uid, order, profile?.kraPin, now);

  await sendWhatsAppMessage({
    phone: order.customerPhone,
    message: buildReceipt({
      businessName: profile?.businessName || "our shop",
      order,
      currency,
      receiptNumber: result.receiptNumber,
      filing,
      reconciled,
    }),
  });

  await alertOwnerIfOversold(profile, order, paid.oversold);

  return { kind: "paid", order, transactionId: paid.transactionId, oversold: paid.oversold };
}

async function restoreCartAfterFailure(uid: string, order: Order, now: number): Promise<void> {
  const session = await getSession(uid, order.customerPhone);
  if (!session) return;
  // Deliberately keeps the items: retrying after a mistyped PIN should be one
  // word, not a rebuilt order.
  await saveSession(uid, { ...session, state: "cart", orderId: undefined, updatedAt: now });
}

async function clearCartAfterPurchase(uid: string, order: Order, now: number): Promise<void> {
  const session = await getSession(uid, order.customerPhone);
  if (!session) return;
  await saveSession(uid, {
    ...session,
    state: "browsing",
    items: [],
    orderId: undefined,
    updatedAt: now,
  });
}

/**
 * Tell the shopkeeper when a sale went through on stock they didn't have.
 *
 * Nothing can be done about it automatically — the money is taken and a
 * callback can't reverse an M-Pesa payment — so the only useful response is to
 * put it in front of the person who can refund or restock, immediately.
 */
async function alertOwnerIfOversold(
  profile: BusinessProfile | null,
  order: Order,
  oversold: string[],
): Promise<void> {
  if (oversold.length === 0 || !profile?.ownerPhone) return;

  await sendWhatsAppMessage({
    phone: profile.ownerPhone,
    message: [
      "⚠️ *Oversold* — a paid order went past your stock count:",
      ...oversold.map((name) => `• ${name}`),
      "",
      `Order from ${order.customerPhone}. They've already paid, so you'll need to restock or refund.`,
    ].join("\n"),
  });
}

// ── eTIMS ───────────────────────────────────────────────────────────────────

/**
 * File the sale with KRA, recording the outcome either way.
 *
 * A filing failure must not fail the payment — the money has already moved, so
 * the order is flagged for retry rather than rolled back.
 */
async function fileSale(
  uid: string,
  order: Order,
  kraPin: string | undefined,
  now: number,
): Promise<EtimsFiling> {
  const attempts = (order.etims?.attempts ?? 0) + 1;

  try {
    const invoiceNumber = await nextEtimsInvoiceNumber(uid);
    const result = await fileOrder({
      order,
      kraPin: kraPin ?? "",
      invoiceNumber,
      filedAt: new Date(now),
    });

    const filing: EtimsFiling = result.ok
      ? {
          status: "filed",
          invoiceNumber: result.invoiceNumber,
          qrCode: result.qrCode,
          filedAt: now,
          provider: result.provider,
          attempts,
        }
      : { status: "failed", error: result.error, provider: result.provider, attempts };

    await saveEtimsFiling(uid, order.id, filing, now);
    return filing;
  } catch (error) {
    const filing: EtimsFiling = {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      attempts,
    };
    await saveEtimsFiling(uid, order.id, filing, now).catch(() => {});
    return filing;
  }
}

export type RetryFilingResult =
  | { ok: true; filing: EtimsFiling }
  | { ok: false; reason: string };

/**
 * Re-attempt a filing that failed.
 *
 * Refuses on anything that isn't a paid order with an unfiled sale — a retry
 * that could file an unpaid order, or file a second invoice for one already
 * filed, would create a KRA record that doesn't match reality.
 */
export async function retryEtimsFiling(
  uid: string,
  orderId: string,
  now: number,
): Promise<RetryFilingResult> {
  const order = await getOrder(uid, orderId);
  if (!order) return { ok: false, reason: "Order not found." };
  if (order.status !== "paid") return { ok: false, reason: "Only paid orders can be filed." };
  if (order.etims?.status === "filed") {
    return { ok: false, reason: "This order has already been filed." };
  }

  const profile = await getProfile(uid);
  const filing = await fileSale(uid, order, profile?.kraPin, now);
  return { ok: true, filing };
}

// ── Reconciliation ──────────────────────────────────────────────────────────

/** Younger than this and the prompt may legitimately still be on the handset. */
const DEFAULT_MIN_AGE_MS = 2 * 60_000;
/** Past this we stop asking Daraja and close the order out. */
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60_000;
const DEFAULT_LIMIT = 50;

export interface ReconcileSummary {
  checked: number;
  paid: number;
  failed: number;
  expired: number;
  waiting: number;
  errors: string[];
}

/**
 * Ask Daraja what happened to orders whose callback never arrived.
 *
 * Lost callbacks are routine — a redeploy, a timeout, a network blip — and
 * without this sweep those orders sit in `awaiting_payment` indefinitely while
 * the customer's money is gone and the sale is missing from the books. Meant
 * to be run on a schedule; see `/api/mpesa/reconcile`.
 */
export async function reconcileStaleOrders(input: {
  now: number;
  minAgeMs?: number;
  maxAgeMs?: number;
  limit?: number;
}): Promise<ReconcileSummary> {
  const {
    now,
    minAgeMs = DEFAULT_MIN_AGE_MS,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
    limit = DEFAULT_LIMIT,
  } = input;

  const summary: ReconcileSummary = {
    checked: 0,
    paid: 0,
    failed: 0,
    expired: 0,
    waiting: 0,
    errors: [],
  };

  if (!isMpesaConfigured()) {
    summary.errors.push("M-Pesa is not configured");
    return summary;
  }

  const stale = await findStaleAwaitingOrders(now - minAgeMs, limit);

  // Sequential on purpose: Daraja rate-limits the query endpoint, and a sweep
  // that trips that limit reconciles nothing at all.
  for (const { uid, order } of stale) {
    summary.checked += 1;
    const checkoutRequestId = order.mpesa?.checkoutRequestId;

    try {
      const status = checkoutRequestId ? await queryStkStatus(checkoutRequestId) : null;
      const decision = decideReconciliation({
        hasCheckoutId: Boolean(checkoutRequestId),
        resultCode: status?.ok ? status.resultCode : undefined,
        settled: status?.ok ? status.settled : false,
        ageMs: now - order.createdAt,
        maxAgeMs,
      });

      switch (decision) {
        case "settle_paid": {
          // The status query returns no MpesaReceiptNumber — only the callback
          // carries one — so a reconciled order legitimately has no receipt.
          await settlePayment({
            uid,
            orderId: order.id,
            now,
            reconciled: true,
            result: {
              merchantRequestId: order.mpesa?.merchantRequestId ?? "",
              checkoutRequestId: checkoutRequestId ?? "",
              resultCode: 0,
              resultDesc: "Confirmed by status query",
              success: true,
            },
          });
          summary.paid += 1;
          break;
        }
        case "settle_failed": {
          await settlePayment({
            uid,
            orderId: order.id,
            now,
            reconciled: true,
            result: {
              merchantRequestId: order.mpesa?.merchantRequestId ?? "",
              checkoutRequestId: checkoutRequestId ?? "",
              resultCode: status?.ok ? status.resultCode : 1,
              resultDesc: status?.ok ? status.resultDesc : "Payment not completed",
              success: false,
            },
          });
          summary.failed += 1;
          break;
        }
        case "expire":
          await markOrderExpired(uid, order.id, now);
          summary.expired += 1;
          break;
        case "wait":
          summary.waiting += 1;
          break;
      }
    } catch (error) {
      summary.errors.push(
        `${order.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return summary;
}

// ── Receipt ─────────────────────────────────────────────────────────────────

function buildReceipt(input: {
  businessName: string;
  order: Order;
  currency: string;
  receiptNumber?: string;
  filing: EtimsFiling;
  reconciled: boolean;
}): string {
  const { businessName, order, currency, receiptNumber, filing, reconciled } = input;

  const lines = order.items.map(
    (item) => `• ${item.name} × ${item.quantity} — ${formatMoney(item.lineTotal, currency)}`,
  );

  const message = [
    "✅ *Payment received* — thank you!",
    "",
    `*${businessName}*`,
    ...lines,
    "",
    `Total paid: *${formatMoney(order.total, currency)}*`,
    `VAT included: ${formatMoney(order.taxTotal, currency)}`,
  ];

  if (receiptNumber) {
    message.push(`M-Pesa code: ${receiptNumber}`);
  } else if (reconciled) {
    // Say why the code is missing rather than leaving a gap where every other
    // receipt has one.
    message.push("(Confirmed with M-Pesa directly — your M-Pesa SMS has the code.)");
  }

  // Only claim a KRA invoice when one was actually issued: a stub filing says
  // nothing, rather than implying a compliance record that doesn't exist.
  if (filing.status === "filed" && filing.provider !== "stub" && filing.invoiceNumber) {
    message.push(`KRA invoice: ${filing.invoiceNumber}`);
    if (filing.qrCode) message.push(filing.qrCode);
  }

  message.push("", "Reply *MENU* to order again.");
  return message.join("\n");
}
