import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BusinessProfile } from "@/types";

const businessDoc = (uid: string) => doc(db, "businesses", uid);

export async function createBusinessProfile(uid: string, profile: BusinessProfile): Promise<void> {
  await setDoc(businessDoc(uid), profile);
}

export async function getBusinessProfile(uid: string): Promise<BusinessProfile | null> {
  const snapshot = await getDoc(businessDoc(uid));
  return snapshot.exists() ? (snapshot.data() as BusinessProfile) : null;
}

export async function updateBusinessProfile(
  uid: string,
  updates: Partial<BusinessProfile>,
): Promise<void> {
  await updateDoc(businessDoc(uid), updates);
}
