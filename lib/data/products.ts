import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
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

/**
 * `stock: null` means "stop tracking stock for this product" — distinct from
 * omitting the key, which leaves the existing count alone. The distinction
 * matters because an absent `stock` field is how a product declares itself
 * unlimited, so clearing it has to actually remove the field.
 */
export type ProductUpdate = Partial<Omit<NewProduct, "stock">> & { stock?: number | null };

export async function addProduct(uid: string, product: NewProduct): Promise<string> {
  // Firestore rejects a write containing `undefined`, and an untracked product
  // legitimately has no stock value.
  const payload = Object.fromEntries(
    Object.entries(product).filter(([, value]) => value !== undefined),
  );
  const ref = await addDoc(productsCollection(uid), payload);
  return ref.id;
}

export async function updateProduct(
  uid: string,
  id: string,
  updates: ProductUpdate,
): Promise<void> {
  const { stock, ...rest } = updates;
  const payload: Record<string, unknown> = { ...rest };
  if (stock === null) payload.stock = deleteField();
  else if (stock !== undefined) payload.stock = stock;

  await updateDoc(doc(db, "businesses", uid, "products", id), payload);
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
