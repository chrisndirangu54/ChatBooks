import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Order } from "@/types";

/**
 * Read-only from the browser on purpose: orders are created and settled by the
 * webhook and the M-Pesa callback, and letting the dashboard edit them would
 * mean a shopkeeper could change what a customer paid after the fact.
 */
const ordersCollection = (uid: string) => collection(db, "businesses", uid, "orders");

export function subscribeToOrders(uid: string, callback: (orders: Order[]) => void): () => void {
  const q = query(ordersCollection(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Omit<Order, "id">),
      })),
    );
  });
}
