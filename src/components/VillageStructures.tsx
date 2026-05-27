import React, { Suspense, useEffect, useRef } from "react";
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
  house: 3.8,
  bakery: 4.0,
  tower: 6.0,
  well: 2.2,
  library: 4.2,
  forge: 4.5,
  tavern: 4.8,
  windmill: 6.5,
  shrine: 1.8,
  garden: 3.0,
};

const BUILD_DURATION_MS = 2000;
const TOOLS_PHASE_MS = 1300; // construction phase ends at this point

/** Floating dust puff — sphere that expands, rises, and fades. */
const DustPuff: React.FC<{
  origin: [number, number, number];
  delay: number;
  scale?: number;
}> = ({ origin, delay, scale = 1 }) => {
  const ref = useRef<THREE.Mesh>(null);
  const startRef = useRef(performance.now() + delay);
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = performance.now() - startRef.current;
    if (elapsed < 0) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const t = Math.min(1, elapsed / 900);
    const r = (0.25 + t * 1.1) * scale;
    ref.current.scale.set(r, r * 0.75, r);
    ref.current.position.set(origin[0], origin[1] + t * 1.0, origin[2]);
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.opacity = (1 - t) * 0.65;
  });
  return (
    <mesh ref={ref} raycast={() => null}>
      <sphereGeometry args={[0.5, 10, 10]} />
      <meshStandardMaterial
        color="#d6c8a8"
        transparent
        opacity={0.65}
        depthWrite={false}
      />
    </mesh>
  );
};

const Hammer: React.FC = () => (
  <group>
    {/* Handle */}
    <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.05, 0.05, 0.7, 8]} />
      <meshStandardMaterial color="#7a5a32" />
    </mesh>
    {/* Head */}
    <mesh position={[0.35, 0, 0]} castShadow>
      <boxGeometry args={[0.22, 0.18, 0.18]} />
      <meshStandardMaterial color="#4b5563" metalness={0.3} />
    </mesh>
  </group>
);

const Saw: React.FC = () => (
  <group>
    {/* Blade */}
    <mesh position={[0, 0, 0]} castShadow>
      <boxGeometry args={[0.6, 0.18, 0.02]} />
      <meshStandardMaterial color="#cbd5e1" metalness={0.4} />
    </mesh>
    {/* Handle */}
    <mesh position={[-0.36, 0, 0]} castShadow>
      <boxGeometry args={[0.18, 0.2, 0.06]} />
      <meshStandardMaterial color="#7a3b1a" />
    </mesh>
  </group>
);

const Wrench: React.FC = () => (
  <group>
    <mesh position={[0, 0, 0]} castShadow>
      <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
      <meshStandardMaterial color="#94a3b8" metalness={0.4} />
    </mesh>
    <mesh position={[0, 0.35, 0]} castShadow>
      <boxGeometry args={[0.22, 0.12, 0.08]} />
      <meshStandardMaterial color="#94a3b8" metalness={0.4} />
    </mesh>
  </group>
);

/** Tools orbit the plot center + bob, visible during the construction phase. */
const ToolSwarm: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef(performance.now());
  useFrame(() => {
    if (!groupRef.current) return;
    const elapsed = performance.now() - startRef.current;
    const t = elapsed / 1000;
    // Fade out near the end of the tool phase.
    const fade = Math.max(
      0,
      Math.min(1, (TOOLS_PHASE_MS - elapsed) / 300)
    );
    groupRef.current.children.forEach((child, i) => {
      const a = t * 2.5 + (i / 3) * Math.PI * 2;
      const r = 1.2;
      child.position.set(
        Math.cos(a) * r,
        1.3 + Math.sin(t * 5 + i) * 0.25,
        Math.sin(a) * r
      );
      child.rotation.set(
        Math.sin(t * 4 + i) * 0.6,
        a + Math.PI / 2,
        Math.sin(t * 3 + i) * 0.5
      );
      child.scale.setScalar(fade);
    });
  });
  return (
    <group ref={groupRef}>
      <group>
        <Hammer />
      </group>
      <group>
        <Saw />
      </group>
      <group>
        <Wrench />
      </group>
    </group>
  );
};

/** Build animation: tools+dust phase, then building pops in with bounce. */
const BuildAnim: React.FC<{
  active: boolean;
  children: React.ReactNode;
}> = ({ active, children }) => {
  const ref = useRef<THREE.Group>(null);
  const startRef = useRef(performance.now());
  useEffect(() => {
    if (active) startRef.current = performance.now();
  }, [active]);
  useFrame(() => {
    if (!ref.current) return;
    if (!active) {
      ref.current.scale.set(1, 1, 1);
      ref.current.visible = true;
      return;
    }
    const elapsed = performance.now() - startRef.current;
    if (elapsed < TOOLS_PHASE_MS) {
      // Construction phase — hide the building.
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const popT = Math.min(
      1,
      (elapsed - TOOLS_PHASE_MS) / (BUILD_DURATION_MS - TOOLS_PHASE_MS)
    );
    // Ease-out-back for a satisfying pop with overshoot.
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const eased = 1 + c3 * Math.pow(popT - 1, 3) + c1 * Math.pow(popT - 1, 2);
    ref.current.scale.setScalar(eased);
  });
  return <group ref={ref}>{children}</group>;
};

/** Dust + tools effect shown only while construction is in progress. */
const ConstructionFX: React.FC = () => {
  const [phase, setPhase] = React.useState<"build" | "done">("build");
  useEffect(() => {
    const id = window.setTimeout(() => setPhase("done"), TOOLS_PHASE_MS + 200);
    return () => window.clearTimeout(id);
  }, []);
  if (phase === "done") return null;
  // Multiple dust puffs at different offsets and delays for a sustained cloud.
  const puffs: Array<{ origin: [number, number, number]; delay: number; scale: number }> = [
    { origin: [0, 0.2, 0], delay: 0, scale: 1.2 },
    { origin: [0.7, 0.15, 0.3], delay: 200, scale: 0.9 },
    { origin: [-0.5, 0.2, 0.6], delay: 350, scale: 1.0 },
    { origin: [0.3, 0.15, -0.7], delay: 500, scale: 0.85 },
    { origin: [-0.6, 0.2, -0.4], delay: 700, scale: 1.0 },
    { origin: [0, 0.25, 0.9], delay: 900, scale: 0.8 },
  ];
  return (
    <group>
      <ToolSwarm />
      {puffs.map((p, i) => (
        <DustPuff key={i} origin={p.origin} delay={p.delay} scale={p.scale} />
      ))}
    </group>
  );
};

export const VillageStructure: React.FC<{
  s: StructureDef;
  isNew?: boolean;
  isBuilding?: boolean;
  onClick?: () => void;
}> = ({ s, isNew, isBuilding, onClick }) => {
  const url = s.modelUrl;
  return (
  <group
    position={[s.position[0], 0, s.position[1]]}
    rotation={[0, s.rotation || 0, 0]}
    onClick={(e) => {
      if (!onClick) return;
      e.stopPropagation();
      onClick();
    }}
  >
    {isBuilding && <ConstructionFX />}
    <BuildAnim active={!!isBuilding}>
      {url ? (
        <ModelErrorBoundary fallback={<StructureRender s={s} />}>
          <Suspense fallback={<StructureRender s={s} />}>
            <StructureModel
              url={url}
              scale={s.modelScale}
              yOffset={s.modelYOffset}
              targetFootprint={s.modelFootprint}
            />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        <StructureRender s={s} />
      )}
    </BuildAnim>
    {isNew && (
      <Html
        position={[0, KIND_HEIGHT[s.kind] + 0.2, 0]}
        center
        distanceFactor={22}
        zIndexRange={[2, 0]}
        pointerEvents="none"
      >
        <div className="structure-new-badge">
          <span className="structure-new-text">NEW</span>
          <span className="structure-new-name">{s.name}</span>
        </div>
      </Html>
    )}
  </group>
  );
};

/* === Empty plot helpers === */

/** 3x3 cobble grid foundation. */
const CobblePlatform: React.FC<{ affordable: boolean }> = ({ affordable }) => {
  const tiles: React.ReactNode[] = [];
  const size = 0.85;
  const gap = 0.04;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const x = (i - 1) * (size + gap);
      const z = (j - 1) * (size + gap);
      // Slight color variation per tile for a cobble look.
      const tint = (i * 3 + j) % 3;
      const base = affordable
        ? ["#b8a888", "#a89a78", "#c9bb98"][tint]
        : ["#8a8a8a", "#7a7a7a", "#9c9c9c"][tint];
      tiles.push(
        <mesh
          key={`${i}-${j}`}
          position={[x, 0.05, z]}
          receiveShadow
        >
          <boxGeometry args={[size, 0.1, size]} />
          <meshStandardMaterial color={base} />
        </mesh>
      );
    }
  }
  return <>{tiles}</>;
};

/** 4 corner wooden stakes with rope strung between (construction marker). */
const PlotStakes: React.FC = () => {
  const stake = (key: string, x: number, z: number) => (
    <group key={key} position={[x, 0, z]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.7, 6]} />
        <meshStandardMaterial color="#7a5a32" />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <coneGeometry args={[0.07, 0.1, 6]} />
        <meshStandardMaterial color="#5a3a18" />
      </mesh>
    </group>
  );
  // Rope segment between two anchors at fixed y.
  const rope = (key: string, a: [number, number], b: [number, number]) => {
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    return (
      <mesh key={key} position={[mx, 0.55, mz]} rotation={[0, yaw, 0]}>
        <boxGeometry args={[0.02, 0.02, len]} />
        <meshStandardMaterial color="#b48a52" />
      </mesh>
    );
  };
  const corners: Array<[number, number]> = [
    [-1.3, -1.3],
    [1.3, -1.3],
    [1.3, 1.3],
    [-1.3, 1.3],
  ];
  return (
    <>
      {corners.map((c, i) => stake(`s-${i}`, c[0], c[1]))}
      {corners.map((c, i) =>
        rope(`r-${i}`, c, corners[(i + 1) % corners.length])
      )}
    </>
  );
};

/** Rotating golden rune ring + inner star. */
const RuneCircle: React.FC<{ affordable: boolean }> = ({ affordable }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * (affordable ? 0.6 : 0.1);
  });
  const color = affordable ? "#fbbf24" : "#94a3b8";
  const emissive = affordable ? "#fbbf24" : "#475569";
  const intensity = affordable ? 1.4 : 0.2;
  return (
    <group ref={ref} position={[0, 0.13, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.0, 36]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={intensity}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.55, 0.62, 36]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={intensity}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* 4 cardinal tick marks */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.78, 0.02, Math.sin(a) * 0.78]}
          >
            <boxGeometry args={[0.08, 0.02, 0.18]} />
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={intensity}
            />
          </mesh>
        );
      })}
    </group>
  );
};

/** Soft upward-facing light pillar that pulses (only when affordable). */
const LightPillar: React.FC = () => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pulse = 0.55 + Math.sin(t * 2) * 0.15;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.opacity = pulse * 0.3;
  });
  return (
    <mesh ref={ref} position={[0, 1.5, 0]} raycast={() => null}>
      <cylinderGeometry args={[0.18, 1.0, 3.0, 16, 1, true]} />
      <meshStandardMaterial
        color="#fde68a"
        emissive="#f59e0b"
        emissiveIntensity={1.2}
        transparent
        opacity={0.25}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

/** Spinning coin hovering above an affordable plot. */
const FloatingCoin: React.FC = () => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 3.5;
    ref.current.position.y = 2.2 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
  });
  return (
    <group ref={ref}>
      <mesh castShadow raycast={() => null}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 18]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#f59e0b"
          emissiveIntensity={0.5}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[0.14, 0.18, 18]} />
        <meshStandardMaterial
          color="#b45309"
          emissive="#92400e"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
};

/** Empty plot placeholder shown for unpurchased structures. */
export const EmptyPlot: React.FC<{
  s: StructureDef;
  affordable: boolean;
  onClick?: () => void;
  onBuy?: () => void;
}> = ({ s, affordable, onClick, onBuy }) => (
  <group
    position={[s.position[0], 0, s.position[1]]}
    onClick={(e) => {
      if (!onClick) return;
      e.stopPropagation();
      onClick();
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => {
      document.body.style.cursor = "";
    }}
  >
    <CobblePlatform affordable={affordable} />
    <PlotStakes />
    <RuneCircle affordable={affordable} />
    {affordable && <LightPillar />}
    {affordable && <FloatingCoin />}
    {/* Floating info card. */}
    <Html
      position={[0, 1.5, 0]}
      center
      distanceFactor={22}
      occlude={false}
      zIndexRange={[2, 0]}
    >
      <button
        type="button"
        className={`plot-card ${
          affordable ? "plot-card-on" : "plot-card-off"
        } ${affordable && onBuy ? "plot-card-buyable" : ""}`}
        disabled={!affordable || !onBuy}
        onClick={(e) => {
          e.stopPropagation();
          if (affordable && onBuy) onBuy();
        }}
        title={affordable ? `Buy ${s.name} for ${s.cost}` : "Not enough coins"}
      >
        <div className="plot-card-icon">🏗️</div>
        <div className="plot-card-body">
          <div className="plot-card-name">{s.name}</div>
          <div className="plot-card-cost">🪙 {s.cost}</div>
        </div>
      </button>
    </Html>
  </group>
);

interface TreeProps {
  position: [number, number, number];
  scale?: number;
  /** "oak" = bushy round, "pine" = stacked cones, "birch" = tall slim. */
  variant?: "oak" | "pine" | "birch";
  /** Optional override for foliage tint. */
  tint?: string;
}

const BARK_DARK = "#5a3a20";
const BARK_LIGHT = "#8a6a40";
const BIRCH_BARK = "#e6e2d4";

const OakTree: React.FC<{ tint?: string }> = ({ tint }) => {
  const c1 = tint ?? "#3f7d3f";
  const c2 = "#4f9d4f";
  const c3 = "#2f6e2f";
  return (
    <>
      {/* Trunk — slight cone */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.22, 1.1, 8]} />
        <meshStandardMaterial color={BARK_DARK} />
      </mesh>
      {/* Foliage cluster — overlapping rounded blobs */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <icosahedronGeometry args={[0.78, 1]} />
        <meshStandardMaterial color={c1} flatShading />
      </mesh>
      <mesh position={[0.35, 1.75, 0.2]} rotation={[0.3, 0.8, 0]} castShadow>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color={c2} flatShading />
      </mesh>
      <mesh position={[-0.32, 1.45, -0.18]} rotation={[-0.2, -0.5, 0.4]} castShadow>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial color={c3} flatShading />
      </mesh>
      <mesh position={[0.1, 2.05, -0.1]} castShadow>
        <icosahedronGeometry args={[0.38, 1]} />
        <meshStandardMaterial color={c2} flatShading />
      </mesh>
    </>
  );
};

const PineTree: React.FC<{ tint?: string }> = ({ tint }) => {
  const c = tint ?? "#2d6b3d";
  const cLight = "#3f8a52";
  return (
    <>
      {/* Slim straight trunk */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 1.2, 8]} />
        <meshStandardMaterial color={BARK_DARK} />
      </mesh>
      {/* Three stacked cones */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <coneGeometry args={[0.9, 1.0, 8]} />
        <meshStandardMaterial color={c} flatShading />
      </mesh>
      <mesh position={[0, 1.95, 0]} castShadow>
        <coneGeometry args={[0.7, 0.9, 8]} />
        <meshStandardMaterial color={cLight} flatShading />
      </mesh>
      <mesh position={[0, 2.55, 0]} castShadow>
        <coneGeometry args={[0.5, 0.8, 8]} />
        <meshStandardMaterial color={c} flatShading />
      </mesh>
    </>
  );
};

const BirchTree: React.FC<{ tint?: string }> = ({ tint }) => {
  const c = tint ?? "#a8d76a";
  return (
    <>
      {/* Tall slim birch trunk */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 2.0, 8]} />
        <meshStandardMaterial color={BIRCH_BARK} />
      </mesh>
      {/* Dark bark stripes */}
      {[0.4, 0.95, 1.5, 1.75].map((y) => (
        <mesh key={y} position={[0, y, 0.11]} castShadow>
          <boxGeometry args={[0.22, 0.05, 0.02]} />
          <meshStandardMaterial color="#3a3024" />
        </mesh>
      ))}
      {/* Loose elliptical canopy */}
      <mesh position={[0, 2.3, 0]} castShadow>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial color={c} flatShading />
      </mesh>
      <mesh position={[0.2, 2.5, 0.15]} castShadow>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial color={c} flatShading />
      </mesh>
      <mesh position={[-0.18, 2.15, -0.12]} castShadow>
        <icosahedronGeometry args={[0.36, 1]} />
        <meshStandardMaterial color={BARK_LIGHT} flatShading />
      </mesh>
    </>
  );
};

export const Tree: React.FC<TreeProps> = ({
  position,
  scale = 1,
  variant = "oak",
  tint,
}) => {
  // Slight per-instance rotation for natural variety.
  const yaw = ((position[0] * 13 + position[2] * 7) % 6.28) * 0.3;
  return (
    <group position={position} scale={[scale, scale, scale]} rotation={[0, yaw, 0]}>
      {variant === "pine" && <PineTree tint={tint} />}
      {variant === "birch" && <BirchTree tint={tint} />}
      {(!variant || variant === "oak") && <OakTree tint={tint} />}
    </group>
  );
};

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
 * Lamps lined up along the main street between the two rows.
 */
/** Lamps ring the central plaza + a pair at the south gate. */
export const StreetLamps: React.FC<{
  glow: number;
  structures: Array<{ position: [number, number] }>;
}> = ({ glow }) => {
  const positions: Array<[number, number, number]> = [];
  const plazaR = 3.9;
  const ringCount = 8;
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2;
    positions.push([Math.cos(a) * plazaR, 0, Math.sin(a) * plazaR]);
  }
  // Gate lamps at south opening.
  positions.push([-3.5, 0, 18]);
  positions.push([3.5, 0, 18]);
  return (
    <>
      {positions.map((p, i) => (
        <StreetLamp key={i} position={p} glow={glow} />
      ))}
    </>
  );
};

/**
 * Ambient floating dust motes — small bright spheres drifting in a lazy
 * sine pattern, looping back when they leave the play area.
 */
export const Motes: React.FC<{ count?: number; area?: number }> = ({
  count = 60,
  area = 22,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const motes = React.useMemo(() => {
    const arr: Array<{
      base: [number, number, number];
      phaseX: number;
      phaseY: number;
      speed: number;
      size: number;
    }> = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        base: [
          (Math.random() - 0.5) * area * 2,
          1.2 + Math.random() * 4,
          (Math.random() - 0.5) * area * 2,
        ],
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        size: 0.05 + Math.random() * 0.08,
      });
    }
    return arr;
  }, [count, area]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = groupRef.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const m = motes[i];
      if (!m) return;
      child.position.set(
        m.base[0] + Math.sin(t * m.speed + m.phaseX) * 1.2,
        m.base[1] + Math.sin(t * m.speed * 1.4 + m.phaseY) * 0.4,
        m.base[2] + Math.cos(t * m.speed + m.phaseX) * 1.2
      );
    });
  });
  return (
    <group ref={groupRef}>
      {motes.map((m, i) => (
        <mesh key={i} raycast={() => null}>
          <sphereGeometry args={[m.size, 6, 6]} />
          <meshStandardMaterial
            color="#fffce6"
            emissive="#fef3c7"
            emissiveIntensity={0.6}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

/** Butterfly — two flapping triangle wings + tiny body. */
const Butterfly: React.FC<{
  anchor: [number, number, number];
  color: string;
  seed: number;
}> = ({ anchor, color, seed }) => {
  const groupRef = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime + seed;
    if (groupRef.current) {
      // Loose figure-8 orbit around anchor.
      groupRef.current.position.set(
        anchor[0] + Math.sin(t * 0.7) * 1.6,
        anchor[1] + 0.6 + Math.abs(Math.sin(t * 1.1)) * 0.4,
        anchor[2] + Math.sin(t * 0.7 * 2) * 0.8
      );
      groupRef.current.rotation.y = t * 0.7 + Math.PI / 2;
    }
    const flap = Math.sin(t * 18) * 0.9;
    if (wingL.current) wingL.current.rotation.z = flap;
    if (wingR.current) wingR.current.rotation.z = -flap;
  });
  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh raycast={() => null}>
        <cylinderGeometry args={[0.02, 0.02, 0.18, 4]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Wings — thin double-sided planes */}
      <mesh ref={wingL} position={[-0.05, 0, 0]} raycast={() => null}>
        <planeGeometry args={[0.22, 0.18]} />
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.95}
        />
      </mesh>
      <mesh ref={wingR} position={[0.05, 0, 0]} raycast={() => null}>
        <planeGeometry args={[0.22, 0.18]} />
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.95}
        />
      </mesh>
    </group>
  );
};

export const Butterflies: React.FC = () => {
  const flies: Array<{
    anchor: [number, number, number];
    color: string;
    seed: number;
  }> = [
    { anchor: [-3, 0, 17], color: "#f472b6", seed: 0 },
    { anchor: [3, 0, 17], color: "#a78bfa", seed: 1.4 },
    { anchor: [-15, 0, -14], color: "#fb923c", seed: 2.1 },
    { anchor: [15, 0, -14], color: "#60a5fa", seed: 3.3 },
    { anchor: [-2.5, 0, -3], color: "#facc15", seed: 4 },
    { anchor: [2.5, 0, -3], color: "#fb7185", seed: 5.2 },
  ];
  return (
    <>
      {flies.map((f, i) => (
        <Butterfly key={i} anchor={f.anchor} color={f.color} seed={f.seed} />
      ))}
    </>
  );
};

/** Slow-rising smoke puffs from a fixed origin (use over chimneys / bonfire). */
export const Smoke: React.FC<{
  position: [number, number, number];
  color?: string;
  count?: number;
}> = ({ position, color = "#cfd2d6", count = 6 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const puffs = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        offset: (i / count) * 3,
        side: Math.random() * 2 - 1,
      })),
    [count]
  );
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.children.forEach((child, i) => {
      const p = puffs[i];
      const cycle = ((t + p.offset) % 3) / 3;
      child.position.set(p.side * cycle * 0.5, cycle * 2.5, 0);
      child.scale.setScalar(0.3 + cycle * 0.7);
      ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity =
        (1 - cycle) * 0.5;
    });
  });
  return (
    <group ref={groupRef} position={position}>
      {puffs.map((_, i) => (
        <mesh key={i} raycast={() => null}>
          <sphereGeometry args={[0.35, 8, 8]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

export const DecorTrees: React.FC = () => {
  // Dense ring of trees just outside the fence + scattered inside fillers.
  // Variant mix: oak (default), pine (tall conical), birch (slim white).
  const spots: TreeProps[] = [
    // Outside ring.
    { position: [-22, 0, -10], scale: 1.1, variant: "pine" },
    { position: [-24, 0, -3], scale: 1.25, variant: "oak" },
    { position: [-24, 0, 4], scale: 1.0, variant: "birch" },
    { position: [-22, 0, 11], scale: 1.1, variant: "oak" },
    { position: [22, 0, -10], scale: 1.2, variant: "pine" },
    { position: [24, 0, -3], scale: 1.0, variant: "oak" },
    { position: [24, 0, 4], scale: 1.15, variant: "birch" },
    { position: [22, 0, 11], scale: 0.95, variant: "oak" },
    { position: [-14, 0, -19], scale: 1.05, variant: "pine" },
    { position: [-6, 0, -21], scale: 1.2, variant: "pine" },
    { position: [0, 0, -22], scale: 1.3, variant: "oak", tint: "#357d4d" },
    { position: [6, 0, -21], scale: 1.15, variant: "pine" },
    { position: [14, 0, -19], scale: 1.0, variant: "birch" },
    { position: [-12, 0, 20], scale: 1.05, variant: "oak" },
    { position: [12, 0, 20], scale: 1.1, variant: "birch" },
    // Inside fillers.
    { position: [-17, 0, 0], scale: 0.85, variant: "oak" },
    { position: [17, 0, 0], scale: 0.85, variant: "birch" },
    { position: [-3, 0, 12], scale: 0.7, variant: "oak", tint: "#5fae5f" },
    { position: [3, 0, 12], scale: 0.7, variant: "oak", tint: "#5fae5f" },
    { position: [-6, 0, -5], scale: 0.65, variant: "pine" },
    { position: [6, 0, -5], scale: 0.65, variant: "pine" },
  ];
  return (
    <>
      {spots.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
    </>
  );
};
