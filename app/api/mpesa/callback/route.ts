import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { parseStkCallback } from "@/lib/mpesa/callback";
import { settlePayment } from "@/lib/purchase/pipeline";
import { findCheckout } from "@/lib/server/shop-repo";

/**
 * POST /api/mpesa/callback — Safaricom Daraja STK Push result callback.
 *
 * Thin by design: parse, authenticate, find the order, and hand off to
 * `settlePayment`. Everything that happens next — booking the sale,
 * decrementing stock, filing with eTIMS, receipting the customer — lives in
 * `lib/purchase/pipeline.ts` and is shared with the reconciliation sweep, so
 * an order settled by a poll is handled identically to one settled here.
 *
 * ## Why this route always answers 200
 *
 * Daraja retries a callback it doesn't get a 200 from. Every non-200 for a
 * payment that *did* succeed becomes a duplicate delivery, so the route
 * acknowledges anything it can parse and handles its own errors internally.
 * Correctness against duplicates lives in `markOrderPaid`, which re-reads the
 * order status inside a Firestore transaction — not in the HTTP status code.
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
 *     payload, and the order is found by CheckoutRequestID — a value we
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

  try {
    const outcome = await settlePayment({
      uid: checkout.uid,
      orderId: checkout.orderId,
      result,
      now: Date.now(),
    });

    console.log(
      `[ChatBooks M-Pesa] Order ${checkout.orderId} → ${outcome.kind}` +
        (outcome.kind === "paid" ? ` (${result.receiptNumber ?? "no receipt"})` : ""),
    );
  } catch (error) {
    // Still a 200: the payment is real whether or not our follow-up worked, and
    // a retry would re-run the same failing step. The reconciliation sweep is
    // the backstop for anything left half-done.
    console.error("[ChatBooks M-Pesa] Post-payment handling failed:", error);
  }

  return NextResponse.json(ACK);
}

/** GET /api/mpesa/callback — health check. */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ChatBooks M-Pesa STK callback",
  });
}
