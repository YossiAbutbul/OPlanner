// Deleting a user's data, shared by account deletion (api/account.ts) and
// the orphan cleanup (api/cleanup-orphans.ts).
import type { Firestore } from "firebase-admin/firestore";

// Per-user docs kept outside users/ (server-only).
const SIDE_COLLECTIONS = ["agentUsage", "agentWaitlist"];

// users/{uid} and everything under it (years, semesters, courses, tasks,
// time blocks, push subscriptions...), even when users/{uid} itself has no
// fields, plus the server-only docs keyed by the uid.
export const deleteUserData = async (db: Firestore, uid: string): Promise<void> => {
  await db.recursiveDelete(db.doc(`users/${uid}`));
  // The Assistant's saved replies (agentReplyCache/{uid}/replies/...).
  await db.recursiveDelete(db.doc(`agentReplyCache/${uid}`));
  await Promise.all(SIDE_COLLECTIONS.map((c) => db.doc(`${c}/${uid}`).delete()));
};

// Every uid that has data anywhere. listDocuments also returns ids whose doc
// has no fields but has subcollections, which is how users/{uid} usually is.
export const uidsWithData = async (db: Firestore): Promise<string[]> => {
  const lists = await Promise.all(
    ["users", "agentReplyCache", ...SIDE_COLLECTIONS].map((c) => db.collection(c).listDocuments())
  );
  return [...new Set(lists.flat().map((ref) => ref.id))].sort();
};

export const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

// A fresh sign-in is required to delete an account, so a leaked session
// token alone can't do it.
export const REAUTH_MAX_AGE_SEC = 5 * 60;

export const signedInRecently = (authTimeSec: number, nowMs: number): boolean =>
  nowMs / 1000 - authTimeSec <= REAUTH_MAX_AGE_SEC;
