import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth, requireUid } from "../firebase";
import { lsCache } from "../hooks/useLocalStorageCache";
import {
  deleteTimeBlock,
  fetchTimeBlocks,
  generateTimeBlockId,
  saveTimeBlock,
} from "../services/timeBlocks";
import type { TimeBlock } from "../types/models";

export type { TimeBlock } from "../types/models";

interface TimeBlockContextProps {
  blocks: TimeBlock[];
  loading: boolean;
  refresh: () => Promise<void>;
  saveBlock: (b: TimeBlock) => Promise<void>;
  removeBlock: (id: string) => Promise<void>;
  getByDate: (date: string) => TimeBlock[];
}

const TimeBlockContext = createContext<TimeBlockContextProps | undefined>(undefined);

const cacheKey = () => `oplanner.timeblocks.${requireUid()}`;

export const TimeBlockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    await auth.authStateReady();
    let key: string;
    try { key = cacheKey(); } catch { return; }

    const cached = lsCache.read<TimeBlock[]>(key);
    if (Array.isArray(cached)) setBlocks(cached);

    setLoading(true);
    try {
      const list = await fetchTimeBlocks(requireUid());
      setBlocks(list);
      lsCache.write(key, list);
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

  const writeCache = useCallback((list: TimeBlock[]) => {
    try { lsCache.write(cacheKey(), list); } catch { /* ignore */ }
  }, []);

  const saveBlock = useCallback(async (b: TimeBlock) => {
    const uid = requireUid();
    const id = b.id || generateTimeBlockId(uid);
    const payload: TimeBlock = { ...b, id };
    setBlocks((prev) => {
      const exists = prev.some((x) => x.id === id);
      const next = exists ? prev.map((x) => (x.id === id ? payload : x)) : [...prev, payload];
      writeCache(next);
      return next;
    });
    try {
      await saveTimeBlock(uid, payload);
    } catch (e) {
      console.error("TimeBlock save error:", e);
    }
  }, [writeCache]);

  const removeBlock = useCallback(async (id: string) => {
    setBlocks((prev) => {
      const next = prev.filter((x) => x.id !== id);
      writeCache(next);
      return next;
    });
    try {
      await deleteTimeBlock(requireUid(), id);
    } catch (e) {
      console.error("TimeBlock delete error:", e);
    }
  }, [writeCache]);

  const getByDate = useCallback(
    (date: string) => blocks.filter((b) => b.date === date),
    [blocks]
  );

  const value = useMemo<TimeBlockContextProps>(
    () => ({ blocks, loading, refresh, saveBlock, removeBlock, getByDate }),
    [blocks, loading, refresh, saveBlock, removeBlock, getByDate]
  );

  return <TimeBlockContext.Provider value={value}>{children}</TimeBlockContext.Provider>;
};

export const useTimeBlocks = () => {
  const ctx = useContext(TimeBlockContext);
  if (!ctx) throw new Error("useTimeBlocks must be used within TimeBlockProvider");
  return ctx;
};
