import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebase-admin";
import { retryEtimsFiling } from "@/lib/purchase/pipeline";

/**
 * POST /api/etims/retry — re-attempt a failed KRA filing.
 *
 * Exists because the browser can't do this itself: `firestore.rules` makes
 * orders read-only to clients (so a shopkeeper can't rewrite what a customer
 * paid), and filing needs server credentials regardless.
 *
 * Authenticated with a Firebase ID token, and — importantly — the filing is
 * done for the *token's* uid, never a uid from the body. Trusting a
 * caller-supplied uid here would let any signed-in user file invoices against
 * another shop's KRA PIN.
 *
 * Body:  { orderId: string }
 * Reply: { ok: boolean, filing?: EtimsFiling, reason?: string }
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(authHeader.slice("Bearer ".length));
    uid = decoded.uid;
  } catch {
    // Don't echo the verification error — it distinguishes "expired" from
    // "forged" for a caller who shouldn't learn either.
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { orderId } = (body ?? {}) as { orderId?: unknown };
  if (typeof orderId !== "string" || !orderId.trim()) {
    return NextResponse.json({ error: "orderId must be a non-empty string" }, { status: 400 });
  }

  try {
    const result = await retryEtimsFiling(uid, orderId, Date.now());
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 409 });
    }
    return NextResponse.json({ ok: true, filing: result.filing });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ChatBooks eTIMS] Retry failed:", message);
    return NextResponse.json({ error: "retry failed" }, { status: 502 });
  }
}
