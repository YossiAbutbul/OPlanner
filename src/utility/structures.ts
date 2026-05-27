import { UnlockMetric } from "./village";

export type StructureKind =
  | "house"
  | "bakery"
  | "tower"
  | "well"
  | "library"
  | "forge"
  | "tavern"
  | "windmill"
  | "shrine"
  | "garden";

export interface StructureDef {
  id: string;
  name: string;
  kind: StructureKind;
  /** Legacy unlock condition — kept for reference but no longer gates placement. */
  unlock: UnlockMetric;
  /** Coin cost to purchase and place (= cost to reach level 1). Higher stages multiply this. */
  cost: number;
  position: [number, number];
  rotation?: number;
  color: string;
  modelUrl?: string;
  modelFootprint?: number;
  modelScale?: number;
  modelYOffset?: number;
  /** Per-level model overrides. Falls back to modelUrl with auto-scale when missing. */
  modelByLevel?: Record<number, string>;
  /** Per-level display name override (e.g. Cottage → Skyscraper). Falls back to .name. */
  namesByLevel?: Record<number, string>;
  /** Max evolution stage for this building. Defaults to MAX_LEVEL (5). */
  maxLevel?: number;
}

/** Display name for a building at a given level. Falls back to base name. */
export const getName = (s: StructureDef, level: number): string =>
  s.namesByLevel?.[level] ?? s.name;

/** Default cap on evolution stages. Buildings may override via StructureDef.maxLevel. */
export const MAX_LEVEL = 5;

/** Effective max level for a specific building (clamped to MAX_LEVEL). */
export const maxLevelOf = (s: StructureDef): number =>
  Math.min(MAX_LEVEL, Math.max(1, s.maxLevel ?? MAX_LEVEL));

/** Cost multiplier vs base structure.cost per stage. Index = level. */
const STAGE_COST_MULT: readonly number[] = [0, 1, 2.5, 6, 15, 35];

/** Visual scale per level — smaller at low stages, larger at high stages. Index = level. */
const STAGE_SCALE_BUMP: readonly number[] = [0.7, 0.7, 0.85, 1.0, 1.2, 1.45];

/** Milestone gating each stage. Index = level. Null = no gate (cost only). */
const STAGE_MILESTONE: readonly (UnlockMetric | null)[] = [
  null,
  null,
  { kind: "totalHours", hours: 5 },
  { kind: "focusCount", count: 20 },
  { kind: "streak", days: 7 },
  { kind: "totalHours", hours: 50 },
];

export interface UpgradeStage {
  /** Coin cost to reach this stage from the previous one. */
  cost: number;
  /** Extra requirement on top of coins. Null = coins-only. */
  milestone: UnlockMetric | null;
}

/** Stage info for a building going to `toLevel`. Returns null for invalid levels. */
export const getUpgrade = (
  s: StructureDef,
  toLevel: number
): UpgradeStage | null => {
  if (toLevel < 1 || toLevel > maxLevelOf(s)) return null;
  return {
    cost: Math.round(s.cost * STAGE_COST_MULT[toLevel]),
    milestone: STAGE_MILESTONE[toLevel],
  };
};

/** Visual scale multiplier to apply at a given level (used when no per-level GLB). */
export const getStageScale = (level: number): number =>
  STAGE_SCALE_BUMP[Math.max(0, Math.min(MAX_LEVEL, level))] ?? 1;

/** Commercial kit asset (full city buildings). */
const COMM = (file: string) =>
  `${import.meta.env.BASE_URL}models/structures/stages/commercial/${file}.glb`;

/** Industrial kit asset (factories, warehouses, chimneys). */
const IND = (file: string) =>
  `${import.meta.env.BASE_URL}models/structures/stages/industrial/${file}.glb`;

/** Rotation so building's +z (front) faces a target point. */
const faceTowards = (
  pos: [number, number],
  target: [number, number]
): number => Math.atan2(target[0] - pos[0], target[1] - pos[1]);

const CENTER: [number, number] = [0, 0];

// City block layout: 2 rows of 5 buildings, all facing the camera at z=+26.
// Back row z=-14 (skyline), front row z=-3 (storefront). Ids preserved for
// save-data compat — names + models are city now, not village.
const BACK_Z = -14;
const FRONT_Z = -3;
const COL_X = [-16, -8, 0, 8, 16] as const;

export const STRUCTURES: StructureDef[] = [
  // ─── Back row — taller buildings, the skyline ─────────────────────────────
  {
    id: "tower",
    name: "High Rise",
    kind: "tower",
    unlock: { kind: "streak", days: 3 },
    cost: 350,
    position: [COL_X[2], BACK_Z],
    rotation: faceTowards([COL_X[2], BACK_Z], CENTER),
    color: "#0ea5e9",
    modelUrl: COMM("low-detail-building-c"),
    modelByLevel: {
      1: COMM("low-detail-building-c"),
      2: COMM("building-c"),
      3: COMM("building-i"),
      4: COMM("building-skyscraper-c"),
      5: COMM("building-skyscraper-d"),
    },
    modelFootprint: 4.5,
  },
  {
    id: "starter-house",
    name: "Apartments",
    kind: "house",
    unlock: { kind: "focusCount", count: 1 },
    cost: 50,
    position: [COL_X[0], BACK_Z],
    rotation: faceTowards([COL_X[0], BACK_Z], CENTER),
    color: "#dc2626",
    modelUrl: COMM("low-detail-building-a"),
    modelByLevel: {
      1: COMM("low-detail-building-a"),
      2: COMM("building-a"),
      3: COMM("building-h"),
      4: COMM("building-skyscraper-a"),
      5: COMM("building-j"),
    },
    modelFootprint: 4.5,
  },
  {
    id: "bakery",
    name: "Office",
    kind: "bakery",
    unlock: { kind: "focusCount", count: 5 },
    cost: 150,
    position: [COL_X[1], BACK_Z],
    rotation: faceTowards([COL_X[1], BACK_Z], CENTER),
    color: "#f59e0b",
    modelUrl: COMM("low-detail-building-b"),
    modelByLevel: {
      1: COMM("low-detail-building-b"),
      2: COMM("building-b"),
      3: COMM("building-g"),
      4: COMM("building-skyscraper-b"),
      5: COMM("building-n"),
    },
    modelFootprint: 4.5,
  },
  {
    id: "library",
    name: "Bank",
    kind: "library",
    unlock: { kind: "totalHours", hours: 5 },
    cost: 250,
    position: [COL_X[3], BACK_Z],
    rotation: faceTowards([COL_X[3], BACK_Z], CENTER),
    color: "#7c3aed",
    modelUrl: COMM("low-detail-building-d"),
    modelByLevel: {
      1: COMM("low-detail-building-d"),
      2: COMM("building-d"),
      3: COMM("building-l"),
      4: COMM("building-m"),
      5: COMM("building-skyscraper-c"),
    },
    modelFootprint: 4.5,
  },
  {
    id: "tavern",
    name: "Hotel",
    kind: "tavern",
    unlock: { kind: "totalHours", hours: 10 },
    cost: 500,
    position: [COL_X[4], BACK_Z],
    rotation: faceTowards([COL_X[4], BACK_Z], CENTER),
    color: "#b45309",
    modelUrl: COMM("low-detail-building-e"),
    modelByLevel: {
      1: COMM("low-detail-building-e"),
      2: COMM("building-e"),
      3: COMM("building-f"),
      4: COMM("building-skyscraper-e"),
      5: COMM("building-k"),
    },
    modelFootprint: 4.5,
  },
  // ─── Front row — smaller commercial buildings ────────────────────────────
  {
    id: "forge",
    name: "Workshop",
    kind: "forge",
    unlock: { kind: "dailyGoalHits", days: 5 },
    cost: 400,
    position: [COL_X[0], FRONT_Z],
    rotation: faceTowards([COL_X[0], FRONT_Z], CENTER),
    color: "#7f1d1d",
    modelUrl: IND("building-a"),
    modelByLevel: {
      1: IND("building-a"),
      2: IND("building-c"),
      3: IND("building-g"),
      4: IND("building-j"),
      5: IND("building-l"),
    },
    modelFootprint: 4.5,
  },
  {
    id: "windmill",
    name: "Warehouse",
    kind: "windmill",
    unlock: { kind: "focusCount", count: 25 },
    cost: 600,
    position: [COL_X[1], FRONT_Z],
    rotation: faceTowards([COL_X[1], FRONT_Z], CENTER),
    color: "#94a3b8",
    modelUrl: IND("building-e"),
    modelByLevel: {
      1: IND("building-e"),
      2: IND("building-n"),
      3: IND("building-p"),
    },
    maxLevel: 3,
    modelFootprint: 4.5,
  },
  {
    id: "well",
    name: "Kiosk",
    kind: "well",
    unlock: { kind: "focusCount", count: 3 },
    cost: 100,
    position: [COL_X[2], FRONT_Z],
    rotation: faceTowards([COL_X[2], FRONT_Z], CENTER),
    color: "#475569",
    modelUrl: COMM("low-detail-building-h"),
    modelByLevel: {
      1: COMM("low-detail-building-h"),
      2: COMM("low-detail-building-i"),
      3: COMM("building-h"),
    },
    maxLevel: 3,
    modelFootprint: 3.5,
  },
  {
    id: "garden",
    name: "Café",
    kind: "garden",
    unlock: { kind: "focusCount", count: 10 },
    cost: 200,
    position: [COL_X[3], FRONT_Z],
    rotation: faceTowards([COL_X[3], FRONT_Z], CENTER),
    color: "#10b981",
    modelUrl: COMM("low-detail-building-j"),
    modelByLevel: {
      1: COMM("low-detail-building-j"),
      2: COMM("low-detail-building-k"),
      3: COMM("building-f"),
    },
    maxLevel: 3,
    modelFootprint: 4.0,
  },
  {
    id: "shrine",
    name: "Factory",
    kind: "shrine",
    unlock: { kind: "streak", days: 7 },
    cost: 300,
    position: [COL_X[4], FRONT_Z],
    rotation: faceTowards([COL_X[4], FRONT_Z], CENTER),
    color: "#fb923c",
    modelUrl: IND("building-q"),
    modelByLevel: {
      1: IND("building-q"),
      2: IND("building-s"),
      3: IND("building-t"),
      4: IND("building-l"),
    },
    maxLevel: 4,
    modelFootprint: 4.5,
  },
];
