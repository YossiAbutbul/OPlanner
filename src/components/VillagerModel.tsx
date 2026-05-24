import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

/**
 * Loads a GLTF villager model from a public URL.
 * Drop .glb files into `public/models/villagers/<id>.glb`.
 */
export const VillagerModel: React.FC<{
  url: string;
  color?: string;
  scale?: number;
}> = ({ url, color, scale = 1 }) => {
  const { scene } = useGLTF(url);
  const cloned = React.useMemo(() => scene.clone(true), [scene]);
  React.useEffect(() => {
    cloned.traverse((obj) => {
      const mesh = obj as unknown as {
        isMesh?: boolean;
        castShadow?: boolean;
        receiveShadow?: boolean;
        material?: THREE.Material | THREE.Material[];
      };
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          const mat = m as THREE.MeshStandardMaterial;
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.needsUpdate = true;
          }
          if (color && mat.name?.toLowerCase().startsWith("tint")) {
            mat.color?.set(color);
          }
          mat.needsUpdate = true;
        }
      }
    });
  }, [cloned, color]);
  return <primitive object={cloned} scale={[scale, scale, scale]} />;
};
