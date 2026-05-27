import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

interface CameraView {
  position: [number, number, number];
  target: [number, number, number];
}

interface VillagePersistShape {
  seenVillagers: string[];
  seenStructures: string[];
  purchasedStructures?: string[];
  /** Legacy from short-lived evolution system. Migrated on load → purchasedStructures. */
  structureLevels?: Record<string, number>;
  purchasedVillagers?: string[];
  camera?: CameraView;
  lastEnteredAt?: number;
}

interface VillageStateContextProps {
  seenVillagers: Set<string>;
  seenStructures: Set<string>;
  purchasedStructures: Set<string>;
  purchasedVillagers: Set<string>;
  camera: CameraView | null;
  markVillagerSeen: (id: string) => void;
  markStructureSeen: (id: string) => void;
  markAllSeen: (villagerIds: string[], structureIds: string[]) => void;
  purchaseStructure: (id: string) => void;
  refundStructure: (id: string) => void;
  purchaseVillager: (id: string) => void;
  refundVillager: (id: string) => void;
  setCamera: (c: CameraView) => void;
  loaded: boolean;
}

const VillageStateContext = createContext<VillageStateContextProps | undefined>(undefined);

const SAVE_DEBOUNCE_MS = 800;

export const VillageStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [seenVillagers, setSeenVillagers] = useState<Set<string>>(new Set());
  const [seenStructures, setSeenStructures] = useState<Set<string>>(new Set());
  const [purchasedStructures, setPurchasedStructures] = useState<Set<string>>(
    new Set()
  );
  const [purchasedVillagers, setPurchasedVillagers] = useState<Set<string>>(
    new Set()
  );
  const [camera, setCameraState] = useState<CameraView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const uidRef = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    setSeenVillagers(new Set());
    setSeenStructures(new Set());
    setPurchasedStructures(new Set());
    setPurchasedVillagers(new Set());
    setCameraState(null);
    setLoaded(false);
    uidRef.current = user?.uid ?? null;
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, `users/${user.uid}/village/state`));
        if (cancelled || uidRef.current !== user.uid) return;
        if (snap.exists()) {
          const d = snap.data() as Partial<VillagePersistShape>;
          setSeenVillagers(new Set(d.seenVillagers || []));
          setSeenStructures(new Set(d.seenStructures || []));
          // Migrate: any id with level > 0 from the short-lived evolution
          // system counts as purchased.
          const purchased = new Set<string>(d.purchasedStructures || []);
          for (const [id, lvl] of Object.entries(d.structureLevels || {})) {
            if ((lvl ?? 0) > 0) purchased.add(id);
          }
          setPurchasedStructures(purchased);
          setPurchasedVillagers(new Set(d.purchasedVillagers || []));
          if (d.camera) setCameraState(d.camera);
        }
      } catch (e) {
        console.error("VillageState load error:", e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const scheduleSave = useCallback(
    (next: Partial<VillagePersistShape>) => {
      if (!user) return;
      const uid = user.uid;
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        try {
          await setDoc(
            doc(db, `users/${uid}/village/state`),
            { ...next, lastEnteredAt: Date.now() },
            { merge: true }
          );
        } catch (e) {
          console.error("VillageState save error:", e);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [user]
  );

  const markVillagerSeen = useCallback(
    (id: string) => {
      setSeenVillagers((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        scheduleSave({ seenVillagers: Array.from(next) });
        return next;
      });
    },
    [scheduleSave]
  );

  const markStructureSeen = useCallback(
    (id: string) => {
      setSeenStructures((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        scheduleSave({ seenStructures: Array.from(next) });
        return next;
      });
    },
    [scheduleSave]
  );

  const markAllSeen = useCallback(
    (villagerIds: string[], structureIds: string[]) => {
      let changed = false;
      const nextV = new Set(seenVillagers);
      for (const id of villagerIds) {
        if (!nextV.has(id)) {
          nextV.add(id);
          changed = true;
        }
      }
      const nextS = new Set(seenStructures);
      for (const id of structureIds) {
        if (!nextS.has(id)) {
          nextS.add(id);
          changed = true;
        }
      }
      if (changed) {
        setSeenVillagers(nextV);
        setSeenStructures(nextS);
        scheduleSave({
          seenVillagers: Array.from(nextV),
          seenStructures: Array.from(nextS),
        });
      }
    },
    [seenVillagers, seenStructures, scheduleSave]
  );

  const setCamera = useCallback(
    (c: CameraView) => {
      setCameraState(c);
      scheduleSave({ camera: c });
    },
    [scheduleSave]
  );

  const purchaseStructure = useCallback(
    (id: string) => {
      setPurchasedStructures((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        scheduleSave({ purchasedStructures: Array.from(next) });
        return next;
      });
    },
    [scheduleSave]
  );

  const refundStructure = useCallback(
    (id: string) => {
      setPurchasedStructures((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        scheduleSave({ purchasedStructures: Array.from(next) });
        return next;
      });
    },
    [scheduleSave]
  );

  const purchaseVillager = useCallback(
    (id: string) => {
      setPurchasedVillagers((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        scheduleSave({ purchasedVillagers: Array.from(next) });
        return next;
      });
    },
    [scheduleSave]
  );

  const refundVillager = useCallback(
    (id: string) => {
      setPurchasedVillagers((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        scheduleSave({ purchasedVillagers: Array.from(next) });
        return next;
      });
    },
    [scheduleSave]
  );

  const value = useMemo(
    () => ({
      seenVillagers,
      seenStructures,
      purchasedStructures,
      purchasedVillagers,
      camera,
      markVillagerSeen,
      markStructureSeen,
      markAllSeen,
      purchaseStructure,
      refundStructure,
      purchaseVillager,
      refundVillager,
      setCamera,
      loaded,
    }),
    [
      seenVillagers,
      seenStructures,
      purchasedStructures,
      purchasedVillagers,
      camera,
      markVillagerSeen,
      markStructureSeen,
      markAllSeen,
      purchaseStructure,
      refundStructure,
      purchaseVillager,
      refundVillager,
      setCamera,
      loaded,
    ]
  );

  return (
    <VillageStateContext.Provider value={value}>{children}</VillageStateContext.Provider>
  );
};

export const useVillageState = (): VillageStateContextProps => {
  const ctx = useContext(VillageStateContext);
  if (!ctx) throw new Error("useVillageState must be used within VillageStateProvider");
  return ctx;
};
