import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { TimeBlock } from "../types/models";

const colPath = (uid: string) => `users/${uid}/timeBlocks`;

export const fetchTimeBlocks = async (uid: string): Promise<TimeBlock[]> => {
  const snap = await getDocs(collection(db, colPath(uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TimeBlock[];
};

export const generateTimeBlockId = (uid: string): string =>
  doc(collection(db, colPath(uid))).id;

export const saveTimeBlock = async (uid: string, b: TimeBlock): Promise<void> => {
  // Firestore rejects undefined — strip before write.
  const clean = Object.fromEntries(
    Object.entries(b).filter(([, v]) => v !== undefined)
  ) as TimeBlock;
  await setDoc(doc(db, colPath(uid), b.id), clean, { merge: true });
};

export const deleteTimeBlock = async (uid: string, id: string): Promise<void> => {
  await deleteDoc(doc(db, colPath(uid), id));
};
