import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

/**
 * Loads a GLTF structure model and clones it for safe reuse.
 * Drop .glb files at `public/models/structures/<id>.glb`.
 */
export const StructureModel: React.FC<{
  url: string;
  scale?: number;
  yOffset?: number;
}> = ({ url, scale = 1, yOffset = 0 }) => {
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
        // Ensure textures use sRGB color space; some loaders default to linear,
        // which makes the model look washed-out/gray.
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          const mat = m as THREE.MeshStandardMaterial;
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.needsUpdate = true;
          }
          mat.needsUpdate = true;
        }
      }
    });
  }, [cloned]);
  return (
    <primitive
      object={cloned}
      scale={[scale, scale, scale]}
      position={[0, yOffset, 0]}
    />
  );
};
