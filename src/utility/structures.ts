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
  unlock: UnlockMetric;
  /** Fixed plot in world coords. */
  position: [number, number];
  /** Y-axis rotation in radians. */
  rotation?: number;
  /** Primary palette color (roof / accent). */
  color: string;
  /**
   * Optional GLTF model URL. If set, renders 3D model in place of procedural.
   * Default convention: drop file at `public/models/structures/<id>.glb`
   * and set `modelUrl: "/models/structures/<id>.glb"`.
   */
  modelUrl?: string;
  /** Optional uniform scale to fit GLB (default 1). */
  modelScale?: number;
  /** Optional Y offset to seat GLB on ground (default 0). */
  modelYOffset?: number;
}

// Plots arranged around the central square in a loose ring.
export const STRUCTURES: StructureDef[] = [
  {
    id: "starter-house",
    name: "Starter Cottage",
    kind: "house",
    unlock: { kind: "focusCount", count: 1 },
    position: [-4, -4],
    rotation: Math.PI / 6,
    color: "#dc2626",
    modelUrl: `${import.meta.env.BASE_URL}models/structures/starter-house.glb`,
    modelScale: 0.5,
  },
  {
    id: "well",
    name: "Village Well",
    kind: "well",
    unlock: { kind: "focusCount", count: 3 },
    position: [0, 0],
    color: "#475569",
    modelUrl: `${import.meta.env.BASE_URL}models/structures/well.glb`,
    modelScale: 1.3,
  },
  {
    id: "bakery",
    name: "Pippa's Bakery",
    kind: "bakery",
    unlock: { kind: "focusCount", count: 5 },
    position: [5, -3],
    rotation: -Math.PI / 8,
    color: "#f59e0b",
    modelUrl: `${import.meta.env.BASE_URL}models/structures/bakery.glb`,
    modelScale: 0.5,
  },
  {
    id: "library",
    name: "Old Library",
    kind: "library",
    unlock: { kind: "totalHours", hours: 5 },
    position: [-7, 2],
    rotation: Math.PI / 4,
    color: "#7c3aed",
    modelUrl: `${import.meta.env.BASE_URL}models/structures/library.glb`,
    modelScale: 0.5,
  },
  {
    id: "tower",
    name: "Watchtower",
    kind: "tower",
    unlock: { kind: "streak", days: 3 },
    position: [7, 4],
    color: "#0ea5e9",
    modelUrl: `${import.meta.env.BASE_URL}models/structures/tower.glb`,
    modelScale: 1.4,
  },
  {
    id: "garden",
    name: "Herb Garden",
    kind: "garden",
    unlock: { kind: "focusCount", count: 10 },
    position: [3, 6],
    color: "#10b981",
    modelUrl: `${import.meta.env.BASE_URL}models/structures/garden.glb`,
    modelScale: 1.4,
  },
  {
    id: "forge",
    name: "Forge",
    kind: "forge",
    unlock: { kind: "dailyGoalHits", days: 5 },
    position: [-6, -7],
    rotation: -Math.PI / 5,
    color: "#7f1d1d",
    modelUrl: `${import.meta.env.BASE_URL}models/structures/forge.glb`,
    modelScale: 0.5,
  },
  {
    id: "tavern",
    name: "Tavern",
    kind: "tavern",
    unlock: { kind: "totalHours", hours: 10 },
    position: [8, -6],
    rotation: Math.PI / 7,
    color: "#b45309",
    modelUrl: `${import.meta.env.BASE_URL}models/structures/tavern.glb`,
    modelScale: 0.5,
  },
  {
    id: "shrine",
    name: "Moonlit Shrine",
    kind: "shrine",
    unlock: { kind: "streak", days: 7 },
    position: [-9, 7],
    color: "#e0e7ff",
    modelUrl: `${import.meta.env.BASE_URL}models/structures/shrine.glb`,
    modelScale: 1.3,
  },
  {
    id: "windmill",
    name: "Windmill",
    kind: "windmill",
    unlock: { kind: "focusCount", count: 25 },
    position: [10, 0],
    color: "#fef3c7",
    modelUrl: `${import.meta.env.BASE_URL}models/structures/windmill.glb`,
    modelScale: 1.5,
  },
];
