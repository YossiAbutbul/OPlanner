import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from "firebase/auth";
import { waitForPendingWrites } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

// Firebase Auth SDK persists the session in IndexedDB (browserLocalPersistence)
// by default. Don't duplicate user PII into localStorage — it widens the XSS
// blast radius without adding capability.

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const mapAuthError = (e: unknown): string => {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and retry.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Popup was blocked by the browser.";
    default:
      return e instanceof Error && e.message ? e.message : "Something went wrong.";
  }
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(auth.currentUser === null);

  // Clear any user PII left in localStorage by older builds.
  useEffect(() => {
    try { localStorage.removeItem("oplanner.user"); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    getRedirectResult(auth).catch((e) => console.error("Redirect sign-in error:", e));
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    // Localhost can't use redirect (the auth session would land on
    // firebaseapp.com origin which our local dev page can't read), so
    // fall back to popup. Deployed hosts use redirect via the vercel
    // rewrite that proxies /__/auth/* to firebase.
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");
    try {
      if (isLocalhost) {
        await signInWithPopup(auth, googleProvider);
      } else {
        await signInWithRedirect(auth, googleProvider);
      }
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/user-cancelled"
      ) {
        return;
      }
      throw new Error(mapAuthError(e), { cause: e });
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      throw new Error(mapAuthError(e), { cause: e });
    }
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string, displayName?: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName && displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
        setUser({ ...cred.user });
      }
    } catch (e) {
      throw new Error(mapAuthError(e), { cause: e });
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e) {
      throw new Error(mapAuthError(e), { cause: e });
    }
  }, []);

  const logout = useCallback(async () => {
    // Flush any in-flight Firestore writes before tearing down the session.
    try {
      await Promise.race([
        waitForPendingWrites(db),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch (e) {
      console.error("waitForPendingWrites failed:", e);
    }
    await signOut(auth);
    // Wipe app data on logout but keep per-uid one-shot flags (bootstrap done)
    // so re-signing in doesn't replay onboarding.
    Object.keys(localStorage)
      .filter((k) => k.startsWith("oplanner."))
      .filter((k) => !k.startsWith("oplanner.bootstrapped."))
      .forEach((k) => localStorage.removeItem(k));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signInEmail, signUpEmail, resetPassword, logout }),
    [user, loading, signIn, signInEmail, signUpEmail, resetPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
