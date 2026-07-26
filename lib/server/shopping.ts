import { handleCustomerMessage, newSession } from "@/lib/shop/conversation";
import { formatMoney } from "@/lib/shop/format";
import { isMpesaConfigured, stkPush } from "@/lib/mpesa/daraja";
import { normalizeMsisdn } from "@/lib/mpesa/wire";
import {
  attachCheckout,
  createOrder,
  getSession,
  listProducts,
  saveSession,
} from "@/lib/server/shop-repo";
import type { BusinessProfile } from "@/types";

/**
 * Drives one customer turn: load state, run the pure state machine, perform
 * whatever side effect it asked for.
 *
 * All the branching logic lives in `lib/shop/conversation.ts` where it's
 * tested; this is the thin shell that talks to Firestore, Daraja and WhatsApp.
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
  const currency = profile?.currency || "KES";

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
    currency,
    now,
  });

  if (turn.action.kind !== "checkout") {
    await saveSession(uid, turn.session);
    return { replyText: turn.reply };
  }

  if (!isMpesaConfigured()) {
    // Leave the cart intact and in "cart" state — this is our problem, not the
    // customer's, and their basket shouldn't pay for it.
    await saveSession(uid, { ...session, state: "cart", updatedAt: now });
    return {
      replyText:
        "Sorry — M-Pesa payments aren't switched on for this shop yet. Your cart is saved.",
    };
  }

  const { items, totals } = turn.action;

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
    // Both fields are truncated by Safaricom, so the order id goes in the
    // reference (where it's needed for reconciliation) rather than the desc.
    accountReference: order.id,
    description: "Order",
  });

  if (!push.ok) {
    console.error(`[ChatBooks Shop] STK push failed for order ${order.id}: ${push.error}`);
    await saveSession(uid, { ...session, state: "cart", updatedAt: now });
    return {
      replyText: `Sorry, the M-Pesa request didn't go through (${push.error}).\n\nYour cart is saved — reply *PAY* to try again.`,
      orderId: order.id,
    };
  }

  await attachCheckout(
    uid,
    order.id,
    { merchantRequestId: push.merchantRequestId, checkoutRequestId: push.checkoutRequestId },
    now,
  );
  await saveSession(uid, { ...turn.session, orderId: order.id });

  return {
    replyText: `${turn.reply}\n\nAmount: ${formatMoney(totals.total, currency)}`,
    orderId: order.id,
  };
}
