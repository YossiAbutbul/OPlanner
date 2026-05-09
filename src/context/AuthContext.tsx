import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
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

const USER_CACHE_KEY = "oplanner.user";

const readCachedUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

const writeCachedUser = (u: User | null) => {
  if (!u) {
    localStorage.removeItem(USER_CACHE_KEY);
    return;
  }
  localStorage.setItem(
    USER_CACHE_KEY,
    JSON.stringify({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      photoURL: u.photoURL,
    })
  );
};

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
  const cachedUser = readCachedUser();
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    getRedirectResult(auth).catch((e) => console.error("Redirect sign-in error:", e));
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      writeCachedUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async () => {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (e) {
      throw new Error(mapAuthError(e));
    }
  };

  const signInEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      throw new Error(mapAuthError(e));
    }
  };

  const signUpEmail = async (email: string, password: string, displayName?: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName && displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
        setUser({ ...cred.user });
        writeCachedUser(cred.user);
      }
    } catch (e) {
      throw new Error(mapAuthError(e));
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e) {
      throw new Error(mapAuthError(e));
    }
  };

  const logout = async () => {
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
    Object.keys(localStorage)
      .filter((k) => k.startsWith("oplanner."))
      .forEach((k) => localStorage.removeItem(k));
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signInEmail, signUpEmail, resetPassword, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
