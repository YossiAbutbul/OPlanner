import React from "react";
import { StructureDef } from "../utility/structures";

const ROAD_COLOR = "#a89878";
const SIDEWALK_COLOR = "#d9cfb8";
const PLAZA_COLOR = "#cbb98c";

interface Props {
  structures: StructureDef[];
}

const ROAD_WIDTH = 1.4;
const SIDEWALK_WIDTH = 2.2;
const ROAD_Y = 0.02;
const SIDEWALK_Y = 0.015;
const PLAZA_Y = 0.025;

const RoadSegment: React.FC<{
  from: [number, number];
  to: [number, number];
}> = ({ from, to }) => {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return null;
  const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const yaw = Math.atan2(dx, dz);
  return (
    <group position={[mid[0], 0, mid[1]]} rotation={[0, yaw, 0]}>
      {/* Sidewalk (underlay) */}
      <mesh position={[0, SIDEWALK_Y, 0]} receiveShadow>
        <boxGeometry args={[SIDEWALK_WIDTH, 0.02, len]} />
        <meshStandardMaterial color={SIDEWALK_COLOR} />
      </mesh>
      {/* Road */}
      <mesh position={[0, ROAD_Y, 0]} receiveShadow>
        <boxGeometry args={[ROAD_WIDTH, 0.03, len]} />
        <meshStandardMaterial color={ROAD_COLOR} />
      </mesh>
    </group>
  );
};

const Plaza: React.FC = () => (
  <group>
    {/* Outer sidewalk ring */}
    <mesh position={[0, SIDEWALK_Y, 0]} receiveShadow>
      <cylinderGeometry args={[3.0, 3.0, 0.02, 24]} />
      <meshStandardMaterial color={SIDEWALK_COLOR} />
    </mesh>
    {/* Inner plaza tile */}
    <mesh position={[0, PLAZA_Y, 0]} receiveShadow>
      <cylinderGeometry args={[2.4, 2.4, 0.04, 24]} />
      <meshStandardMaterial color={PLAZA_COLOR} />
    </mesh>
    {/* Plaza crosshatch lines for texture */}
    {[0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => (
      <mesh
        key={a}
        position={[0, PLAZA_Y + 0.01, 0]}
        rotation={[0, a, 0]}
        receiveShadow
      >
        <boxGeometry args={[4.6, 0.005, 0.05]} />
        <meshStandardMaterial color="#a89878" />
      </mesh>
    ))}
  </group>
);

const FENCE_COLOR = "#5c4a32";
const PicketFence: React.FC<{
  from: [number, number];
  to: [number, number];
}> = ({ from, to }) => {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return null;
  const segs = Math.max(2, Math.floor(len / 0.45));
  const yaw = Math.atan2(dx, dz);
  const items: React.ReactNode[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    items.push(
      <mesh
        key={i}
        position={[
          from[0] + dx * t,
          0.25,
          from[1] + dz * t,
        ]}
        rotation={[0, yaw, 0]}
        castShadow
      >
        <boxGeometry args={[0.06, 0.5, 0.06]} />
        <meshStandardMaterial color={FENCE_COLOR} />
      </mesh>
    );
  }
  // Horizontal rails
  const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  items.push(
    <mesh
      key="rail-top"
      position={[mid[0], 0.4, mid[1]]}
      rotation={[0, yaw, 0]}
      castShadow
    >
      <boxGeometry args={[0.04, 0.04, len]} />
      <meshStandardMaterial color={FENCE_COLOR} />
    </mesh>
  );
  items.push(
    <mesh
      key="rail-bot"
      position={[mid[0], 0.15, mid[1]]}
      rotation={[0, yaw, 0]}
      castShadow
    >
      <boxGeometry args={[0.04, 0.04, len]} />
      <meshStandardMaterial color={FENCE_COLOR} />
    </mesh>
  );
  return <>{items}</>;
};

export const VillageEnvironment: React.FC<Props> = ({ structures }) => {
  return (
    <group>
      <Plaza />
      {structures.map((s) => {
        // Start at plaza edge (radius 3) toward structure.
        const dx = s.position[0];
        const dz = s.position[1];
        const d = Math.hypot(dx, dz);
        if (d < 0.01) return null;
        const startX = (dx / d) * 3.0;
        const startZ = (dz / d) * 3.0;
        // End slightly short of building.
        const endX = dx - (dx / d) * 1.0;
        const endZ = dz - (dz / d) * 1.0;
        return (
          <RoadSegment
            key={s.id}
            from={[startX, startZ]}
            to={[endX, endZ]}
          />
        );
      })}
      {/* Perimeter picket fence (rough rectangle) */}
      <PicketFence from={[-19, -19]} to={[19, -19]} />
      <PicketFence from={[19, -19]} to={[19, 19]} />
      <PicketFence from={[19, 19]} to={[-19, 19]} />
      <PicketFence from={[-19, 19]} to={[-19, -19]} />
    </group>
  );
};
