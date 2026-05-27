import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

/** Lift very-dark linear colors so they read as actual color, not black. */
const brightenDark = (c: THREE.Color): THREE.Color => {
  const max = Math.max(c.r, c.g, c.b);
  if (max < 0.35 && max > 0) {
    const k = 0.55 / max;
    return new THREE.Color(c.r * k, c.g * k, c.b * k);
  }
  return c.clone();
};

/**
 * Quaternius asset packs use a known set of material names (Wood, Stone_*,
 * Fire, Roof, etc). The exported `baseColorFactor` values are unreliable —
 * some are nearly black (Wood = ~0.12 linear) and some are flat gray
 * (Fire = 0.8 gray, no emissive). Force pleasant readable colors per name.
 */
interface NameOverride {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
}
const QUATERNIUS_OVERRIDES: Record<string, NameOverride> = {
  Wood: { color: "#7a4a22" },
  WoodSide: { color: "#9c6c35" },
  WoodDark: { color: "#5a3415" },
  Bark: { color: "#5a3a20" },
  Stone: { color: "#8a8a8a" },
  Stone_Dark: { color: "#5e636a" },
  Stone_Light: { color: "#a8aab0" },
  Roof: { color: "#a23a26" },
  RoofRed: { color: "#a23a26" },
  RoofDark: { color: "#5a2f1f" },
  Door: { color: "#5a3920" },
  Window: { color: "#9ad7ff" },
  Glass: { color: "#9ad7ff" },
  Fire: { color: "#fb923c", emissive: "#f97316", emissiveIntensity: 1.2 },
  Flame: { color: "#fb923c", emissive: "#f97316", emissiveIntensity: 1.2 },
  Lava: { color: "#fb6534", emissive: "#dc2626", emissiveIntensity: 0.9 },
  Water: { color: "#3b82f6" },
  Metal: { color: "#9aa0a8" },
  Gold: { color: "#f6c84c" },
  Leaves: { color: "#3f8f3f" },
  Grass: { color: "#5fae5f" },
  Dirt: { color: "#6b4f2a" },
};

/**
 * Loads a GLTF structure model and clones it for safe reuse.
 *
 * - Enables `vertexColors` on materials that have a COLOR_0 attribute.
 * - Forces baseColor textures to sRGB color space.
 * - Auto-fits the model to `targetFootprint` (XZ diameter) and snaps its
 *   bottom to ground (y=0). The bbox offset is baked into the inner
 *   primitive; an outer <group> applies scale + extra Y, so scaling
 *   correctly preserves the ground-snap.
 *
 * Drop .glb files at `public/models/structures/<id>.glb`.
 */
export const StructureModel: React.FC<{
  url: string;
  scale?: number;
  yOffset?: number;
  targetFootprint?: number;
  /** Evolution stage 1-5. Visual bump only — caller supplies per-level GLB via url if available. */
  level?: number;
  /** Multiplier on top of auto/explicit scale. Used to grow buildings per stage. */
  stageScale?: number;
}> = ({ url, scale, yOffset, targetFootprint, level, stageScale }) => {
  const { scene } = useGLTF(url);
  void level;

  const { object, autoScale } = React.useMemo(() => {
    const cloned = scene.clone(true);

    // Quaternius GLBs ship per-material baseColorFactor with no texture. Under
    // ACESFilmic + no env map, PBR (MeshStandardMaterial) looks washed-out.
    // Swap each material for MeshToonMaterial — stylized banded shading that
    // matches the chunky low-poly look and receives shadows.
    const remapped = new Map<THREE.Material, THREE.Material>();
    const remap = (m: THREE.Material | null | undefined): THREE.Material => {
      if (!m) return m as unknown as THREE.Material;
      const cached = remapped.get(m);
      if (cached) return cached;
      const src = m as THREE.MeshStandardMaterial;
      if (src.map) {
        src.map.colorSpace = THREE.SRGBColorSpace;
        src.map.needsUpdate = true;
      }
      const override = src.name ? QUATERNIUS_OVERRIDES[src.name] : undefined;
      const baseColor = override
        ? new THREE.Color(override.color)
        : src.color
          ? brightenDark(src.color)
          : new THREE.Color(0xffffff);
      const lambert = new THREE.MeshLambertMaterial({
        map: src.map ?? null,
        color: baseColor,
        vertexColors: !!src.vertexColors,
        transparent: src.transparent,
        opacity: src.opacity,
        side: src.side,
      });
      if (override?.emissive) {
        lambert.emissive = new THREE.Color(override.emissive);
        lambert.emissiveIntensity = override.emissiveIntensity ?? 1;
      }
      remapped.set(m, lambert);
      return lambert;
    };

    cloned.traverse((obj) => {
      const mesh = obj as unknown as {
        isMesh?: boolean;
        castShadow?: boolean;
        receiveShadow?: boolean;
        material?: THREE.Material | THREE.Material[];
        geometry?: THREE.BufferGeometry;
      };
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const hasColorAttr = !!mesh.geometry?.getAttribute?.("color");
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => {
          const out = remap(m);
          if (hasColorAttr) (out as THREE.MeshLambertMaterial).vertexColors = true;
          return out;
        });
      } else {
        const out = remap(mesh.material);
        if (hasColorAttr) (out as THREE.MeshLambertMaterial).vertexColors = true;
        mesh.material = out;
      }
    });

    // Bbox in cloned local space.
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Bake offset into cloned: center XZ on origin, bottom on y=0.
    cloned.position.set(-center.x, -box.min.y, -center.z);

    const footprint = Math.max(size.x, size.z) || 1;
    const auto = targetFootprint ? targetFootprint / footprint : 1;

    return { object: cloned, autoScale: auto };
  }, [scene, targetFootprint]);

  const finalScale = (scale ?? autoScale) * (stageScale ?? 1);
  const finalY = yOffset ?? 0;

  // Outer group applies scale + extra Y so cloned.position offset is preserved.
  return (
    <group scale={[finalScale, finalScale, finalScale]} position={[0, finalY, 0]}>
      <primitive object={object} />
    </group>
  );
};
