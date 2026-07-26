import { auth } from "@/lib/firebase";

/**
 * Ask the server to re-file an order with KRA.
 *
 * Goes through an API route rather than writing Firestore directly because
 * orders are read-only to clients and filing needs server credentials. The
 * route files for the token's own uid, so no business id is sent from here.
 */
export async function requestEtimsRetry(
  orderId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: "You're signed out." };

  try {
    const response = await fetch("/api/etims/retry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ orderId }),
    });

    const data = (await response.json()) as { ok?: boolean; reason?: string; error?: string };
    if (!response.ok || !data.ok) {
      return { ok: false, reason: data.reason || data.error || "Filing failed." };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
