import React, { Suspense } from "react";
import { StructureModel } from "./StructureModel";
import { ModelErrorBoundary } from "./ModelErrorBoundary";

const ROAD = (file: string) =>
  `${import.meta.env.BASE_URL}models/city/roads/${file}.glb`;

const TILE = 4; // We render each Kenney road tile at 4×4 units.

const RoadTile: React.FC<{
  file: string;
  position: [number, number];
  rotation?: number;
}> = ({ file, position, rotation = 0 }) => (
  <group position={[position[0], 0, position[1]]} rotation={[0, rotation, 0]}>
    <ModelErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <StructureModel url={ROAD(file)} targetFootprint={TILE} />
      </Suspense>
    </ModelErrorBoundary>
  </group>
);

/**
 * City road grid wrapping a 3×5 building layout.
 * Buildings sit in the blocks at rows z=-22 / -10 / 2, columns x=-16..+16.
 * Avenues run E-W between rows; cross streets run N-S between column groups.
 */
export const CityRoads: React.FC = () => {
  // Avenue z-positions (between building rows). Rows live at z=-30/-20/-10/2.
  const avenues = [-25, -15, -4, 8];
  // Cross-street x-positions (between column groups).
  const crosses = [-12, -4, 4, 12];
  // X range for avenues (one tile every 4 units, centered).
  const xs: number[] = [];
  for (let x = -20; x <= 20; x += TILE) xs.push(x);
  // Z range for cross streets — span back-most avenue to front-most.
  const zs: number[] = [];
  for (let z = -28; z <= 8; z += TILE) zs.push(z);

  const intersection = (x: number, z: number) =>
    avenues.includes(z) && crosses.includes(x);

  const items: React.ReactNode[] = [];

  // Avenues (E-W roads).
  for (const z of avenues) {
    for (const x of xs) {
      if (intersection(x, z)) {
        items.push(
          <RoadTile
            key={`av-x-${x}-${z}`}
            file="road-crossroad"
            position={[x, z]}
          />
        );
      } else {
        items.push(
          <RoadTile
            key={`av-${x}-${z}`}
            file="road-straight"
            position={[x, z]}
            rotation={Math.PI / 2}
          />
        );
      }
    }
  }

  // Cross streets (N-S roads). Skip tiles where avenue already placed (intersections).
  for (const x of crosses) {
    for (const z of zs) {
      if (avenues.includes(z)) continue; // already a crossroad tile
      items.push(
        <RoadTile key={`cr-${x}-${z}`} file="road-straight" position={[x, z]} />
      );
    }
  }

  // Street lamps at outer corners of the road grid.
  const lampPositions: [number, number][] = [
    [-22, avenues[0]],
    [22, avenues[0]],
    [-22, avenues[avenues.length - 1]],
    [22, avenues[avenues.length - 1]],
  ];

  return (
    <group>
      {items}
      {lampPositions.map(([x, z], i) => (
        <RoadTile key={`lamp-${i}`} file="light-square" position={[x, z]} />
      ))}
    </group>
  );
};
