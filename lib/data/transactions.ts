import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Transaction } from "@/types";

const transactionsCollection = (uid: string) => collection(db, "businesses", uid, "transactions");

export type NewTransaction = Omit<Transaction, "id">;

export async function addTransaction(uid: string, transaction: NewTransaction): Promise<string> {
  const ref = await addDoc(transactionsCollection(uid), transaction);
  return ref.id;
}

export async function updateTransaction(
  uid: string,
  id: string,
  updates: Partial<NewTransaction>,
): Promise<void> {
  await updateDoc(doc(db, "businesses", uid, "transactions", id), updates);
}

export async function deleteTransaction(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "businesses", uid, "transactions", id));
}

export function subscribeToTransactions(
  uid: string,
  callback: (transactions: Transaction[]) => void,
): () => void {
  const q = query(transactionsCollection(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as NewTransaction),
      })),
    );
  });
}
