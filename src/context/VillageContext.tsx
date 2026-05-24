import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useStudy } from "./StudyContext";
import {
  VILLAGERS,
  Villager,
  computeVillageStats,
  isUnlocked,
  checkUnlock,
  RARITY_META,
} from "../utility/village";
import { STRUCTURES, StructureDef } from "../utility/structures";

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
  structures: StructureDef[];
  structureUnlockedCount: number;
  structureTotalCount: number;
  devAllStructures: boolean;
  toggleDevAllStructures: () => void;
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
  const [devExtras, setDevExtras] = useState(0);
  const [devAllStructures, setDevAllStructures] = useState(false);

  const stats = useMemo(() => computeVillageStats(state, sessions), [state, sessions]);

  const realVillagers: VillagerInstance[] = useMemo(() => {
    const out: VillagerInstance[] = [];
    let i = 0;
    for (const v of VILLAGERS) {
      if (!isUnlocked(v, stats)) continue;
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
  }, [stats]);

  const devVillagers: VillagerInstance[] = useMemo(() => {
    const out: VillagerInstance[] = [];
    for (let k = 0; k < devExtras; k++) {
      const seed = `dev-${k}`;
      const { x, z } = positionFor(seed, realVillagers.length + k);
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
    return STRUCTURES.filter((s) => checkUnlock(s.unlock, stats));
  }, [stats, devAllStructures]);

  const structureUnlockedCount = useMemo(
    () => STRUCTURES.filter((s) => checkUnlock(s.unlock, stats)).length,
    [stats]
  );

  const addDevVillager = useCallback(() => setDevExtras((n) => n + 1), []);
  const toggleDevAllStructures = useCallback(
    () => setDevAllStructures((b) => !b),
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
        structures,
        structureUnlockedCount,
        structureTotalCount: STRUCTURES.length,
        devAllStructures,
        toggleDevAllStructures,
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
