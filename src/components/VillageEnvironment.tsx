import React from "react";
import { StructureDef } from "../utility/structures";

// City palette: dark asphalt plaza, lighter concrete pavers, dark steel railing.
const STONE_DARK = "#3a3d42";
const STONE_MID = "#5a5d63";
const FENCE_COLOR = "#2a2d32";
const FLOWER_COLORS = ["#ef4444", "#f59e0b", "#ec4899", "#a855f7"];
const Y_TILE = 0.08;

interface Props {
  structures: StructureDef[];
}

/** Round plaza centerpiece around the well. */
const Plaza: React.FC = () => (
  <group>
    <mesh position={[0, Y_TILE - 0.02, 0]} receiveShadow>
      <cylinderGeometry args={[3.5, 3.5, 0.04, 24]} />
      <meshStandardMaterial color={STONE_MID} />
    </mesh>
    <mesh position={[0, Y_TILE + 0.02, 0]} receiveShadow>
      <cylinderGeometry args={[2.2, 2.2, 0.04, 8]} />
      <meshStandardMaterial color={STONE_DARK} />
    </mesh>
  </group>
);

/** Stepping-stone path from plaza edge to a structure. */
const SteppingPath: React.FC<{ to: [number, number] }> = ({ to }) => {
  const d = Math.hypot(to[0], to[1]);
  if (d < 3.6) return null;
  const ux = to[0] / d;
  const uz = to[1] / d;
  const start = 3.6;
  const end = d - 1.6;
  if (end <= start) return null;
  const stones: React.ReactNode[] = [];
  const step = 1.1;
  let t = start;
  let idx = 0;
  while (t <= end) {
    const x = ux * t;
    const z = uz * t;
    const off = idx % 2 === 0 ? 0.2 : -0.2;
    const px = x + -uz * off;
    const pz = z + ux * off;
    stones.push(
      <mesh
        key={idx}
        position={[px, Y_TILE, pz]}
        rotation={[0, idx * 0.7, 0]}
        receiveShadow
      >
        <cylinderGeometry args={[0.34, 0.36, 0.06, 8]} />
        <meshStandardMaterial color={idx % 3 === 0 ? STONE_DARK : STONE_MID} />
      </mesh>
    );
    t += step;
    idx++;
  }
  return <>{stones}</>;
};

const PerimeterFence: React.FC = () => {
  const segments = 56;
  const radius = 19;
  const items: React.ReactNode[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    // Opening (gate) toward camera (south, +z, around a = π/2).
    if (Math.abs(a - Math.PI / 2) < 0.18) continue;
    items.push(
      <mesh key={`p-${i}`} position={[x, 0.35, z]} castShadow>
        <boxGeometry args={[0.08, 0.7, 0.08]} />
        <meshStandardMaterial color={FENCE_COLOR} />
      </mesh>
    );
  }
  return <>{items}</>;
};

const FlowerBed: React.FC<{ position: [number, number]; seed?: number }> = ({
  position,
  seed = 0,
}) => {
  const [x, z] = position;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[0.7, 0.8, 0.05, 14]} />
        <meshStandardMaterial color="#6b4f2a" />
      </mesh>
      {[
        [-0.3, 0.0],
        [0.25, -0.15],
        [0.15, 0.35],
        [-0.2, 0.3],
        [0.4, 0.15],
      ].map(([fx, fz], i) => (
        <group key={i} position={[fx, 0.18, fz]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.25, 6]} />
            <meshStandardMaterial color="#3f6f3f" />
          </mesh>
          <mesh position={[0, 0.18, 0]} castShadow>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial
              color={FLOWER_COLORS[(i + seed) % FLOWER_COLORS.length]}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const Bench: React.FC<{
  position: [number, number];
  rotation?: number;
}> = ({ position, rotation = 0 }) => (
  <group position={[position[0], 0, position[1]]} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0.18, 0]} castShadow>
      <boxGeometry args={[1.2, 0.08, 0.34]} />
      <meshStandardMaterial color="#7a5a32" />
    </mesh>
    <mesh position={[0, 0.4, -0.13]} castShadow>
      <boxGeometry args={[1.2, 0.4, 0.06]} />
      <meshStandardMaterial color="#7a5a32" />
    </mesh>
    <mesh position={[-0.5, 0.09, 0]} castShadow>
      <boxGeometry args={[0.08, 0.18, 0.3]} />
      <meshStandardMaterial color="#4a3622" />
    </mesh>
    <mesh position={[0.5, 0.09, 0]} castShadow>
      <boxGeometry args={[0.08, 0.18, 0.3]} />
      <meshStandardMaterial color="#4a3622" />
    </mesh>
  </group>
);

const Barrel: React.FC<{ position: [number, number] }> = ({ position }) => (
  <group position={[position[0], 0, position[1]]}>
    <mesh position={[0, 0.32, 0]} castShadow>
      <cylinderGeometry args={[0.28, 0.32, 0.64, 14]} />
      <meshStandardMaterial color="#6b3f1d" />
    </mesh>
    <mesh position={[0, 0.32, 0]}>
      <cylinderGeometry args={[0.34, 0.34, 0.06, 14]} />
      <meshStandardMaterial color="#3a2410" />
    </mesh>
    <mesh position={[0, 0.55, 0]}>
      <cylinderGeometry args={[0.31, 0.31, 0.06, 14]} />
      <meshStandardMaterial color="#3a2410" />
    </mesh>
  </group>
);

const Haystack: React.FC<{ position: [number, number] }> = ({ position }) => (
  <group position={[position[0], 0, position[1]]}>
    <mesh position={[0, 0.32, 0]} castShadow>
      <coneGeometry args={[0.6, 0.95, 8]} />
      <meshStandardMaterial color="#d8b25a" />
    </mesh>
    <mesh position={[0, 0.18, 0]} castShadow>
      <cylinderGeometry args={[0.55, 0.6, 0.3, 10]} />
      <meshStandardMaterial color="#c89c44" />
    </mesh>
  </group>
);

const Crate: React.FC<{ position: [number, number]; rotation?: number }> = ({
  position,
  rotation = 0,
}) => (
  <group position={[position[0], 0, position[1]]} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0.25, 0]} castShadow>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#8a5a2c" />
    </mesh>
  </group>
);

export const VillageEnvironment: React.FC<Props> = ({ structures }) => {
  return (
    <group>
      <Plaza />
      {structures.map((s) =>
        s.position[0] === 0 && s.position[1] === 0 ? null : (
          <SteppingPath key={s.id} to={s.position} />
        )
      )}
      <PerimeterFence />

      {/* Flowerbeds at gate and corners. */}
      <FlowerBed position={[-3, 17]} seed={0} />
      <FlowerBed position={[3, 17]} seed={2} />
      <FlowerBed position={[-15, -14]} seed={1} />
      <FlowerBed position={[15, -14]} seed={3} />
      <FlowerBed position={[-2.5, -3]} seed={1} />
      <FlowerBed position={[2.5, -3]} seed={2} />

      {/* Plaza benches looking at well. */}
      <Bench position={[-3.5, 4]} rotation={Math.PI} />
      <Bench position={[3.5, 4]} rotation={Math.PI} />
      <Bench position={[-3.5, -4]} rotation={0} />
      <Bench position={[3.5, -4]} rotation={0} />

      {/* Clutter near buildings. */}
      <Barrel position={[-10, -7]} />
      <Barrel position={[-9.2, -6.4]} />
      <Crate position={[10.5, -6.5]} rotation={0.4} />
      <Crate position={[11.2, -6]} rotation={-0.2} />
      <Haystack position={[-14, 3]} />
      <Haystack position={[14, 3]} />
      <Barrel position={[13.5, 7.5]} />
    </group>
  );
};
