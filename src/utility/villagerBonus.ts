/**
 * Villager ↔ building synergy table.
 *
 * When a villager has been unlocked AND their paired building is purchased,
 * the village gets a +bonusPct boost to coin-per-minute focus income.
 * All active pairs stack additively.
 */
export interface VillagerPair {
  buildingId: string;
  bonusPct: number;
}

export const VILLAGER_PAIRS: Record<string, VillagerPair> = {
  sprout: { buildingId: "garden", bonusPct: 5 },
  baker: { buildingId: "bakery", bonusPct: 10 },
  scholar: { buildingId: "library", bonusPct: 10 },
  smith: { buildingId: "forge", bonusPct: 12 },
  fox: { buildingId: "starter-house", bonusPct: 12 },
  knight: { buildingId: "tower", bonusPct: 15 },
  owl: { buildingId: "library", bonusPct: 12 },
  bard: { buildingId: "tavern", bonusPct: 12 },
  wizard: { buildingId: "windmill", bonusPct: 20 },
  phoenix: { buildingId: "shrine", bonusPct: 25 },
  elder: { buildingId: "well", bonusPct: 25 },
  dragon: { buildingId: "shrine", bonusPct: 30 },
};

export interface ActivePair {
  villagerId: string;
  buildingId: string;
  bonusPct: number;
}

export const computeActivePairs = (
  unlockedVillagerIds: Iterable<string>,
  purchasedBuildingIds: Set<string>
): ActivePair[] => {
  const out: ActivePair[] = [];
  for (const vid of unlockedVillagerIds) {
    const pair = VILLAGER_PAIRS[vid];
    if (!pair) continue;
    if (purchasedBuildingIds.has(pair.buildingId)) {
      out.push({
        villagerId: vid,
        buildingId: pair.buildingId,
        bonusPct: pair.bonusPct,
      });
    }
  }
  return out;
};

/** 1 + ΣbonusPct/100 — multiplier applied to focus-coin income. */
export const computeFocusMultiplier = (active: ActivePair[]): number => {
  let sum = 0;
  for (const p of active) sum += p.bonusPct;
  return 1 + sum / 100;
};

/** Group active pairs by building so we can display "Smith working here" tags. */
export const pairsByBuilding = (
  active: ActivePair[]
): Map<string, ActivePair[]> => {
  const out = new Map<string, ActivePair[]>();
  for (const p of active) {
    const arr = out.get(p.buildingId) || [];
    arr.push(p);
    out.set(p.buildingId, arr);
  }
  return out;
};
