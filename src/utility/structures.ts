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

/** Visual scale boost per level when a per-level model isn't supplied. Index = level. */
const STAGE_SCALE_BUMP: readonly number[] = [1, 1, 1.12, 1.25, 1.4, 1.6];

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

const MODEL = (id: string) =>
  `${import.meta.env.BASE_URL}models/structures/${id}.glb`;

/** Per-stage GLB path. `kit` is the Kenney subdir (each pack has its own Textures/colormap.png). */
const STAGE = (kit: "td" | "town", id: string, lvl: number) =>
  `${import.meta.env.BASE_URL}models/structures/stages/${kit}/${id}-L${lvl}.glb`;

/** Commercial kit asset (full city buildings). */
const COMM = (file: string) =>
  `${import.meta.env.BASE_URL}models/structures/stages/commercial/${file}.glb`;

/** Rotation so building's +z (front) faces a target point. */
const faceTowards = (
  pos: [number, number],
  target: [number, number]
): number => Math.atan2(target[0] - pos[0], target[1] - pos[1]);

const CENTER: [number, number] = [0, 0];

// Horseshoe layout opening south (toward default camera at z=+26).
// Buildings ring around a central plaza, leaving the south side open so the
// camera looking north can see all 10 at once.
export const STRUCTURES: StructureDef[] = [
  // Back center — tallest landmark, anchors the far side.
  {
    id: "tower",
    name: "Bell Tower",
    kind: "tower",
    unlock: { kind: "streak", days: 3 },
    cost: 350,
    position: [0, -12],
    rotation: faceTowards([0, -12], CENTER),
    color: "#0ea5e9",
    modelUrl: STAGE("td", "tower", 1),
    modelByLevel: {
      1: STAGE("td", "tower", 1),
      2: STAGE("td", "tower", 3),
      3: STAGE("td", "tower", 5),
      4: COMM("building-skyscraper-c"),
      5: COMM("building-skyscraper-d"),
    },
    namesByLevel: {
      1: "Watchtower",
      2: "Bell Tower",
      3: "Stone Spire",
      4: "Clock Tower",
      5: "Skyscraper",
    },
    modelFootprint: 4.0,
  },
  // Back-left cluster.
  {
    id: "windmill",
    name: "Mill",
    kind: "windmill",
    unlock: { kind: "focusCount", count: 25 },
    cost: 600,
    position: [-8, -11],
    rotation: faceTowards([-8, -11], CENTER),
    color: "#fef3c7",
    modelUrl: MODEL("windmill"),
    modelByLevel: {
      1: MODEL("windmill"),
      2: STAGE("town", "windmill", 2),
      3: STAGE("town", "windmill", 3),
    },
    maxLevel: 3,
    modelFootprint: 5.0,
  },
  // Back-right cluster.
  {
    id: "tavern",
    name: "The Inn",
    kind: "tavern",
    unlock: { kind: "totalHours", hours: 10 },
    cost: 500,
    position: [9, -10],
    rotation: faceTowards([9, -10], CENTER),
    color: "#b45309",
    modelUrl: STAGE("td", "starter-house", 2),
    modelByLevel: {
      1: STAGE("td", "starter-house", 2),
      2: STAGE("td", "starter-house", 4),
      3: COMM("low-detail-building-e"),
      4: COMM("building-e"),
      5: COMM("building-m"),
    },
    namesByLevel: {
      1: "Inn",
      2: "Tavern",
      3: "Hotel",
      4: "Grand Hotel",
      5: "Resort Tower",
    },
    modelFootprint: 6.0,
  },
  // Left flank.
  {
    id: "forge",
    name: "Blacksmith",
    kind: "forge",
    unlock: { kind: "dailyGoalHits", days: 5 },
    cost: 400,
    position: [-13, -3],
    rotation: faceTowards([-13, -3], CENTER),
    color: "#7f1d1d",
    modelUrl: STAGE("td", "forge", 1),
    modelByLevel: {
      1: STAGE("td", "forge", 1),
      2: STAGE("td", "forge", 3),
      3: STAGE("td", "forge", 5),
      4: COMM("building-c"),
      5: COMM("building-skyscraper-e"),
    },
    namesByLevel: {
      1: "Forge",
      2: "Smithy",
      3: "Workshop",
      4: "Factory",
      5: "Industrial Tower",
    },
    modelFootprint: 5.5,
  },
  {
    id: "starter-house",
    name: "Cottage",
    kind: "house",
    unlock: { kind: "focusCount", count: 1 },
    cost: 50,
    position: [-12, 5],
    rotation: faceTowards([-12, 5], CENTER),
    color: "#dc2626",
    modelUrl: STAGE("td", "starter-house", 1),
    modelByLevel: {
      1: STAGE("td", "starter-house", 1),
      2: STAGE("td", "starter-house", 2),
      3: COMM("low-detail-building-a"),
      4: COMM("building-a"),
      5: COMM("building-skyscraper-a"),
    },
    namesByLevel: {
      1: "Cottage",
      2: "House",
      3: "Apartment",
      4: "Condo",
      5: "Skyscraper",
    },
    modelFootprint: 4.0,
  },
  // Right flank.
  {
    id: "library",
    name: "Old House",
    kind: "library",
    unlock: { kind: "totalHours", hours: 5 },
    cost: 250,
    position: [13, -3],
    rotation: faceTowards([13, -3], CENTER),
    color: "#7c3aed",
    modelUrl: MODEL("library"),
    modelByLevel: {
      1: MODEL("library"),
      2: STAGE("td", "starter-house", 4),
      3: COMM("low-detail-building-d"),
      4: COMM("building-d"),
      5: COMM("building-l"),
    },
    namesByLevel: {
      1: "Old House",
      2: "Reading Room",
      3: "Library",
      4: "Archive",
      5: "Knowledge Tower",
    },
    modelFootprint: 4.5,
  },
  {
    id: "bakery",
    name: "Townhouse",
    kind: "bakery",
    unlock: { kind: "focusCount", count: 5 },
    cost: 150,
    position: [12, 5],
    rotation: faceTowards([12, 5], CENTER),
    color: "#f59e0b",
    modelUrl: MODEL("bakery"),
    modelByLevel: {
      1: MODEL("bakery"),
      2: STAGE("td", "starter-house", 3),
      3: COMM("low-detail-building-b"),
      4: COMM("building-b"),
      5: COMM("building-skyscraper-b"),
    },
    namesByLevel: {
      1: "Townhouse",
      2: "Brick House",
      3: "Café",
      4: "Restaurant",
      5: "Office Tower",
    },
    modelFootprint: 4.0,
  },
  // Open south side — small props near the camera.
  {
    id: "well",
    name: "Village Well",
    kind: "well",
    unlock: { kind: "focusCount", count: 3 },
    cost: 100,
    position: [0, 0],
    color: "#475569",
    modelUrl: MODEL("well"),
    modelFootprint: 2.5,
    maxLevel: 3,
  },
  {
    id: "garden",
    name: "Gazebo",
    kind: "garden",
    unlock: { kind: "focusCount", count: 10 },
    cost: 200,
    position: [-5, 8],
    rotation: faceTowards([-5, 8], CENTER),
    color: "#10b981",
    modelUrl: MODEL("garden"),
    modelFootprint: 3.0,
    maxLevel: 3,
  },
  {
    id: "shrine",
    name: "Bonfire",
    kind: "shrine",
    unlock: { kind: "streak", days: 7 },
    cost: 300,
    position: [5, 8],
    rotation: faceTowards([5, 8], CENTER),
    color: "#fb923c",
    modelUrl: MODEL("shrine"),
    modelFootprint: 2.2,
    maxLevel: 3,
  },
];
