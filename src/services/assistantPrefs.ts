import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// The AI Assistant's put-away alerts and nudges, kept on the account so a
// "not now" on the laptop also holds on the phone. One document; `hidden`
// maps each alert or nudge key to "forever" or the date it comes back.
const ref = (uid: string) => doc(db, `users/${uid}/prefs/assistant`);

export type HiddenMap = Record<string, string>;

const isHiddenMap = (x: unknown): x is HiddenMap =>
  !!x && typeof x === "object" && !Array.isArray(x) && Object.values(x).every((v) => typeof v === "string");

export const fetchHiddenNudges = async (uid: string): Promise<HiddenMap> => {
  const snap = await getDoc(ref(uid));
  const hidden = snap.exists() ? snap.get("hidden") : undefined;
  return isHiddenMap(hidden) ? hidden : {};
};

export const saveHiddenNudges = (uid: string, hidden: HiddenMap): Promise<void> =>
  setDoc(ref(uid), { hidden, updatedAt: Date.now() });

// Two devices' lists as one: per key, "forever" wins, else the later date.
export const mergeHidden = (a: HiddenMap, b: HiddenMap): HiddenMap => {
  const out: HiddenMap = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    out[k] = !cur || v === "forever" || (cur !== "forever" && v > cur) ? v : cur;
  }
  return out;
};
