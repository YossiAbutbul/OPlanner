import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { lsCache } from "../hooks/useLocalStorageCache";
import { getCoins, addCoinsRemote } from "../utility/coins";

interface CoinsContextValue {
  coins: number;
  // Add earned coins. Optimistic + cached instantly; flushed to Firestore in
  // a debounced batch so a minute-by-minute drip doesn't hammer writes.
  addCoins: (n: number) => void;
}

const CoinsContext = createContext<CoinsContextValue | undefined>(undefined);

const cacheKey = (uid: string) => `oplanner.coins.${uid}`;
// Debounce window for flushing accumulated coins to Firestore.
const FLUSH_MS = 15000;

export const CoinsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [coins, setCoins] = useState(0);

  // Coins earned but not yet written to Firestore.
  const pendingRef = useRef(0);
  const flushTimerRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const delta = pendingRef.current;
    if (delta === 0 || !user) return;
    pendingRef.current = 0;
    addCoinsRemote(delta).catch(() => {
      // Write failed — re-queue so the next flush retries.
      pendingRef.current += delta;
    });
  }, [user]);

  // Load on auth: cache-first paint, then reconcile with the server (server
  // value + any coins earned locally but not yet flushed).
  useEffect(() => {
    if (!user) {
      setCoins(0);
      return;
    }
    const cached = lsCache.read<number>(cacheKey(user.uid));
    if (typeof cached === "number") setCoins(cached);
    let cancelled = false;
    getCoins()
      .then((server) => {
        if (cancelled) return;
        const total = server + pendingRef.current;
        setCoins(total);
        lsCache.write(cacheKey(user.uid), total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const addCoins = useCallback(
    (n: number) => {
      if (n <= 0 || !user) return;
      pendingRef.current += n;
      setCoins((prev) => {
        const next = prev + n;
        lsCache.write(cacheKey(user.uid), next);
        return next;
      });
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = window.setTimeout(flush, FLUSH_MS);
    },
    [user, flush]
  );

  // Flush on tab hide / unload / unmount so earned coins survive navigation.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const value = useMemo<CoinsContextValue>(
    () => ({ coins, addCoins }),
    [coins, addCoins]
  );

  return <CoinsContext.Provider value={value}>{children}</CoinsContext.Provider>;
};

export const useCoins = (): CoinsContextValue => {
  const ctx = useContext(CoinsContext);
  if (!ctx) throw new Error("useCoins must be used within CoinsProvider");
  return ctx;
};
