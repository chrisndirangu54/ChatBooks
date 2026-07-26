import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebase-admin";
import { serverTransactionAI } from "@/lib/ai/server";

/**
 * POST /api/ai/parse-transaction
 *
 * Turns one chat message into a ParsedTransaction. Exists so the browser never
 * sees ANTHROPIC_API_KEY — the chat page posts here, this route calls Claude.
 *
 * Requires a Firebase ID token. Without that check this endpoint would be an
 * open door onto a metered API: anyone could spend the project's token budget
 * in a loop, which is a billing incident, not just a security smell.
 *
 * Body:  { message: string, categories?: string[] }
 * Reply: { parsed: ParsedTransaction | null }
 */

/** Long enough for a pasted mobile-money receipt, short enough to bound cost. */
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CATEGORIES = 40;

/**
 * Per-user rate limit, in-process.
 *
 * Caveat worth knowing: this is per server instance, so on a multi-instance
 * deploy the effective limit is this times the instance count, and it resets on
 * every cold start. It's a guard against a runaway client loop, not a billing
 * control — for that, set spend limits on the API key itself.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const recentRequests = new Map<string, number[]>();

function isRateLimited(uid: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (recentRequests.get(uid) ?? []).filter((t) => t > cutoff);

  if (hits.length >= RATE_LIMIT_MAX_REQUESTS) {
    recentRequests.set(uid, hits);
    return true;
  }

  hits.push(now);
  recentRequests.set(uid, hits);

  // Keep the map from growing without bound on a long-lived instance.
  if (recentRequests.size > 5000) {
    for (const [key, timestamps] of recentRequests) {
      if (timestamps.every((t) => t <= cutoff)) recentRequests.delete(key);
    }
  }

  return false;
}

export async function POST(req: Request) {
  // ── Authenticate ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
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

  if (isRateLimited(uid)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  // ── Validate input ───────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { message, categories } = (body ?? {}) as { message?: unknown; categories?: unknown };

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message must be a non-empty string" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "message too long" }, { status: 413 });
  }

  const knownCategories = Array.isArray(categories)
    ? categories.filter((c): c is string => typeof c === "string").slice(0, MAX_CATEGORIES)
    : [];

  // ── Parse ────────────────────────────────────────────────────────────────
  try {
    const parsed = await serverTransactionAI.parseMessage(message, knownCategories);
    return NextResponse.json({ parsed });
  } catch (error) {
    console.error("[ChatBooks AI] parse-transaction route failed:", error);
    return NextResponse.json({ error: "parsing failed" }, { status: 502 });
  }
}
