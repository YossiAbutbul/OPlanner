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
  /** Coin cost to purchase and place. */
  cost: number;
  position: [number, number];
  rotation?: number;
  color: string;
  modelUrl?: string;
  modelFootprint?: number;
  modelScale?: number;
  modelYOffset?: number;
}

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

// City block layout: 3 rows × 5 columns = 15 buildings.
// Row 1 (back, z=-22) = skyscrapers / tall.
// Row 2 (mid, z=-10) = mid-rise commercial.
// Row 3 (front, z=2) = small commercial + industrial props.
// Camera at z=+26 looks north → rows are stacked back→front visibly.
const ROW_BACK_Z = -22;
const ROW_MID_Z = -10;
const ROW_FRONT_Z = 2;
const COL_X = [-16, -8, 0, 8, 16] as const;

const faceCam = (p: [number, number]): number => faceTowards(p, CENTER);

export const STRUCTURES: StructureDef[] = [
  // ── Back row (tallest skyscrapers) ────────────────────────────────────
  {
    id: "tower-a",
    name: "Skyscraper A",
    kind: "tower",
    unlock: { kind: "streak", days: 3 },
    cost: 1500,
    position: [COL_X[0], ROW_BACK_Z],
    rotation: faceCam([COL_X[0], ROW_BACK_Z]),
    color: "#0ea5e9",
    modelUrl: COMM("building-skyscraper-a"),
    modelFootprint: 3.8,
  },
  {
    id: "tower-b",
    name: "Skyscraper B",
    kind: "tower",
    unlock: { kind: "streak", days: 7 },
    cost: 1800,
    position: [COL_X[1], ROW_BACK_Z],
    rotation: faceCam([COL_X[1], ROW_BACK_Z]),
    color: "#3b82f6",
    modelUrl: COMM("building-skyscraper-b"),
    modelFootprint: 3.8,
  },
  {
    id: "tower-c",
    name: "Skyscraper C",
    kind: "tower",
    unlock: { kind: "totalHours", hours: 25 },
    cost: 2200,
    position: [COL_X[2], ROW_BACK_Z],
    rotation: faceCam([COL_X[2], ROW_BACK_Z]),
    color: "#1d4ed8",
    modelUrl: COMM("building-skyscraper-c"),
    modelFootprint: 4.0,
  },
  {
    id: "tower-d",
    name: "Skyscraper D",
    kind: "tower",
    unlock: { kind: "totalHours", hours: 40 },
    cost: 2600,
    position: [COL_X[3], ROW_BACK_Z],
    rotation: faceCam([COL_X[3], ROW_BACK_Z]),
    color: "#0369a1",
    modelUrl: COMM("building-skyscraper-d"),
    modelFootprint: 3.8,
  },
  {
    id: "tower-e",
    name: "Skyscraper E",
    kind: "tower",
    unlock: { kind: "totalHours", hours: 50 },
    cost: 3000,
    position: [COL_X[4], ROW_BACK_Z],
    rotation: faceCam([COL_X[4], ROW_BACK_Z]),
    color: "#075985",
    modelUrl: COMM("building-skyscraper-e"),
    modelFootprint: 3.8,
  },

  // ── Mid row (medium offices / apartments) ─────────────────────────────
  {
    id: "office-a",
    name: "Apartments",
    kind: "house",
    unlock: { kind: "focusCount", count: 1 },
    cost: 200,
    position: [COL_X[0], ROW_MID_Z],
    rotation: faceCam([COL_X[0], ROW_MID_Z]),
    color: "#dc2626",
    modelUrl: COMM("building-a"),
    modelFootprint: 3.2,
  },
  {
    id: "office-b",
    name: "Office Block",
    kind: "bakery",
    unlock: { kind: "focusCount", count: 5 },
    cost: 350,
    position: [COL_X[1], ROW_MID_Z],
    rotation: faceCam([COL_X[1], ROW_MID_Z]),
    color: "#f59e0b",
    modelUrl: COMM("building-b"),
    modelFootprint: 3.2,
  },
  {
    id: "office-c",
    name: "Bank",
    kind: "library",
    unlock: { kind: "totalHours", hours: 5 },
    cost: 500,
    position: [COL_X[2], ROW_MID_Z],
    rotation: faceCam([COL_X[2], ROW_MID_Z]),
    color: "#7c3aed",
    modelUrl: COMM("building-d"),
    modelFootprint: 3.2,
  },
  {
    id: "office-d",
    name: "Hotel",
    kind: "tavern",
    unlock: { kind: "totalHours", hours: 10 },
    cost: 650,
    position: [COL_X[3], ROW_MID_Z],
    rotation: faceCam([COL_X[3], ROW_MID_Z]),
    color: "#b45309",
    modelUrl: COMM("building-e"),
    modelFootprint: 3.2,
  },
  {
    id: "office-e",
    name: "Mall",
    kind: "bakery",
    unlock: { kind: "focusCount", count: 15 },
    cost: 800,
    position: [COL_X[4], ROW_MID_Z],
    rotation: faceCam([COL_X[4], ROW_MID_Z]),
    color: "#be185d",
    modelUrl: COMM("building-l"),
    modelFootprint: 4.0,
  },

  // ── Front row (small commercial + industrial) ─────────────────────────
  {
    id: "shop-a",
    name: "Shop",
    kind: "bakery",
    unlock: { kind: "focusCount", count: 3 },
    cost: 80,
    position: [COL_X[0], ROW_FRONT_Z],
    rotation: faceCam([COL_X[0], ROW_FRONT_Z]),
    color: "#10b981",
    modelUrl: COMM("low-detail-building-a"),
    modelFootprint: 2.5,
  },
  {
    id: "shop-b",
    name: "Café",
    kind: "garden",
    unlock: { kind: "focusCount", count: 10 },
    cost: 120,
    position: [COL_X[1], ROW_FRONT_Z],
    rotation: faceCam([COL_X[1], ROW_FRONT_Z]),
    color: "#059669",
    modelUrl: COMM("low-detail-building-b"),
    modelFootprint: 2.5,
  },
  {
    id: "shop-c",
    name: "Kiosk",
    kind: "well",
    unlock: { kind: "focusCount", count: 3 },
    cost: 60,
    position: [COL_X[2], ROW_FRONT_Z],
    rotation: faceCam([COL_X[2], ROW_FRONT_Z]),
    color: "#475569",
    modelUrl: COMM("low-detail-building-c"),
    modelFootprint: 2.5,
  },
  {
    id: "industrial-a",
    name: "Workshop",
    kind: "forge",
    unlock: { kind: "dailyGoalHits", days: 5 },
    cost: 250,
    position: [COL_X[3], ROW_FRONT_Z],
    rotation: faceCam([COL_X[3], ROW_FRONT_Z]),
    color: "#7f1d1d",
    modelUrl: IND("building-a"),
    modelFootprint: 2.8,
  },
  {
    id: "industrial-b",
    name: "Factory",
    kind: "forge",
    unlock: { kind: "focusCount", count: 25 },
    cost: 700,
    position: [COL_X[4], ROW_FRONT_Z],
    rotation: faceCam([COL_X[4], ROW_FRONT_Z]),
    color: "#fb923c",
    modelUrl: IND("building-c"),
    modelFootprint: 2.8,
  },
];
