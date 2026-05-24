import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useStudy } from "./StudyContext";
import { useVillageState } from "./VillageStateContext";
import { useAuth } from "./AuthContext";

// Dev allowlist sourced from VITE_DEV_EMAILS (comma-separated). Kept out of
// source so the email isn't visible in git history. Still ends up in the
// shipped JS bundle — fine because the email is a flag, not a credential.
const DEV_EMAILS = new Set(
  ((import.meta.env.VITE_DEV_EMAILS as string | undefined) || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);
import {
  VILLAGERS,
  Villager,
  computeVillageStats,
  isUnlocked,
  RARITY_META,
} from "../utility/village";
import { STRUCTURES, StructureDef } from "../utility/structures";
import { computeEarnedCoins, computeSpentCoins } from "../utility/currency";
import {
  ActivePair,
  computeActivePairs,
  computeFocusMultiplier,
  pairsByBuilding,
} from "../utility/villagerBonus";

export interface VillagerInstance {
  id: string;
  x: number;
  z: number;
  color: string;
  name: string;
  title: string;
  emoji: string;
  rarity: Villager["rarity"];
  source: "unlocked" | "dev";
  modelUrl?: string;
}

interface VillageContextProps {
  villagers: VillagerInstance[];
  unlockedCount: number;
  totalCount: number;
  devExtras: number;
  addDevVillager: () => void;
  removeLastDev: () => void;
  clearDev: () => void;
  /** All structure plots (whether purchased or not). */
  allStructures: StructureDef[];
  /** Structures the user has actually bought + placed. */
  structures: StructureDef[];
  /** Structures still available for purchase. */
  availableStructures: StructureDef[];
  structureUnlockedCount: number;
  structureTotalCount: number;
  devAllStructures: boolean;
  toggleDevAllStructures: () => void;
  devVillagerShop: boolean;
  toggleDevVillagerShop: () => void;
  // Currency
  coinsEarned: number;
  coinsSpent: number;
  coinBalance: number;
  canAfford: (id: string) => boolean;
  purchase: (id: string) => boolean;
  refund: (id: string) => void;
  // Villager synergy
  activePairs: ActivePair[];
  focusMultiplier: number;
  pairsForBuilding: Map<string, ActivePair[]>;
  // Villager shop
  allVillagers: Villager[];
  availableVillagers: Villager[];
  canAffordVillager: (id: string) => boolean;
  purchaseVillager: (id: string) => boolean;
  refundVillager: (id: string) => void;
}

const PALETTE = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

const VillageContext = createContext<VillageContextProps | undefined>(undefined);

// Deterministic hash for stable positions across reloads.
const hashStr = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const positionFor = (seed: string, index: number): { x: number; z: number } => {
  const h = hashStr(seed);
  // Spread across rings; further out as index grows.
  const ring = 4 + (index % 3) * 3 + ((h >> 4) & 0x7) * 0.4;
  const angle = ((h & 0xffff) / 0xffff) * Math.PI * 2 + index * 0.6;
  return { x: Math.cos(angle) * ring, z: Math.sin(angle) * ring };
};

const colorForRarity = (r: Villager["rarity"]): string => RARITY_META[r].color;

export const VillageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, sessions } = useStudy();
  const { user } = useAuth();
  const isDev =
    !!user?.email && DEV_EMAILS.has(user.email.toLowerCase());
  const {
    purchasedStructures,
    purchaseStructure,
    refundStructure,
    purchasedVillagers,
    purchaseVillager: storePurchaseVillager,
    refundVillager: storeRefundVillager,
  } = useVillageState();
  const [devExtras, setDevExtras] = useState(0);
  const [devAllStructures, setDevAllStructures] = useState(false);
  const [devVillagerShop, setDevVillagerShop] = useState(false);

  const stats = useMemo(
    () => computeVillageStats(state, sessions),
    [state, sessions]
  );

  // Normal unlock path = achievement-based (isUnlocked). Dev purchases stack
  // on top so the shop still works in dev mode.
  const unlockedVillagerIds = useMemo(() => {
    const out = new Set<string>();
    for (const v of VILLAGERS) {
      if (isUnlocked(v, stats) || purchasedVillagers.has(v.id)) out.add(v.id);
    }
    return Array.from(out);
  }, [stats, purchasedVillagers]);

  const activePairs = useMemo(
    () => computeActivePairs(unlockedVillagerIds, purchasedStructures),
    [unlockedVillagerIds, purchasedStructures]
  );
  const focusMultiplier = useMemo(
    () => computeFocusMultiplier(activePairs),
    [activePairs]
  );
  const pairsForBuilding = useMemo(
    () => pairsByBuilding(activePairs),
    [activePairs]
  );

  // Currency.
  const earned = useMemo(
    () => computeEarnedCoins(state, sessions, focusMultiplier, isDev),
    [state, sessions, focusMultiplier, isDev]
  );
  const coinsSpent = useMemo(
    () =>
      computeSpentCoins(purchasedStructures, STRUCTURES) +
      computeSpentCoins(purchasedVillagers, VILLAGERS),
    [purchasedStructures, purchasedVillagers]
  );
  const coinBalance = earned.total - coinsSpent;

  const realVillagers: VillagerInstance[] = useMemo(() => {
    const out: VillagerInstance[] = [];
    let i = 0;
    for (const v of VILLAGERS) {
      if (!isUnlocked(v, stats) && !purchasedVillagers.has(v.id)) continue;
      const { x, z } = positionFor(v.id, i);
      out.push({
        id: `real-${v.id}`,
        x,
        z,
        color: colorForRarity(v.rarity),
        name: v.name,
        title: v.title,
        emoji: v.emoji,
        rarity: v.rarity,
        source: "unlocked",
        modelUrl: v.modelUrl,
      });
      i++;
    }
    return out;
  }, [stats, purchasedVillagers]);

  const devVillagers: VillagerInstance[] = useMemo(() => {
    const out: VillagerInstance[] = [];
    const pool = [
      "baker", "bard", "elder", "fox", "knight", "owl",
      "scholar", "smith", "sprout", "wizard",
    ];
    for (let k = 0; k < devExtras; k++) {
      const seed = `dev-${k}`;
      const { x, z } = positionFor(seed, realVillagers.length + k);
      const modelId = pool[k % pool.length];
      out.push({
        id: seed,
        x,
        z,
        color: PALETTE[k % PALETTE.length],
        name: `Test ${k + 1}`,
        title: "Dev villager",
        emoji: "🧪",
        rarity: "common",
        source: "dev",
        modelUrl: `${import.meta.env.BASE_URL}models/villagers/${modelId}.glb`,
      });
    }
    return out;
  }, [devExtras, realVillagers.length]);

  const villagers = useMemo(
    () => [...realVillagers, ...devVillagers],
    [realVillagers, devVillagers]
  );

  const structures: StructureDef[] = useMemo(() => {
    if (devAllStructures) return STRUCTURES;
    return STRUCTURES.filter((s) => purchasedStructures.has(s.id));
  }, [purchasedStructures, devAllStructures]);

  const availableStructures: StructureDef[] = useMemo(
    () => STRUCTURES.filter((s) => !purchasedStructures.has(s.id)),
    [purchasedStructures]
  );

  const structureUnlockedCount = purchasedStructures.size;

  const canAfford = useCallback(
    (id: string) => {
      const s = STRUCTURES.find((x) => x.id === id);
      return !!s && coinBalance >= s.cost;
    },
    [coinBalance]
  );

  const purchase = useCallback(
    (id: string): boolean => {
      const s = STRUCTURES.find((x) => x.id === id);
      if (!s) return false;
      if (purchasedStructures.has(id)) return false;
      if (coinBalance < s.cost) return false;
      purchaseStructure(id);
      return true;
    },
    [coinBalance, purchasedStructures, purchaseStructure]
  );

  const refund = useCallback(
    (id: string) => refundStructure(id),
    [refundStructure]
  );

  // Shop hides anyone already recruited (purchased OR achievement-unlocked).
  const availableVillagers = useMemo(
    () =>
      VILLAGERS.filter(
        (v) => !purchasedVillagers.has(v.id) && !isUnlocked(v, stats)
      ),
    [purchasedVillagers, stats]
  );

  const canAffordVillager = useCallback(
    (id: string) => {
      const v = VILLAGERS.find((x) => x.id === id);
      return !!v && coinBalance >= v.cost;
    },
    [coinBalance]
  );

  const purchaseVillager = useCallback(
    (id: string): boolean => {
      const v = VILLAGERS.find((x) => x.id === id);
      if (!v) return false;
      if (purchasedVillagers.has(id)) return false;
      if (coinBalance < v.cost) return false;
      storePurchaseVillager(id);
      return true;
    },
    [coinBalance, purchasedVillagers, storePurchaseVillager]
  );

  const refundVillager = useCallback(
    (id: string) => storeRefundVillager(id),
    [storeRefundVillager]
  );

  const addDevVillager = useCallback(() => setDevExtras((n) => n + 1), []);
  const toggleDevAllStructures = useCallback(
    () => setDevAllStructures((b) => !b),
    []
  );
  const toggleDevVillagerShop = useCallback(
    () => setDevVillagerShop((b) => !b),
    []
  );
  const removeLastDev = useCallback(
    () => setDevExtras((n) => Math.max(0, n - 1)),
    []
  );
  const clearDev = useCallback(() => setDevExtras(0), []);

  return (
    <VillageContext.Provider
      value={{
        villagers,
        unlockedCount: realVillagers.length,
        totalCount: VILLAGERS.length,
        devExtras,
        addDevVillager,
        removeLastDev,
        clearDev,
        allStructures: STRUCTURES,
        structures,
        availableStructures,
        structureUnlockedCount,
        structureTotalCount: STRUCTURES.length,
        devAllStructures,
        toggleDevAllStructures,
        devVillagerShop,
        toggleDevVillagerShop,
        coinsEarned: earned.total,
        coinsSpent,
        coinBalance,
        canAfford,
        purchase,
        refund,
        activePairs,
        focusMultiplier,
        pairsForBuilding,
        allVillagers: VILLAGERS,
        availableVillagers,
        canAffordVillager,
        purchaseVillager,
        refundVillager,
      }}
    >
      {children}
    </VillageContext.Provider>
  );
};

export const useVillage = (): VillageContextProps => {
  const ctx = useContext(VillageContext);
  if (!ctx) throw new Error("useVillage must be used within VillageProvider");
  return ctx;
};
