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
}

/** Max evolution stage. Level 0 = not built, 1 = base, up to MAX_LEVEL fully evolved. */
export const MAX_LEVEL = 5;

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
  if (toLevel < 1 || toLevel > MAX_LEVEL) return null;
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
    modelUrl: MODEL("tower"),
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
    modelUrl: MODEL("tavern"),
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
    modelUrl: MODEL("forge"),
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
    modelUrl: MODEL("starter-house"),
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
  },
];
