import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, increment } from "firebase/firestore";

// Coins live on the top-level user doc (users/{uid}.coins). Kept in its own
// module rather than initializeDatabase so the coin feature has a small,
// self-contained Firestore surface.

const coinsDocRef = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  return doc(db, "users", uid);
};

export async function getCoins(): Promise<number> {
  const snap = await getDoc(coinsDocRef());
  const data = snap.data();
  return typeof data?.coins === "number" ? data.coins : 0;
}

// Atomic server-side increment + merge so we never clobber other fields on
// the user doc. Batching of many small earns happens in CoinsContext.
export async function addCoinsRemote(delta: number): Promise<void> {
  if (delta === 0) return;
  await setDoc(coinsDocRef(), { coins: increment(delta) }, { merge: true });
}
