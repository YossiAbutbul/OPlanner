import React, { useMemo } from "react";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

/**
 * Layered terrain:
 *  - Flat plaza zone inside r=22 (village area)
 *  - Rolling hills out to r=55
 *  - Mountain ring r=55..r=110 with sharp displacement
 *  - Lake disc carved in NW quadrant
 *
 * Color by height: sand, grass, stone, snow.
 */
interface TerrainProps {
  size?: number;
  segments?: number;
}

const VILLAGE_RADIUS = 22;
const HILL_RADIUS = 55;
const MOUNTAIN_RADIUS = 110;

const LAKE_CENTER = new THREE.Vector2(-32, -28);
const LAKE_RADIUS = 18;
const LAKE_LEVEL = -1.2;

// City palette: asphalt plaza, concrete sidewalks, distant hills muted gray.
const COL_SAND = new THREE.Color("#c0bfb8");      // sidewalk concrete
const COL_GRASS = new THREE.Color("#6e7480");     // asphalt mid
const COL_GRASS_DARK = new THREE.Color("#535862"); // asphalt deep
const COL_STONE = new THREE.Color("#8b8e93");      // building-base stone
const COL_SNOW = new THREE.Color("#dde0e3");       // light gravel

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const VillageTerrain: React.FC<TerrainProps> = ({
  size = 240,
  segments = 220,
}) => {
  const { geometry } = useMemo(() => {
    const noise2D = createNoise2D(() => 0.42);
    const noiseHi = createNoise2D(() => 0.83);
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);

      // Base hill noise
      const n1 = noise2D(x * 0.035, z * 0.035);
      const n2 = noiseHi(x * 0.12, z * 0.12) * 0.4;
      const hill = (n1 + n2) * 1.6;

      // Mountain falloff: amplify hard outside HILL_RADIUS
      const mountFactor = smoothstep(HILL_RADIUS, MOUNTAIN_RADIUS * 0.6, r);
      const mountHi = noise2D(x * 0.06, z * 0.06) * 0.5 + 0.5;
      const mountain =
        mountFactor *
        (8 + mountHi * 18 + Math.pow(mountHi, 3) * 14) *
        (0.7 + noiseHi(x * 0.02, z * 0.02) * 0.6);

      // Flatten village zone
      const flat = smoothstep(VILLAGE_RADIUS - 4, VILLAGE_RADIUS + 6, r);
      let y = hill * flat + mountain;

      // Carve lake (depress and clamp)
      const lakeD = Math.hypot(x - LAKE_CENTER.x, z - LAKE_CENTER.y);
      const lakeMask = smoothstep(LAKE_RADIUS + 4, LAKE_RADIUS - 2, lakeD);
      // Inside lake: bottom about y = LAKE_LEVEL - 0.8 (sand under water)
      const lakeBottom = LAKE_LEVEL - 1.2 + (1 - lakeMask) * 1.0;
      if (lakeMask > 0) {
        y = y * (1 - lakeMask) + lakeBottom * lakeMask;
      }

      pos.setY(i, y);

      // Color
      const c = new THREE.Color();
      const distToLake = lakeD - LAKE_RADIUS;
      if (lakeMask > 0.5) {
        c.copy(COL_SAND);
      } else if (distToLake < 2 && distToLake > -1) {
        c.copy(COL_SAND);
      } else if (y < 0.4) {
        c.copy(COL_GRASS);
      } else if (y < 6) {
        c.lerpColors(COL_GRASS, COL_GRASS_DARK, smoothstep(0.4, 6, y));
      } else if (y < 16) {
        c.lerpColors(COL_GRASS_DARK, COL_STONE, smoothstep(6, 16, y));
      } else if (y < 26) {
        c.copy(COL_STONE);
      } else {
        c.lerpColors(COL_STONE, COL_SNOW, smoothstep(26, 34, y));
      }
      // Slight noise variation
      const tint = noiseHi(x * 0.4, z * 0.4) * 0.04;
      c.r = Math.min(1, Math.max(0, c.r + tint));
      c.g = Math.min(1, Math.max(0, c.g + tint));
      c.b = Math.min(1, Math.max(0, c.b + tint));

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return { geometry: geo };
  }, [size, segments]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading />
    </mesh>
  );
};

export const VillageLake: React.FC = () => (
  <mesh
    position={[LAKE_CENTER.x, LAKE_LEVEL, LAKE_CENTER.y]}
    rotation={[-Math.PI / 2, 0, 0]}
    receiveShadow
  >
    <circleGeometry args={[LAKE_RADIUS - 0.5, 48]} />
    <meshStandardMaterial
      color="#3aa6d6"
      transparent
      opacity={0.85}
      metalness={0.2}
      roughness={0.3}
    />
  </mesh>
);
