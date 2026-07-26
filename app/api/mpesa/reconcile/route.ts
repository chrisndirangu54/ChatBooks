import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { reconcileStaleOrders } from "@/lib/purchase/pipeline";

/**
 * POST /api/mpesa/reconcile — settle orders whose callback never arrived.
 *
 * Daraja callbacks get lost: a redeploy mid-flight, a timeout, a network blip.
 * When one does, the customer's money is gone, the order sits in
 * `awaiting_payment`, and the sale is missing from the books — silently, which
 * is the worst part. This endpoint asks Daraja directly about anything that's
 * been pending too long and pushes the answer through the same settlement path
 * a callback would have taken.
 *
 * Run it on a schedule — every 5–15 minutes is plenty. On Vercel, add to
 * `vercel.json`:
 *
 * ```json
 * { "crons": [{ "path": "/api/mpesa/reconcile?token=…", "schedule": "*\/10 * * * *" }] }
 * ```
 *
 * Anywhere else, any cron that can make an HTTP POST will do.
 *
 * Auth is `RECONCILE_TOKEN` as `?token=`, or a Vercel cron's own
 * `Authorization: Bearer $CRON_SECRET`. Unlike the M-Pesa callback this
 * endpoint has no unauthenticated mode: it costs Daraja API calls on every
 * hit, so leaving it open is a denial-of-wallet, and it is our own scheduler
 * calling — there's no third party whose auth scheme we have to accept.
 */
function isAuthorized(request: Request): boolean {
  const token = process.env.RECONCILE_TOKEN;
  const cronSecret = process.env.CRON_SECRET;

  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  if (!token) return false;

  const provided = new URL(request.url).searchParams.get("token") ?? "";
  const expectedBuf = Buffer.from(token);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const numeric = (name: string): number | undefined => {
    const raw = params.get(name);
    if (raw === null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };

  try {
    const summary = await reconcileStaleOrders({
      now: Date.now(),
      minAgeMs: numeric("minAgeMs"),
      maxAgeMs: numeric("maxAgeMs"),
      limit: numeric("limit"),
    });

    if (summary.checked > 0) {
      console.log("[ChatBooks Reconcile]", JSON.stringify(summary));
    }
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ChatBooks Reconcile] Sweep failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET is accepted too — several hosted cron services can only issue GETs.
 * Same auth, same work.
 */
export async function GET(request: Request) {
  return POST(request);
}
