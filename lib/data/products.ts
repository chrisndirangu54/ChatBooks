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
import type { Product } from "@/types";

const productsCollection = (uid: string) => collection(db, "businesses", uid, "products");

export type NewProduct = Omit<Product, "id">;

export async function addProduct(uid: string, product: NewProduct): Promise<string> {
  const ref = await addDoc(productsCollection(uid), product);
  return ref.id;
}

export async function updateProduct(
  uid: string,
  id: string,
  updates: Partial<NewProduct>,
): Promise<void> {
  await updateDoc(doc(db, "businesses", uid, "products", id), updates);
}

export async function deleteProduct(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "businesses", uid, "products", id));
}

export function subscribeToProducts(
  uid: string,
  callback: (products: Product[]) => void,
): () => void {
  const q = query(productsCollection(uid), orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as NewProduct),
      })),
    );
  });
}
