import {
  EmailAuthProvider,
  getRedirectResult,
  reauthenticateWithCredential,
  reauthenticateWithRedirect,
  signOut,
} from "firebase/auth";
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

// Password accounts confirm with their password; others (Google) sign in
// again.
export const usesPassword = (): boolean =>
  !!auth.currentUser?.providerData.some((p) => p.providerId === "password");

// The server accepts a deletion only within 5 minutes of signing in; ask
// for a fresh sign-in a little before that so it can't lapse mid-request.
const FRESH_SIGN_IN_SEC = 4 * 60;

// Set before the Google sign-in redirect so the deletion the user already
// confirmed carries on when they come back. sessionStorage: this tab only.
const PENDING_KEY = "oplanner.pendingDelete";

const reauthError = (e: unknown): Error => {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") return new Error("That password is incorrect.");
  if (code === "auth/user-mismatch") return new Error("Sign in with the account you're deleting.");
  if (code === "auth/too-many-requests") return new Error("Too many attempts. Wait a moment and try again.");
  if (code === "auth/network-request-failed") return new Error("You're offline. Check your connection and try again.");
  return new Error("Couldn't confirm it's you. Try again.");
};

const signedInRecently = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  const { authTime } = await user.getIdTokenResult(true);
  return Date.now() - Date.parse(authTime) < FRESH_SIGN_IN_SEC * 1000;
};

// Server-side delete, then leave this browser clean.
const finishDeletion = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error("You're not signed in.");

  // Let queued offline writes land first, so none re-create data after the
  // server deletes it.
  await Promise.race([waitForPendingWrites(db), new Promise((r) => setTimeout(r, 5000))]);

  const token = await user.getIdToken(true);
  let res: Response;
  try {
    res = await fetch("/api/account", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error("You're offline. Check your connection and try again.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof body?.error === "string" ? body.error : "Couldn't delete your account. Try again.");
  }

  // The account is gone; clear what this browser kept about it.
  Object.keys(localStorage)
    .filter((k) => k.startsWith("oplanner."))
    .forEach((k) => localStorage.removeItem(k));
  await signOut(auth).catch(() => {});
  await terminate(db).catch(() => {});
  await clearIndexedDbPersistence(db).catch(() => {});
};

// Deletes the account after a fresh sign-in. Resolves "deleted" when done,
// or "redirecting" when a Google account is sent to sign in again; the
// deletion then finishes in resumePendingDeletion when the page comes back.
// A redirect, not a popup: the sign-in popup can't be closed across the
// site's Cross-Origin-Opener-Policy and was left behind blank.
export const deleteAccount = async (password?: string): Promise<"deleted" | "redirecting"> => {
  const user = auth.currentUser;
  if (!user) throw new Error("You're not signed in.");

  if (usesPassword()) {
    try {
      if (!password || !user.email) throw Object.assign(new Error(), { code: "auth/wrong-password" });
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } catch (e) {
      throw reauthError(e);
    }
  } else if (!(await signedInRecently())) {
    sessionStorage.setItem(PENDING_KEY, user.uid);
    await reauthenticateWithRedirect(user, googleProvider);
    return "redirecting";
  }

  await finishDeletion();
  return "deleted";
};

// True when this tab came back from the sign-in that a deletion asked for.
export const hasPendingDeletion = (uid: string): boolean => {
  try {
    return sessionStorage.getItem(PENDING_KEY) === uid;
  } catch {
    return false;
  }
};

// Finishes a deletion started before the Google sign-in redirect.
export const resumePendingDeletion = async (): Promise<void> => {
  sessionStorage.removeItem(PENDING_KEY);
  try {
    // Surfaces a failed or mismatched sign-in from the redirect.
    await getRedirectResult(auth);
  } catch (e) {
    throw reauthError(e);
  }
  if (!(await signedInRecently())) throw new Error("Couldn't confirm it's you. Try again.");
  await finishDeletion();
};
