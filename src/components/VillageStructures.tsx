import React, { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { StructureDef } from "../utility/structures";
import { StructureModel } from "./StructureModel";
import { ModelErrorBoundary } from "./ModelErrorBoundary";

const WALL_COLOR = "#f3e9d2";
const DARK_WOOD = "#5b3a1d";
const STONE = "#8a8a8a";

const House: React.FC<{ color: string }> = ({ color }) => (
  <group>
    {/* Walls */}
    <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.6, 1.2, 1.4]} />
      <meshStandardMaterial color={WALL_COLOR} />
    </mesh>
    {/* Door */}
    <mesh position={[0, 0.4, 0.71]} castShadow>
      <boxGeometry args={[0.3, 0.7, 0.04]} />
      <meshStandardMaterial color={DARK_WOOD} />
    </mesh>
    {/* Window */}
    <mesh position={[0.55, 0.75, 0.72]} castShadow>
      <boxGeometry args={[0.25, 0.25, 0.04]} />
      <meshStandardMaterial color="#9ad7ff" emissive="#3b82f6" emissiveIntensity={0.15} />
    </mesh>
    {/* Roof */}
    <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[1.25, 0.8, 4]} />
      <meshStandardMaterial color={color} />
    </mesh>
  </group>
);

const Bakery: React.FC<{ color: string }> = ({ color }) => (
  <group>
    <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
      <boxGeometry args={[2.0, 1.4, 1.5]} />
      <meshStandardMaterial color="#fde7c5" />
    </mesh>
    <mesh position={[0, 1.7, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[1.55, 0.9, 4]} />
      <meshStandardMaterial color={color} />
    </mesh>
    {/* Chimney */}
    <mesh position={[0.6, 2.1, 0]} castShadow>
      <boxGeometry args={[0.25, 0.7, 0.25]} />
      <meshStandardMaterial color={STONE} />
    </mesh>
    {/* Sign */}
    <mesh position={[0, 1.05, 0.78]} castShadow>
      <boxGeometry args={[0.7, 0.25, 0.04]} />
      <meshStandardMaterial color="#92400e" />
    </mesh>
  </group>
);

const Tower: React.FC<{ color: string }> = ({ color }) => (
  <group>
    <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.55, 0.7, 3.2, 16]} />
      <meshStandardMaterial color={STONE} />
    </mesh>
    <mesh position={[0, 3.5, 0]} castShadow>
      <coneGeometry args={[0.7, 0.9, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
    <mesh position={[0, 3.0, 0.45]} castShadow>
      <boxGeometry args={[0.25, 0.35, 0.1]} />
      <meshStandardMaterial color="#1e293b" />
    </mesh>
  </group>
);

const Well: React.FC<{ color: string }> = ({ color }) => (
  <group>
    <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.55, 0.55, 0.6, 16]} />
      <meshStandardMaterial color={STONE} />
    </mesh>
    <mesh position={[0, 0.6, 0]} castShadow>
      <cylinderGeometry args={[0.45, 0.45, 0.06, 16]} />
      <meshStandardMaterial color="#1e3a8a" />
    </mesh>
    {/* Posts */}
    <mesh position={[-0.5, 0.95, 0]} castShadow>
      <boxGeometry args={[0.08, 1.1, 0.08]} />
      <meshStandardMaterial color={DARK_WOOD} />
    </mesh>
    <mesh position={[0.5, 0.95, 0]} castShadow>
      <boxGeometry args={[0.08, 1.1, 0.08]} />
      <meshStandardMaterial color={DARK_WOOD} />
    </mesh>
    {/* Mini roof */}
    <mesh position={[0, 1.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[0.65, 0.4, 4]} />
      <meshStandardMaterial color={color} />
    </mesh>
  </group>
);

const Library: React.FC<{ color: string }> = ({ color }) => (
  <group>
    <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
      <boxGeometry args={[2.4, 1.6, 1.8]} />
      <meshStandardMaterial color="#e5d3b3" />
    </mesh>
    <mesh position={[0, 1.85, 0]} castShadow>
      <boxGeometry args={[2.5, 0.15, 1.9]} />
      <meshStandardMaterial color={color} />
    </mesh>
    {/* Columns */}
    {[-0.9, -0.3, 0.3, 0.9].map((x) => (
      <mesh key={x} position={[x, 0.8, 0.91]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1.6, 8]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
    ))}
  </group>
);

const Forge: React.FC<{ color: string }> = ({ color }) => (
  <group>
    <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.6, 1.1, 1.4]} />
      <meshStandardMaterial color="#4b2e1f" />
    </mesh>
    <mesh position={[0, 1.3, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[1.25, 0.7, 4]} />
      <meshStandardMaterial color={color} />
    </mesh>
    {/* Glowing forge mouth */}
    <mesh position={[0, 0.45, 0.71]}>
      <boxGeometry args={[0.5, 0.45, 0.05]} />
      <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={1.4} />
    </mesh>
    <pointLight position={[0, 0.45, 1.2]} intensity={0.6} color="#f97316" distance={4} />
  </group>
);

const Tavern: React.FC<{ color: string }> = ({ color }) => (
  <group>
    <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
      <boxGeometry args={[2.4, 1.6, 1.6]} />
      <meshStandardMaterial color="#d6a467" />
    </mesh>
    <mesh position={[0, 1.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[1.85, 0.9, 4]} />
      <meshStandardMaterial color={color} />
    </mesh>
    {/* Sign post */}
    <mesh position={[1.3, 0.9, 0]} castShadow>
      <boxGeometry args={[0.06, 1.4, 0.06]} />
      <meshStandardMaterial color={DARK_WOOD} />
    </mesh>
    <mesh position={[1.3, 1.4, 0]} castShadow>
      <boxGeometry args={[0.5, 0.3, 0.06]} />
      <meshStandardMaterial color="#92400e" />
    </mesh>
  </group>
);

const Windmill: React.FC<{ color: string }> = ({ color }) => {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * 0.6;
  });
  return (
    <group>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.85, 2.8, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 3.0, 0]} castShadow>
        <coneGeometry args={[0.8, 0.7, 12]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
      <group ref={blades} position={[0, 2.4, 0.65]}>
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) => (
          <mesh key={a} rotation={[0, 0, a]} castShadow>
            <boxGeometry args={[0.15, 1.4, 0.05]} />
            <meshStandardMaterial color={DARK_WOOD} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

const Shrine: React.FC<{ color: string }> = ({ color }) => (
  <group>
    <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.8, 0.4, 1.8]} />
      <meshStandardMaterial color="#cbd5e1" />
    </mesh>
    {/* Pillars */}
    {[
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [0.7, 0.7],
    ].map(([x, z]) => (
      <mesh key={`${x}-${z}`} position={[x, 1.0, z]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 1.4, 10]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
    ))}
    <mesh position={[0, 1.85, 0]} castShadow>
      <boxGeometry args={[2.0, 0.2, 2.0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
    </mesh>
    <pointLight position={[0, 1.7, 0]} intensity={0.4} color="#a5b4fc" distance={5} />
  </group>
);

const Garden: React.FC<{ color: string }> = ({ color }) => (
  <group>
    {/* Plot */}
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <boxGeometry args={[1.8, 0.1, 1.4]} />
      <meshStandardMaterial color="#6b4f2a" />
    </mesh>
    {/* Bushes */}
    {[
      [-0.6, -0.4],
      [0, -0.3],
      [0.6, -0.5],
      [-0.5, 0.3],
      [0.2, 0.4],
      [0.7, 0.2],
    ].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.25, z]} castShadow>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    ))}
  </group>
);

const StructureRender: React.FC<{ s: StructureDef }> = ({ s }) => {
  const props = { color: s.color };
  switch (s.kind) {
    case "house":
      return <House {...props} />;
    case "bakery":
      return <Bakery {...props} />;
    case "tower":
      return <Tower {...props} />;
    case "well":
      return <Well {...props} />;
    case "library":
      return <Library {...props} />;
    case "forge":
      return <Forge {...props} />;
    case "tavern":
      return <Tavern {...props} />;
    case "windmill":
      return <Windmill {...props} />;
    case "shrine":
      return <Shrine {...props} />;
    case "garden":
      return <Garden {...props} />;
  }
};

// Approximate height per kind for NEW badge placement.
const KIND_HEIGHT: Record<StructureDef["kind"], number> = {
  house: 2.2,
  bakery: 2.5,
  tower: 4.2,
  well: 2.0,
  library: 2.4,
  forge: 2.2,
  tavern: 2.7,
  windmill: 3.5,
  shrine: 2.4,
  garden: 0.9,
};

export const VillageStructure: React.FC<{
  s: StructureDef;
  isNew?: boolean;
  onClick?: () => void;
}> = ({ s, isNew, onClick }) => (
  <group
    position={[s.position[0], 0, s.position[1]]}
    rotation={[0, s.rotation || 0, 0]}
    onClick={(e) => {
      if (!onClick) return;
      e.stopPropagation();
      onClick();
    }}
  >
    {s.modelUrl ? (
      <ModelErrorBoundary fallback={<StructureRender s={s} />}>
        <Suspense fallback={<StructureRender s={s} />}>
          <StructureModel
            url={s.modelUrl}
            scale={s.modelScale ?? 1}
            yOffset={s.modelYOffset ?? 0}
          />
        </Suspense>
      </ModelErrorBoundary>
    ) : (
      <StructureRender s={s} />
    )}
    {isNew && (
      <Html
        position={[0, KIND_HEIGHT[s.kind] + 0.2, 0]}
        center
        distanceFactor={10}
        zIndexRange={[10, 0]}
      >
        <div className="structure-new-badge">
          <span className="structure-new-text">NEW</span>
          <span className="structure-new-name">{s.name}</span>
        </div>
      </Html>
    )}
  </group>
);

interface TreeProps {
  position: [number, number, number];
  scale?: number;
}

export const Tree: React.FC<TreeProps> = ({ position, scale = 1 }) => (
  <group position={position} scale={[scale, scale, scale]}>
    <mesh position={[0, 0.5, 0]} castShadow>
      <cylinderGeometry args={[0.12, 0.18, 1.0, 8]} />
      <meshStandardMaterial color="#6b3f1d" />
    </mesh>
    <mesh position={[0, 1.4, 0]} castShadow>
      <sphereGeometry args={[0.7, 10, 10]} />
      <meshStandardMaterial color="#3f7d3f" />
    </mesh>
    <mesh position={[0.25, 1.6, 0.2]} castShadow>
      <sphereGeometry args={[0.45, 8, 8]} />
      <meshStandardMaterial color="#4f9d4f" />
    </mesh>
    <mesh position={[-0.3, 1.3, -0.15]} castShadow>
      <sphereGeometry args={[0.5, 8, 8]} />
      <meshStandardMaterial color="#3f7d3f" />
    </mesh>
  </group>
);

interface LampProps {
  position: [number, number, number];
  /** 0..1 lamp on intensity from environment darkness. */
  glow: number;
}

export const StreetLamp: React.FC<LampProps> = ({ position, glow }) => {
  const lampColor = "#ffd27a";
  const emissiveI = glow * 1.6;
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.3, 10]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* Post */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2.0, 8]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* Arm */}
      <mesh position={[0.18, 2.3, 0]} castShadow>
        <boxGeometry args={[0.36, 0.05, 0.05]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* Lantern cap */}
      <mesh position={[0.34, 2.4, 0]} castShadow>
        <coneGeometry args={[0.13, 0.1, 8]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* Lantern bulb */}
      <mesh position={[0.34, 2.25, 0]} castShadow>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial
          color={lampColor}
          emissive={lampColor}
          emissiveIntensity={emissiveI}
        />
      </mesh>
      {/* Light source only when dark to save perf */}
      {glow > 0.05 && (
        <pointLight
          position={[0.34, 2.22, 0]}
          intensity={glow * 1.5}
          color={lampColor}
          distance={6}
          decay={1.6}
          castShadow={false}
        />
      )}
    </group>
  );
};

/**
 * Auto-place lamps along the spokes from plaza to each structure.
 */
export const StreetLamps: React.FC<{
  glow: number;
  structures: Array<{ position: [number, number] }>;
}> = ({ glow, structures }) => {
  // Always-on plaza corners.
  const plaza: Array<[number, number, number]> = [
    [-2.3, 0, -2.3],
    [2.3, 0, -2.3],
    [-2.3, 0, 2.3],
    [2.3, 0, 2.3],
  ];
  // For each structure: one lamp halfway down the spoke, offset to side.
  const along: Array<[number, number, number]> = [];
  for (const s of structures) {
    const dx = s.position[0];
    const dz = s.position[1];
    const d = Math.hypot(dx, dz);
    if (d < 0.5) continue;
    const ux = dx / d;
    const uz = dz / d;
    // perpendicular (right side of road)
    const px = -uz;
    const pz = ux;
    const midX = ux * (d * 0.55);
    const midZ = uz * (d * 0.55);
    along.push([midX + px * 1.1, 0, midZ + pz * 1.1]);
  }
  const all = [...plaza, ...along];
  return (
    <>
      {all.map((p, i) => (
        <StreetLamp key={i} position={p} glow={glow} />
      ))}
    </>
  );
};

export const DecorTrees: React.FC = () => {
  // Deterministic scatter outside main plot area.
  const spots: TreeProps[] = [
    { position: [-13, 0, -12], scale: 1.0 },
    { position: [-12, 0, 12], scale: 1.2 },
    { position: [12, 0, -10], scale: 0.9 },
    { position: [14, 0, 9], scale: 1.1 },
    { position: [-15, 0, 0], scale: 1.0 },
    { position: [15, 0, -3], scale: 1.05 },
    { position: [3, 0, -14], scale: 0.85 },
    { position: [-3, 0, 14], scale: 0.95 },
    { position: [10, 0, 13], scale: 1.0 },
    { position: [-9, 0, -13], scale: 1.15 },
    { position: [0, 0, -16], scale: 1.0 },
    { position: [-16, 0, 5], scale: 0.9 },
  ];
  return (
    <>
      {spots.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
    </>
  );
};
