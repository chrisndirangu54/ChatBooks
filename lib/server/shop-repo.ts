import { adminDb } from "@/lib/firebase-admin";
import type {
  BusinessProfile,
  EtimsFiling,
  MpesaPayment,
  Order,
  OrderItem,
  Product,
  ShopSession,
} from "@/types";
import type { NewTransaction } from "@/lib/data/transactions";

/**
 * Server-side Firestore access for the shopping flow, via the Admin SDK.
 *
 * The customer placing an order has no ChatBooks account and no browser
 * session, and Daraja's callback has neither — so none of this can go through
 * the client SDK, whose security rules would (correctly) reject every write.
 *
 * **Import from route handlers only.** The Admin SDK bypasses
 * firestore.rules entirely.
 *
 * Layout:
 *   businesses/{uid}/products/{productId}
 *   businesses/{uid}/orders/{orderId}
 *   businesses/{uid}/shopSessions/{phone}
 *   businesses/{uid}/counters/etims        — the monotonic KRA invoice number
 *   mpesaCheckouts/{checkoutRequestId}     — top-level, see below
 */

const business = (uid: string) => adminDb.collection("businesses").doc(uid);

/**
 * Firestore rejects a write containing `undefined`, and most fields on an
 * order are legitimately absent until payment lands. Stripping beats scattering
 * conditional spreads through every call site.
 */
function prune<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export async function getProfile(uid: string): Promise<BusinessProfile | null> {
  const snapshot = await business(uid).get();
  return snapshot.exists ? (snapshot.data() as BusinessProfile) : null;
}

export async function listProducts(uid: string): Promise<Product[]> {
  const snapshot = await business(uid).collection("products").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product);
}

// ── Shopping sessions ──────────────────────────────────────────────────────

/**
 * Sessions are keyed by phone number, which is also the WhatsApp identity —
 * so a customer who messages from the same handset resumes the same cart.
 */
export async function getSession(uid: string, phone: string): Promise<ShopSession | null> {
  const snapshot = await business(uid).collection("shopSessions").doc(phone).get();
  return snapshot.exists ? (snapshot.data() as ShopSession) : null;
}

export async function saveSession(uid: string, session: ShopSession): Promise<void> {
  await business(uid).collection("shopSessions").doc(session.phone).set(prune(session));
}

// ── Orders ─────────────────────────────────────────────────────────────────

export interface NewOrderInput {
  customerPhone: string;
  customerName?: string;
  items: OrderItem[];
  total: number;
  taxTotal: number;
  netTotal: number;
  now: number;
}

export async function createOrder(uid: string, input: NewOrderInput): Promise<Order> {
  const ref = business(uid).collection("orders").doc();
  const order: Order = {
    id: ref.id,
    customerPhone: input.customerPhone,
    customerName: input.customerName,
    items: input.items,
    total: input.total,
    taxTotal: input.taxTotal,
    netTotal: input.netTotal,
    status: "awaiting_payment",
    createdAt: input.now,
    updatedAt: input.now,
    etims: { status: "not_filed" },
  };

  await ref.set(prune(order));
  return order;
}

export async function getOrder(uid: string, orderId: string): Promise<Order | null> {
  const snapshot = await business(uid).collection("orders").doc(orderId).get();
  return snapshot.exists ? ({ id: snapshot.id, ...snapshot.data() } as Order) : null;
}

/**
 * Record the STK push we just sent, and index it so the callback can find its
 * way home.
 *
 * The index is a top-level collection because Daraja's callback carries only a
 * CheckoutRequestID — no business uid, no order id, and no way to add one. The
 * alternative, a collection-group query across every tenant's orders on every
 * callback, is a scan we'd pay for on the hottest path in the app.
 */
export async function attachCheckout(
  uid: string,
  orderId: string,
  payment: { merchantRequestId: string; checkoutRequestId: string },
  now: number,
): Promise<void> {
  await Promise.all([
    business(uid)
      .collection("orders")
      .doc(orderId)
      .update({ mpesa: prune(payment), updatedAt: now }),
    adminDb.collection("mpesaCheckouts").doc(payment.checkoutRequestId).set({
      uid,
      orderId,
      createdAt: now,
    }),
  ]);
}

export async function findCheckout(
  checkoutRequestId: string,
): Promise<{ uid: string; orderId: string } | null> {
  const snapshot = await adminDb.collection("mpesaCheckouts").doc(checkoutRequestId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as { uid?: string; orderId?: string };
  if (!data.uid || !data.orderId) return null;
  return { uid: data.uid, orderId: data.orderId };
}

export interface MarkPaidResult {
  order: Order;
  /** True when the callback was a duplicate and nothing was written. */
  alreadyPaid: boolean;
  transactionId: string;
}

/**
 * Mark an order paid and write the matching ledger entry, exactly once.
 *
 * Daraja retries a callback it doesn't get a 200 from, and retries are not
 * rare — so this runs in a Firestore transaction that re-reads the status and
 * bails if the order is already paid. Without that check a retry would post a
 * second sale to the books and inflate the shopkeeper's revenue, which is the
 * kind of bug that surfaces as a tax discrepancy months later.
 *
 * The ledger write is inside the same transaction on purpose: an order marked
 * paid with no corresponding entry in the books is a silently missing sale.
 */
export async function markOrderPaid(
  uid: string,
  orderId: string,
  payment: MpesaPayment,
  now: number,
): Promise<MarkPaidResult | null> {
  const orderRef = business(uid).collection("orders").doc(orderId);
  const transactionRef = business(uid).collection("transactions").doc();

  return adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(orderRef);
    if (!snapshot.exists) return null;

    const order = { id: snapshot.id, ...snapshot.data() } as Order;

    if (order.status === "paid") {
      return {
        order,
        alreadyPaid: true,
        transactionId: order.transactionId ?? "",
      };
    }

    const ledgerEntry: NewTransaction = {
      type: "sale",
      amount: order.total,
      category: "sales",
      note: `WhatsApp order — ${order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}`,
      source: "chat",
      confidence: 1,
      createdAt: payment.paidAt ?? now,
    };

    tx.set(transactionRef, ledgerEntry);
    tx.update(orderRef, {
      status: "paid",
      mpesa: prune({ ...order.mpesa, ...payment }),
      transactionId: transactionRef.id,
      updatedAt: now,
    });

    return {
      order: { ...order, status: "paid", transactionId: transactionRef.id },
      alreadyPaid: false,
      transactionId: transactionRef.id,
    };
  });
}

/**
 * Record a declined, cancelled or timed-out payment.
 *
 * Deliberately does not touch the cart: the customer's items stay in their
 * session so "PAY" after a mistyped PIN doesn't mean rebuilding the order.
 */
export async function markOrderFailed(
  uid: string,
  orderId: string,
  payment: MpesaPayment,
  now: number,
): Promise<Order | null> {
  const orderRef = business(uid).collection("orders").doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) return null;

  const order = { id: snapshot.id, ...snapshot.data() } as Order;
  // A late failure callback must never undo a payment we already recorded.
  if (order.status === "paid") return order;

  await orderRef.update({
    status: "failed",
    mpesa: prune({ ...order.mpesa, ...payment }),
    updatedAt: now,
  });

  return { ...order, status: "failed" };
}

// ── eTIMS ──────────────────────────────────────────────────────────────────

/**
 * KRA requires a per-seller invoice number that only ever goes up, so it comes
 * from a transactional counter rather than an order count (which would repeat
 * a number the first time an order was deleted).
 */
export async function nextEtimsInvoiceNumber(uid: string): Promise<number> {
  const counterRef = business(uid).collection("counters").doc("etims");

  return adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(counterRef);
    const current = snapshot.exists ? Number(snapshot.data()?.lastInvoiceNumber ?? 0) : 0;
    const next = current + 1;
    tx.set(counterRef, { lastInvoiceNumber: next }, { merge: true });
    return next;
  });
}

export async function saveEtimsFiling(
  uid: string,
  orderId: string,
  filing: EtimsFiling,
  now: number,
): Promise<void> {
  await business(uid)
    .collection("orders")
    .doc(orderId)
    .update({ etims: prune(filing), updatedAt: now });
}
