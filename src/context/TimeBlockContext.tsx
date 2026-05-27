import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { auth, db, requireUid } from "../firebase";

export interface TimeBlock {
  id: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  title: string;
  color?: string;
  courseId?: string;  // free-form ref e.g. "year|semester|course"
  notes?: string;
}

interface TimeBlockContextProps {
  blocks: TimeBlock[];
  loading: boolean;
  refresh: () => Promise<void>;
  saveBlock: (b: TimeBlock) => Promise<void>;
  removeBlock: (id: string) => Promise<void>;
  getByDate: (date: string) => TimeBlock[];
}

const TimeBlockContext = createContext<TimeBlockContextProps | undefined>(undefined);

const cacheKey = () => {
  const uid = requireUid();
  return `oplanner.timeblocks.${uid}`;
};

export const TimeBlockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    await auth.authStateReady();
    let key: string;
    try { key = cacheKey(); } catch { return; }
    // Optimistic cache paint
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setBlocks(parsed as TimeBlock[]);
      }
    } catch { /* ignore */ }
    setLoading(true);
    try {
      const col = collection(db, `users/${requireUid()}/timeBlocks`);
      const snap = await getDocs(col);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TimeBlock[];
      setBlocks(list);
      try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* quota */ }
    } catch (e) {
      console.error("TimeBlocks fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) refresh();
      else setBlocks([]);
    });
    return () => unsub();
  }, [refresh]);

  const writeCache = (list: TimeBlock[]) => {
    try { localStorage.setItem(cacheKey(), JSON.stringify(list)); } catch { /* ignore */ }
  };

  const saveBlock = useCallback(async (b: TimeBlock) => {
    const col = collection(db, `users/${requireUid()}/timeBlocks`);
    const id = b.id || doc(col).id;
    const payload: TimeBlock = { ...b, id };
    // Firestore rejects undefined — strip them.
    const clean = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    ) as TimeBlock;
    // Optimistic local update BEFORE awaiting Firestore so UI updates instantly.
    setBlocks((prev) => {
      const exists = prev.some((x) => x.id === id);
      const next = exists ? prev.map((x) => (x.id === id ? clean : x)) : [...prev, clean];
      writeCache(next);
      return next;
    });
    try {
      await setDoc(doc(col, id), clean, { merge: true });
    } catch (e) {
      console.error("TimeBlock save error:", e);
    }
  }, []);

  const removeBlock = useCallback(async (id: string) => {
    setBlocks((prev) => {
      const next = prev.filter((x) => x.id !== id);
      writeCache(next);
      return next;
    });
    try {
      await deleteDoc(doc(db, `users/${requireUid()}/timeBlocks`, id));
    } catch (e) {
      console.error("TimeBlock delete error:", e);
    }
  }, []);

  const getByDate = useCallback(
    (date: string) => blocks.filter((b) => b.date === date),
    [blocks]
  );

  return (
    <TimeBlockContext.Provider value={{ blocks, loading, refresh, saveBlock, removeBlock, getByDate }}>
      {children}
    </TimeBlockContext.Provider>
  );
};

export const useTimeBlocks = () => {
  const ctx = useContext(TimeBlockContext);
  if (!ctx) throw new Error("useTimeBlocks must be used within TimeBlockProvider");
  return ctx;
};
