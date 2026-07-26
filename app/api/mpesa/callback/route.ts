import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { describeFailure, parseStkCallback } from "@/lib/mpesa/callback";
import { darajaAmount } from "@/lib/mpesa/wire";
import { fileOrder } from "@/lib/etims/provider";
import {
  findCheckout,
  getProfile,
  getSession,
  markOrderFailed,
  markOrderPaid,
  nextEtimsInvoiceNumber,
  saveEtimsFiling,
  saveSession,
} from "@/lib/server/shop-repo";
import { formatMoney } from "@/lib/shop/format";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import type { EtimsFiling, Order } from "@/types";

/**
 * POST /api/mpesa/callback — Safaricom Daraja STK Push result callback.
 *
 * ## Why this route always answers 200
 *
 * Daraja retries a callback it doesn't get a 200 from. Every non-200 we return
 * for a payment that *did* succeed becomes a duplicate delivery, so the route
 * acknowledges anything it can parse and does its own error handling
 * internally. Correctness against duplicates lives in `markOrderPaid`, which
 * re-reads the order status inside a Firestore transaction — not in the HTTP
 * status code.
 *
 * ## Authentication
 *
 * Daraja does not sign its callbacks; there is no HMAC to verify. Two things
 * stand in for that:
 *
 *  1. `MPESA_CALLBACK_TOKEN` — a shared secret carried as `?token=` on the
 *     CallBackURL you register. Unset means unauthenticated, which is fine
 *     locally and is warned about below.
 *  2. More importantly, **nothing in the callback body is trusted for money.**
 *     The ledger records the stored order total, not the `Amount` in the
 *     payload, and the receipt is looked up by CheckoutRequestID — a value we
 *     generated. A forged callback can therefore mark an order paid, but
 *     cannot invent an amount or an order.
 *
 *  Optionally restrict inbound IPs to Safaricom's published range at your
 *  proxy or host for a third layer.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.MPESA_CALLBACK_TOKEN;
  if (!expected) {
    console.warn(
      "[ChatBooks M-Pesa] MPESA_CALLBACK_TOKEN is not set; accepting unauthenticated callbacks",
    );
    return true;
  }

  const provided = new URL(request.url).searchParams.get("token") ?? "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/** Daraja's expected acknowledgement body. */
const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Malformed body" }, { status: 400 });
  }

  const result = parseStkCallback(body);
  if (!result) {
    console.error("[ChatBooks M-Pesa] Unrecognised callback body:", JSON.stringify(body));
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Unrecognised body" }, { status: 400 });
  }

  const checkout = await findCheckout(result.checkoutRequestId);
  if (!checkout) {
    // Acknowledge rather than 404: an unknown id is either a callback for an
    // order we've since deleted or someone probing. Either way, retries help
    // nobody.
    console.warn(`[ChatBooks M-Pesa] No order for checkout ${result.checkoutRequestId}`);
    return NextResponse.json(ACK);
  }

  const { uid, orderId } = checkout;
  const now = Date.now();

  try {
    if (!result.success) {
      const order = await markOrderFailed(
        uid,
        orderId,
        {
          resultCode: result.resultCode,
          resultDesc: result.resultDesc,
        },
        now,
      );

      if (order && order.status !== "paid") {
        // Put the customer back in their cart so retrying is one word, not a
        // rebuilt order.
        const session = await getSession(uid, order.customerPhone);
        if (session) {
          await saveSession(uid, { ...session, state: "cart", orderId: undefined, updatedAt: now });
        }
        await sendWhatsAppMessage({
          phone: order.customerPhone,
          message: `${describeFailure(result)}\n\nYour cart is still saved — reply *PAY* to try again.`,
        });
      }

      return NextResponse.json(ACK);
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
    );

    if (!paid) {
      console.warn(`[ChatBooks M-Pesa] Order ${orderId} vanished before its callback landed`);
      return NextResponse.json(ACK);
    }

    if (paid.alreadyPaid) {
      // A Daraja retry. The books are already right; sending a second receipt
      // would tell the customer they'd been charged twice.
      console.log(`[ChatBooks M-Pesa] Duplicate callback for order ${orderId}, ignored`);
      return NextResponse.json(ACK);
    }

    const { order } = paid;

    // Worth knowing about, but never worth overriding the stored total with:
    // the order is what the customer agreed to.
    if (result.amount !== undefined && result.amount !== darajaAmount(order.total)) {
      console.error(
        `[ChatBooks M-Pesa] Amount mismatch on order ${orderId}: collected ${result.amount}, expected ${darajaAmount(order.total)}`,
      );
    }

    // Clear the cart now that it's been bought and paid for.
    const session = await getSession(uid, order.customerPhone);
    if (session) {
      await saveSession(uid, {
        ...session,
        state: "browsing",
        items: [],
        orderId: undefined,
        updatedAt: now,
      });
    }

    const profile = await getProfile(uid);
    const currency = profile?.currency || "KES";
    const filing = await fileSale(uid, order.id, order, profile?.kraPin, now);

    await sendWhatsAppMessage({
      phone: order.customerPhone,
      message: buildReceipt({
        businessName: profile?.businessName || "our shop",
        order,
        currency,
        receiptNumber: result.receiptNumber,
        filing,
      }),
    });

    console.log(
      `[ChatBooks M-Pesa] Order ${orderId} paid (${result.receiptNumber}) → transaction ${paid.transactionId}`,
    );
    return NextResponse.json(ACK);
  } catch (error) {
    // Still a 200: the payment is real whether or not our follow-up worked,
    // and a retry would re-run the same failing step.
    console.error("[ChatBooks M-Pesa] Post-payment handling failed:", error);
    return NextResponse.json(ACK);
  }
}

/**
 * File the sale with KRA, recording the outcome either way.
 *
 * A filing failure must not fail the payment — the money has already moved, so
 * the order is flagged for the shopkeeper to retry from the dashboard rather
 * than rolled back.
 */
async function fileSale(
  uid: string,
  orderId: string,
  order: Order,
  kraPin: string | undefined,
  now: number,
): Promise<EtimsFiling> {
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
        }
      : { status: "failed", error: result.error, provider: result.provider };

    await saveEtimsFiling(uid, orderId, filing, now);
    return filing;
  } catch (error) {
    const filing: EtimsFiling = {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
    await saveEtimsFiling(uid, orderId, filing, now).catch(() => {});
    return filing;
  }
}

function buildReceipt(input: {
  businessName: string;
  order: Order;
  currency: string;
  receiptNumber?: string;
  filing: EtimsFiling;
}): string {
  const { businessName, order, currency, receiptNumber, filing } = input;

  const lines = order.items.map(
    (item) => `• ${item.name} × ${item.quantity} — ${formatMoney(item.lineTotal, currency)}`,
  );

  const message = [
    `✅ *Payment received* — thank you!`,
    "",
    `*${businessName}*`,
    ...lines,
    "",
    `Total paid: *${formatMoney(order.total, currency)}*`,
    `VAT included: ${formatMoney(order.taxTotal, currency)}`,
  ];

  if (receiptNumber) message.push(`M-Pesa code: ${receiptNumber}`);

  // Only claim a KRA invoice when one was actually issued — a stub filing
  // says nothing, rather than implying a compliance record that doesn't exist.
  if (filing.status === "filed" && filing.provider !== "stub" && filing.invoiceNumber) {
    message.push(`KRA invoice: ${filing.invoiceNumber}`);
    if (filing.qrCode) message.push(filing.qrCode);
  }

  message.push("", "Reply *MENU* to order again.");
  return message.join("\n");
}

/** GET /api/mpesa/callback — health check. */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ChatBooks M-Pesa STK callback",
  });
}
