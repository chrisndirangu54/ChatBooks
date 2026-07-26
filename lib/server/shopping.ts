import { handleCustomerMessage, newSession } from "@/lib/shop/conversation";
import { normalizeMsisdn } from "@/lib/mpesa/wire";
import { startCheckout } from "@/lib/purchase/pipeline";
import { getSession, listProducts, saveSession } from "@/lib/server/shop-repo";
import type { BusinessProfile } from "@/types";

/**
 * Drives one customer turn: load state, run the pure state machine, perform
 * whatever side effect it asked for.
 *
 * All the branching logic lives in `lib/shop/conversation.ts` where it's
 * tested, and everything downstream of "they want to pay" lives in
 * `lib/purchase/pipeline.ts`. This is the thin seam between them.
 *
 * **Import from route handlers only** — reaches the Admin SDK and Daraja.
 */

export interface ShoppingReply {
  replyText: string;
  orderId?: string;
}

export async function handleShoppingMessage(input: {
  uid: string;
  profile: BusinessProfile | null;
  /** Customer's number, any Kenyan format. */
  phone: string;
  text: string;
  now: number;
}): Promise<ShoppingReply> {
  const { uid, profile, text, now } = input;

  // The session key must be one canonical form, or a customer who appears as
  // 254712… on one message and 0712… on the next gets two carts.
  const phone = normalizeMsisdn(input.phone) ?? input.phone.replace(/\D/g, "");

  const [existing, catalog] = await Promise.all([getSession(uid, phone), listProducts(uid)]);
  const session = existing ?? newSession(phone, now);

  const turn = handleCustomerMessage({
    session,
    catalog,
    text,
    businessName: profile?.businessName || "our shop",
    currency: profile?.currency || "KES",
    now,
  });

  if (turn.action.kind !== "checkout") {
    await saveSession(uid, turn.session);
    return { replyText: turn.reply };
  }

  const checkout = await startCheckout({
    uid,
    profile,
    phone,
    items: turn.action.items,
    totals: turn.action.totals,
    now,
  });

  if (!checkout.ok) {
    // Roll the session back to "cart" rather than leaving it awaiting a
    // payment that was never requested — otherwise the customer is stuck being
    // told to enter a PIN for a prompt that doesn't exist.
    await saveSession(uid, { ...session, state: "cart", updatedAt: now });
    return { replyText: checkout.message, orderId: checkout.order?.id };
  }

  await saveSession(uid, { ...turn.session, orderId: checkout.order?.id });
  return { replyText: checkout.message, orderId: checkout.order?.id };
}
