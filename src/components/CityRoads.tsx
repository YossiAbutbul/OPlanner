import React, { Suspense } from "react";
import { StructureModel } from "./StructureModel";
import { ModelErrorBoundary } from "./ModelErrorBoundary";

const ROAD = (file: string) =>
  `${import.meta.env.BASE_URL}models/city/roads/${file}.glb`;

const TILE = 4; // Kenney road tiles are 4 units wide

const RoadTile: React.FC<{
  file: string;
  position: [number, number];
  rotation?: number;
}> = ({ file, position, rotation = 0 }) => (
  <group position={[position[0], 0, position[1]]} rotation={[0, rotation, 0]}>
    <ModelErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <StructureModel url={ROAD(file)} />
      </Suspense>
    </ModelErrorBoundary>
  </group>
);

/**
 * City road network — laid in front of the 5×2 building grid.
 * Main avenue between rows (z=-8.5) plus a front road (z=3.5).
 */
export const CityRoads: React.FC = () => {
  const mainZ = -8.5;
  const frontZ = 3.5;
  // Span from x=-18 to +18 in 4-unit steps.
  const xs = [-18, -14, -10, -6, -2, 2, 6, 10, 14, 18];
  return (
    <group>
      {xs.map((x) => (
        <RoadTile key={`m-${x}`} file="road-straight" position={[x, mainZ]} rotation={Math.PI / 2} />
      ))}
      {xs.map((x) => (
        <RoadTile key={`f-${x}`} file="road-straight" position={[x, frontZ]} rotation={Math.PI / 2} />
      ))}
      {/* Lamps at the avenue corners. */}
      <RoadTile file="light-square" position={[-20, mainZ]} />
      <RoadTile file="light-square" position={[20, mainZ]} />
      <RoadTile file="light-square" position={[-20, frontZ]} />
      <RoadTile file="light-square" position={[20, frontZ]} />
      {/* Center crossing at origin links the two roads. */}
      <RoadTile file="road-crossroad" position={[0, mainZ + TILE / 2]} />
    </group>
  );
};
