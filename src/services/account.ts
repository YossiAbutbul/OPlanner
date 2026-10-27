import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
} from "firebase/auth";
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

// Password accounts confirm with their password; others (Google) sign in
// again in a popup.
export const usesPassword = (): boolean =>
  !!auth.currentUser?.providerData.some((p) => p.providerId === "password");

const reauthError = (e: unknown): Error => {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") return new Error("That password is incorrect.");
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return new Error("Sign-in was cancelled.");
  if (code === "auth/popup-blocked") return new Error("The sign-in window was blocked. Allow pop-ups and try again.");
  if (code === "auth/user-mismatch") return new Error("Sign in with the account you're deleting.");
  if (code === "auth/too-many-requests") return new Error("Too many attempts. Wait a moment and try again.");
  if (code === "auth/network-request-failed") return new Error("You're offline. Check your connection and try again.");
  return new Error("Couldn't confirm it's you. Try again.");
};

// Deletes the account and everything in it, then leaves this browser clean.
// The server needs a fresh sign-in, so the user signs in again first.
export const deleteAccount = async (password?: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error("You're not signed in.");

  try {
    if (usesPassword()) {
      if (!password || !user.email) throw Object.assign(new Error(), { code: "auth/wrong-password" });
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else {
      await reauthenticateWithPopup(user, googleProvider);
    }
  } catch (e) {
    throw reauthError(e);
  }

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
