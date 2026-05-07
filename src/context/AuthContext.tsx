import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
);

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
  logout: () => Promise<void>;
}

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
    if (isMobile) {
      await signInWithRedirect(auth, googleProvider);
    } else {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (
          code === "auth/popup-blocked" ||
          code === "auth/popup-closed-by-user" ||
          code === "auth/cancelled-popup-request"
        ) {
          await signInWithRedirect(auth, googleProvider);
        } else {
          throw e;
        }
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    Object.keys(localStorage)
      .filter((k) => k.startsWith("oplanner."))
      .forEach((k) => localStorage.removeItem(k));
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
