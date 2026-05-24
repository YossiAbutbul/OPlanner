import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import { useView } from "../context/ViewContext";
import { useVillage, VillagerInstance } from "../context/VillageContext";
import { useVillageState } from "../context/VillageStateContext";
import {
  VillageStructure,
  DecorTrees,
  StreetLamps,
  EmptyPlot,
  Motes,
  Butterflies,
  Smoke,
} from "./VillageStructures";
import { VillageEnvironment } from "./VillageEnvironment";
import { VillageTerrain, VillageLake } from "./VillageTerrain";
import { StructureDef } from "../utility/structures";
import { VILLAGERS } from "../utility/village";
import { VILLAGER_PAIRS } from "../utility/villagerBonus";
import "../css/VillageView.css";

const VILLAGER_BY_ID = new Map(VILLAGERS.map((v) => [v.id, v]));


// Approximate footprint per structure kind for villager avoidance.
const FOOTPRINT: Record<StructureDef["kind"], number> = {
  house: 2.0,
  bakery: 2.0,
  tower: 2.0,
  well: 1.2,
  library: 2.2,
  forge: 2.7,
  tavern: 3.0,
  windmill: 2.5,
  shrine: 1.0,
  garden: 1.5,
};

const structureKindLabel = (k: StructureDef["kind"]): string =>
  ({
    house: "Cottage",
    bakery: "Townhouse",
    tower: "Bell Tower",
    well: "Well",
    library: "Old House",
    forge: "Blacksmith",
    tavern: "Inn",
    windmill: "Mill",
    shrine: "Bonfire",
    garden: "Gazebo",
  }[k]);

// Wander bounds (square radius).
const BOUND = 16;
const SPEED = 0.9; // units / sec
const ARRIVE_EPSILON = 0.25;

/**
 * Restores saved camera once on mount, then debounces save on user changes.
 * Uses useThree to access the camera + OrbitControls target via document event
 * dispatched by OrbitControls' onChange.
 */
const CameraSync: React.FC<{
  savedCamera: { position: [number, number, number]; target: [number, number, number] } | null;
  onChange: (c: {
    position: [number, number, number];
    target: [number, number, number];
  }) => void;
}> = ({ savedCamera, onChange }) => {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as
    | { target?: THREE.Vector3; update?: () => void }
    | null;
  const restored = useRef(false);
  const lastSaveAt = useRef(0);

  React.useEffect(() => {
    if (restored.current || !savedCamera || !camera) return;
    camera.position.set(...savedCamera.position);
    if (controls?.target) {
      controls.target.set(...savedCamera.target);
      controls.update?.();
    }
    restored.current = true;
  }, [savedCamera, camera, controls]);

  useFrame(() => {
    if (!restored.current && !savedCamera) restored.current = true;
    if (!restored.current) return;
    const now = performance.now();
    if (now - lastSaveAt.current < 1500) return;
    if (!controls?.target || !camera) return;
    lastSaveAt.current = now;
    onChange({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    });
  });

  return null;
};

/**
 * tod in [0,1]: 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset.
 */
const sunPositionFor = (tod: number): [number, number, number] => {
  const a = tod * Math.PI * 2 - Math.PI / 2; // start at sunrise on east
  const x = Math.cos(a) * 100;
  const y = Math.sin(a) * 100;
  return [x, y, 60];
};

const Lighting: React.FC<{ tod: number }> = ({ tod }) => {
  const sun = sunPositionFor(tod);
  // Daylight factor: 1 = noon, 0 = midnight.
  const day = Math.max(0, Math.sin(tod * Math.PI * 2 - Math.PI / 2));
  const ambient = 0.18 + day * 0.45;
  const dirIntensity = 0.15 + day * 1.1;
  const isDawnDusk = day > 0 && day < 0.35;
  const dirColor = isDawnDusk ? "#ffb27a" : day > 0.35 ? "#fff5e0" : "#5b6fb0";
  const hemiSky = day > 0.4 ? "#b1e1ff" : day > 0.05 ? "#ff9a76" : "#1a2447";
  const hemiGround = day > 0.4 ? "#5fae5f" : "#2c4a2c";
  return (
    <>
      <ambientLight intensity={ambient} color={day > 0.1 ? "#fff" : "#9aaadc"} />
      <directionalLight
        position={sun}
        intensity={dirIntensity}
        color={dirColor}
        castShadow={day > 0.05}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <hemisphereLight args={[hemiSky, hemiGround, 0.45 + day * 0.2]} />
      {/* Moon glow at night */}
      {day < 0.1 && (
        <pointLight
          position={[-sun[0] * 0.3, Math.abs(sun[1]) * 0.6 + 8, -sun[2] * 0.3]}
          intensity={0.25}
          color="#a5b4fc"
          distance={60}
        />
      )}
    </>
  );
};

const CLEARANCE = 1.4;

const isClear = (
  x: number,
  z: number,
  obstacles: Array<{ x: number; z: number; r: number }>
): boolean => {
  for (const o of obstacles) {
    if (Math.hypot(x - o.x, z - o.z) < o.r + CLEARANCE) return false;
  }
  return true;
};

const randomTargetAvoiding = (
  obstacles: Array<{ x: number; z: number; r: number }>
): THREE.Vector3 => {
  for (let attempt = 0; attempt < 30; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * BOUND;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (isClear(x, z, obstacles)) return new THREE.Vector3(x, 0, z);
  }
  // Fallback: scan the south plaza ring (open area near camera) for a clear
  // spot. Never default to (0,0,0) — that's the well and causes pile-ups.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = Math.cos(a) * 5;
    const z = Math.sin(a) * 5;
    if (isClear(x, z, obstacles)) return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(0, 0, 12); // south open area as last resort
};

interface ProceduralBodyProps {
  v: VillagerInstance;
  hovered: boolean;
  bodyRef: React.RefObject<THREE.Group | null>;
  armLRef: React.RefObject<THREE.Mesh | null>;
  armRRef: React.RefObject<THREE.Mesh | null>;
  legLRef: React.RefObject<THREE.Mesh | null>;
  legRRef: React.RefObject<THREE.Mesh | null>;
}

const SKIN = "#f4cfa3";
const SHOE = "#3a2a18";

/**
 * Chibi villager — big head, small round body, stubby limbs. Tinted by v.color.
 * Anim refs (body / arms / legs) preserved so walking + bob still works.
 */
const ProceduralBody: React.FC<ProceduralBodyProps> = ({
  v,
  hovered,
  bodyRef,
  armLRef,
  armRRef,
  legLRef,
  legRRef,
}) => (
  <>
    {/* Stubby legs (shoes). */}
    <mesh ref={legLRef} position={[-0.11, 0.12, 0]} castShadow>
      <boxGeometry args={[0.16, 0.22, 0.2]} />
      <meshStandardMaterial color={SHOE} />
    </mesh>
    <mesh ref={legRRef} position={[0.11, 0.12, 0]} castShadow>
      <boxGeometry args={[0.16, 0.22, 0.2]} />
      <meshStandardMaterial color={SHOE} />
    </mesh>

    {/* Body + head group — bobs while walking. */}
    <group ref={bodyRef} position={[0, 0.45, 0]}>
      {/* Round torso */}
      <mesh castShadow>
        <sphereGeometry args={[0.28, 18, 14]} />
        <meshStandardMaterial
          color={v.color}
          emissive={hovered ? v.color : "#000"}
          emissiveIntensity={hovered ? 0.4 : 0}
        />
      </mesh>
      {/* Belt */}
      <mesh position={[0, -0.05, 0]} castShadow>
        <cylinderGeometry args={[0.29, 0.29, 0.06, 16]} />
        <meshStandardMaterial color="#3a2a18" />
      </mesh>
      {/* Tiny arm nubs */}
      <mesh ref={armLRef} position={[-0.28, 0.02, 0]} castShadow>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color={v.color} />
      </mesh>
      <mesh ref={armRRef} position={[0.28, 0.02, 0]} castShadow>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color={v.color} />
      </mesh>

      {/* Big head */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <sphereGeometry args={[0.3, 20, 16]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>
      {/* Cheeks */}
      <mesh position={[-0.21, 0.4, 0.18]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#f4a3a3" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.21, 0.4, 0.18]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#f4a3a3" transparent opacity={0.7} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.1, 0.48, 0.26]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.1, 0.48, 0.26]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Eye highlight */}
      <mesh position={[-0.085, 0.495, 0.295]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      <mesh position={[0.115, 0.495, 0.295]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      {/* Hood/beanie — half-sphere matching body color */}
      <mesh position={[0, 0.58, -0.02]} rotation={[Math.PI, 0, 0]} castShadow>
        <sphereGeometry args={[0.31, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={v.color} />
      </mesh>
      {/* Beanie pom */}
      <mesh position={[0, 0.78, -0.02]} castShadow>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
    </group>
  </>
);

const Villager: React.FC<{
  v: VillagerInstance;
  obstacles: Array<{ x: number; z: number; r: number }>;
  isNew: boolean;
  onClick: () => void;
}> = ({ v, obstacles, isNew, onClick }) => {
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const target = useRef<THREE.Vector3>(randomTargetAvoiding(obstacles));
  const idleUntil = useRef<number>(0);
  const bobPhase = useRef<number>(Math.random() * Math.PI * 2);
  const yawRef = useRef<number>(Math.random() * Math.PI * 2);
  const walkAnim = useRef<number>(0);
  // Stuck detection — track position + time of last meaningful progress.
  const lastPos = useRef<{ x: number; z: number; t: number }>({
    x: 0,
    z: 0,
    t: 0,
  });

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const now = state.clock.elapsedTime;
    const pos = g.position;

    // Idle phase: don't move, but still bob and idle-sway arms.
    if (now < idleUntil.current) {
      if (body.current) {
        bobPhase.current += delta * 4;
        body.current.position.y = 0.55 + Math.sin(bobPhase.current) * 0.02;
      }
      walkAnim.current *= 0.9;
      if (armL.current) armL.current.rotation.x = walkAnim.current;
      if (armR.current) armR.current.rotation.x = -walkAnim.current;
      if (legL.current) legL.current.rotation.x = walkAnim.current * 0.5;
      if (legR.current) legR.current.rotation.x = -walkAnim.current * 0.5;
      return;
    }

    const dx = target.current.x - pos.x;
    const dz = target.current.z - pos.z;
    const dist = Math.hypot(dx, dz);

    if (dist < ARRIVE_EPSILON) {
      // Arrived: idle 0.8 - 2.5s then new target.
      idleUntil.current = now + 0.8 + Math.random() * 1.7;
      target.current = randomTargetAvoiding(obstacles);
      return;
    }

    // If target became blocked (an obstacle moved/changed), pick a new one.
    if (!isClear(target.current.x, target.current.z, obstacles)) {
      target.current = randomTargetAvoiding(obstacles);
      return;
    }

    // Stuck detection — if we haven't moved >0.3 units in 1.5s, repath.
    const moved = Math.hypot(pos.x - lastPos.current.x, pos.z - lastPos.current.z);
    if (moved > 0.3) {
      lastPos.current = { x: pos.x, z: pos.z, t: now };
    } else if (now - lastPos.current.t > 1.5) {
      target.current = randomTargetAvoiding(obstacles);
      lastPos.current = { x: pos.x, z: pos.z, t: now };
      return;
    }

    // Strong obstacle push — inflate radius so villagers never enter buildings.
    for (const o of obstacles) {
      const ox = pos.x - o.x;
      const oz = pos.z - o.z;
      const od = Math.hypot(ox, oz);
      const safeR = o.r + 0.3;
      if (od < safeR && od > 0.001) {
        const push = (safeR - od);
        pos.x += (ox / od) * push;
        pos.z += (oz / od) * push;
      }
    }

    const step = Math.min(SPEED * delta, dist);
    pos.x += (dx / dist) * step;
    pos.z += (dz / dist) * step;

    // Rotate toward velocity (smoothed).
    const desiredYaw = Math.atan2(dx, dz);
    let diff = desiredYaw - yawRef.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yawRef.current += diff * Math.min(1, delta * 6);
    g.rotation.y = yawRef.current;

    // Walking bob + limb swing.
    if (body.current) {
      bobPhase.current += delta * 8;
      body.current.position.y = 0.55 + Math.abs(Math.sin(bobPhase.current)) * 0.08;
    }
    walkAnim.current = Math.sin(bobPhase.current) * 0.6;
    if (armL.current) armL.current.rotation.x = walkAnim.current;
    if (armR.current) armR.current.rotation.x = -walkAnim.current;
    if (legL.current) legL.current.rotation.x = -walkAnim.current * 0.8;
    if (legR.current) legR.current.rotation.x = walkAnim.current * 0.8;
  });

  return (
    <group
      ref={group}
      position={[v.x, 0, v.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <ProceduralBody
        v={v}
        hovered={hovered}
        bodyRef={body}
        armLRef={armL}
        armRRef={armR}
        legLRef={legL}
        legRRef={legR}
      />
      {/* Name tag */}
      <Html
        position={[0, 1.95, 0]}
        center
        distanceFactor={22}
        occlude={false}
        zIndexRange={[2, 0]}
        pointerEvents="none"
      >
        <div className={`villager-tag rarity-${v.rarity}`}>
          {isNew && <span className="villager-tag-new">NEW</span>}
          <span className="villager-tag-emoji">{v.emoji}</span>
          <span className="villager-tag-name">{v.name}</span>
        </div>
      </Html>
    </group>
  );
};

const VillageView: React.FC = () => {
  const { setView } = useView();
  const {
    villagers,
    unlockedCount,
    totalCount,
    devExtras,
    addDevVillager,
    removeLastDev,
    clearDev,
    allStructures,
    structures,
    availableStructures,
    structureUnlockedCount,
    structureTotalCount,
    devAllStructures,
    toggleDevAllStructures,
    coinBalance,
    canAfford,
    purchase,
    refund,
    focusMultiplier,
    activePairs,
    pairsForBuilding,
    allVillagers,
    availableVillagers,
    canAffordVillager,
    purchaseVillager,
    refundVillager,
    devVillagerShop,
    toggleDevVillagerShop,
  } = useVillage();
  const [shopTab, setShopTab] = useState<"buildings" | "villagers">(
    "buildings"
  );
  React.useEffect(() => {
    if (!devVillagerShop && shopTab === "villagers") setShopTab("buildings");
  }, [devVillagerShop, shopTab]);

  const obstacles = React.useMemo(
    () =>
      structures.map((s) => ({
        x: s.position[0],
        z: s.position[1],
        r: FOOTPRINT[s.kind] || 1,
      })),
    [structures]
  );

  const {
    seenVillagers,
    seenStructures,
    camera: savedCamera,
    markVillagerSeen,
    markStructureSeen,
    markAllSeen,
    setCamera,
    loaded: stateLoaded,
  } = useVillageState();

  // Use raw real-villager id (strip "real-" prefix) for seen tracking.
  const realIdOf = (vid: string) =>
    vid.startsWith("real-") ? vid.slice(5) : vid;

  const newVillagerIds = React.useMemo(() => {
    if (!stateLoaded) return new Set<string>();
    const out = new Set<string>();
    for (const v of villagers) {
      if (v.source !== "unlocked") continue;
      const rid = realIdOf(v.id);
      if (!seenVillagers.has(rid)) out.add(v.id);
    }
    return out;
  }, [villagers, seenVillagers, stateLoaded]);

  const newStructureIds = React.useMemo(() => {
    if (!stateLoaded) return new Set<string>();
    const out = new Set<string>();
    for (const s of structures) {
      if (!seenStructures.has(s.id)) out.add(s.id);
    }
    return out;
  }, [structures, seenStructures, stateLoaded]);

  // Build-in animation: any structure that appears since last render plays a
  // rise+scale tween for 1.3s. Skipped on first mount (initial load).
  const [buildingIds, setBuildingIds] = useState<Set<string>>(new Set());
  const prevStructIds = React.useRef<Set<string> | null>(null);
  React.useEffect(() => {
    const current = new Set(structures.map((s) => s.id));
    if (prevStructIds.current === null) {
      prevStructIds.current = current;
      return;
    }
    const newly: string[] = [];
    for (const id of current) {
      if (!prevStructIds.current.has(id)) newly.push(id);
    }
    prevStructIds.current = current;
    if (newly.length === 0) return;
    setBuildingIds((prev) => {
      const next = new Set(prev);
      for (const id of newly) next.add(id);
      return next;
    });
    const timers = newly.map((id) =>
      window.setTimeout(() => {
        setBuildingIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 2000)
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [structures]);

  const hasNew = newVillagerIds.size > 0 || newStructureIds.size > 0;

  // Locked to noon — TOD controls removed for a static daylight scene.
  const tod = 0.5;
  const day = 1;

  const sunPos = sunPositionFor(tod);

  // Selection: which entity is in info popup.
  const [selected, setSelected] = useState<
    | { kind: "villager"; v: VillagerInstance }
    | { kind: "structure"; s: StructureDef }
    | { kind: "shop"; s: StructureDef }
    | null
  >(null);
  const [shopOpen, setShopOpen] = useState(false);

  return (
    <div className="village-view">
      <div className="village-hud">
        <div className="village-hud-cluster village-hud-left">
          <button
            type="button"
            className="village-hud-back"
            onClick={() => setView("main")}
            aria-label="Back to planner"
            title="Back to planner"
          >
            ←
          </button>
          <div className="village-hud-title">
            <span className="village-hud-title-emoji">🏘️</span>
            <span className="village-hud-title-text">Village</span>
          </div>
        </div>

        <div className="village-hud-cluster village-hud-center">
          <div className="village-hud-stat" title="Buildings purchased">
            <span className="village-hud-stat-icon">🏠</span>
            <div className="village-hud-stat-body">
              <div className="village-hud-stat-value">
                {structureUnlockedCount}
                <span className="village-hud-stat-total">
                  /{structureTotalCount}
                </span>
              </div>
              <div className="village-hud-stat-bar">
                <div
                  className="village-hud-stat-bar-fill village-hud-stat-bar-bldg"
                  style={{
                    width: `${
                      (structureUnlockedCount / structureTotalCount) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="village-hud-stat" title="Villagers recruited">
            <span className="village-hud-stat-icon">👥</span>
            <div className="village-hud-stat-body">
              <div className="village-hud-stat-value">
                {unlockedCount}
                <span className="village-hud-stat-total">
                  /{totalCount}
                </span>
              </div>
              <div className="village-hud-stat-bar">
                <div
                  className="village-hud-stat-bar-fill village-hud-stat-bar-vill"
                  style={{
                    width: `${(unlockedCount / totalCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="village-hud-cluster village-hud-right">
          <div className="village-hud-coins" title="Coin balance">
            <span className="village-hud-coins-icon">🪙</span>
            <span className="village-hud-coins-value">
              {coinBalance.toLocaleString()}
            </span>
          </div>
          {focusMultiplier > 1 && (
            <div
              className="village-hud-mult"
              title={`Villager synergy: ${activePairs.length} active pair${
                activePairs.length === 1 ? "" : "s"
              }`}
            >
              <span>⚡</span>
              <span>×{focusMultiplier.toFixed(2)}</span>
            </div>
          )}
          {hasNew && (
            <button
              type="button"
              className="village-hud-ack"
              title="Acknowledge new items"
              onClick={() =>
                markAllSeen(
                  villagers
                    .filter((v) => v.source === "unlocked")
                    .map((v) => realIdOf(v.id)),
                  structures.map((s) => s.id)
                )
              }
            >
              🔔 {newVillagerIds.size + newStructureIds.size}
            </button>
          )}
          <button
            type="button"
            className="village-hud-shop"
            onClick={() => setShopOpen((o) => !o)}
            title="Open shop"
          >
            🏪 <span>Shop</span>
          </button>
        </div>
      </div>

      <div className="village-dev-panel">
        <span className="village-dev-label">Dev</span>
        <button className="village-dev-btn primary" onClick={addDevVillager}>
          + Add villager
        </button>
        <button
          className="village-dev-btn"
          onClick={removeLastDev}
          disabled={devExtras === 0}
        >
          − Remove last
        </button>
        <button
          className="village-dev-btn ghost"
          onClick={clearDev}
          disabled={devExtras === 0}
        >
          Clear
        </button>
        <span className="village-dev-divider" />
        <button
          className={`village-dev-btn ${devAllStructures ? "primary" : ""}`}
          onClick={toggleDevAllStructures}
          title="Show all buildings regardless of purchase"
        >
          {devAllStructures ? "Show-all ✓" : "Show all"}
        </button>
        <button
          className={`village-dev-btn ${devVillagerShop ? "primary" : ""}`}
          onClick={toggleDevVillagerShop}
          title="Allow buying villagers (dev / testing)"
        >
          {devVillagerShop ? "Buy villagers ✓" : "Buy villagers"}
        </button>
        <button
          className="village-dev-btn danger"
          onClick={() => {
            for (const s of allStructures) refund(s.id);
            for (const v of allVillagers) refundVillager(v.id);
          }}
          title="Refund every purchased building + villager (testing)"
        >
          Sell all
        </button>
      </div>

      {shopOpen && (
        <div className="village-shop-panel">
          <div className="village-shop-header">
            <div className="village-shop-title">
              <span>🏪 Village Shop</span>
              <span className="village-shop-title-coins">
                🪙 {coinBalance.toLocaleString()}
              </span>
            </div>
            <button
              className="village-shop-close"
              onClick={() => setShopOpen(false)}
              aria-label="Close shop"
            >
              ×
            </button>
          </div>
          <div className="village-shop-tabs">
            <button
              className={`village-shop-tab ${
                shopTab === "buildings" ? "village-shop-tab-on" : ""
              }`}
              onClick={() => setShopTab("buildings")}
            >
              🏠 Buildings
            </button>
            {devVillagerShop && (
              <button
                className={`village-shop-tab ${
                  shopTab === "villagers" ? "village-shop-tab-on" : ""
                }`}
                onClick={() => setShopTab("villagers")}
              >
                👤 Villagers <span className="village-shop-tab-dev">dev</span>
              </button>
            )}
          </div>
          <div className="village-shop-body">
            {shopTab === "buildings" &&
              (availableStructures.length === 0 ? (
                <div className="village-shop-empty">
                  <div className="village-shop-empty-emoji">🎉</div>
                  <div>Every plot has been built!</div>
                </div>
              ) : (
                availableStructures.map((s) => {
                  const afford = canAfford(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`village-shop-item ${
                        afford ? "" : "village-shop-item-disabled"
                      }`}
                    >
                      <div
                        className="village-shop-item-icon"
                        style={{ background: s.color }}
                      >
                        🏠
                      </div>
                      <div className="village-shop-item-info">
                        <div className="village-shop-item-name">{s.name}</div>
                        <div className="village-shop-item-kind">
                          {structureKindLabel(s.kind)}
                        </div>
                      </div>
                      <button
                        className="village-shop-item-buy"
                        disabled={!afford}
                        onClick={() => purchase(s.id)}
                      >
                        🪙 {s.cost.toLocaleString()}
                      </button>
                    </div>
                  );
                })
              ))}
            {shopTab === "villagers" &&
              (availableVillagers.length === 0 ? (
                <div className="village-shop-empty">
                  <div className="village-shop-empty-emoji">👋</div>
                  <div>All villagers have moved in!</div>
                </div>
              ) : (
                availableVillagers.map((v) => {
                  const afford = canAffordVillager(v.id);
                  const pair = VILLAGER_PAIRS[v.id];
                  return (
                    <div
                      key={v.id}
                      className={`village-shop-item ${
                        afford ? "" : "village-shop-item-disabled"
                      }`}
                    >
                      <div
                        className={`village-shop-item-icon rarity-${v.rarity}`}
                      >
                        {v.emoji}
                      </div>
                      <div className="village-shop-item-info">
                        <div className="village-shop-item-name">
                          {v.name}
                          {v.rarity !== "common" && (
                            <span
                              className={`village-shop-item-rarity rarity-${v.rarity}`}
                            >
                              {v.rarity}
                            </span>
                          )}
                          {pair && (
                            <span className="village-shop-item-pair">
                              ⚡+{pair.bonusPct}%
                            </span>
                          )}
                        </div>
                        <div className="village-shop-item-kind">{v.title}</div>
                      </div>
                      <button
                        className="village-shop-item-buy"
                        disabled={!afford}
                        onClick={() => purchaseVillager(v.id)}
                      >
                        🪙 {v.cost.toLocaleString()}
                      </button>
                    </div>
                  );
                })
              ))}
          </div>
        </div>
      )}

      {selected && (
        <div
          className="village-info-overlay"
          onClick={() => setSelected(null)}
        >
          <div
            className="village-info-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="village-info-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              ×
            </button>
            {selected.kind === "villager" && (
              <>
                <div className="village-info-icon" style={{ background: selected.v.color }}>
                  {selected.v.emoji}
                </div>
                <div className="village-info-name">{selected.v.name}</div>
                <div className="village-info-title">{selected.v.title}</div>
                <div className={`village-info-rarity rarity-${selected.v.rarity}`}>
                  {selected.v.rarity}
                </div>
                {(() => {
                  const rid = realIdOf(selected.v.id);
                  const pair = VILLAGER_PAIRS[rid];
                  if (!pair) return null;
                  const building = allStructures.find(
                    (s) => s.id === pair.buildingId
                  );
                  const active = activePairs.some(
                    (p) => p.villagerId === rid
                  );
                  return (
                    <div className="village-bonus-list">
                      <div className="village-bonus-title">
                        ⚡ Pairs with {building?.name ?? pair.buildingId}
                      </div>
                      <div
                        className={`village-bonus-row ${
                          active ? "village-bonus-active" : "village-bonus-idle"
                        }`}
                      >
                        <span className="village-bonus-name">
                          {active ? "Active" : "Inactive — build it"}
                        </span>
                        <span className="village-bonus-pct">
                          +{pair.bonusPct}%
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            {selected.kind === "structure" && (
              <>
                <div
                  className="village-info-icon"
                  style={{ background: selected.s.color }}
                >
                  🏠
                </div>
                <div className="village-info-name">{selected.s.name}</div>
                <div className="village-info-title">
                  {structureKindLabel(selected.s.kind)}
                </div>
                {(() => {
                  const pairs = pairsForBuilding.get(selected.s.id) || [];
                  if (pairs.length === 0) return null;
                  const totalPct = pairs.reduce((a, p) => a + p.bonusPct, 0);
                  return (
                    <div className="village-bonus-list">
                      <div className="village-bonus-title">
                        ⚡ +{totalPct}% coin rate
                      </div>
                      {pairs.map((p) => {
                        const v = VILLAGER_BY_ID.get(p.villagerId);
                        if (!v) return null;
                        return (
                          <div key={p.villagerId} className="village-bonus-row">
                            <span className="village-bonus-emoji">{v.emoji}</span>
                            <span className="village-bonus-name">{v.name}</span>
                            <span className="village-bonus-pct">+{p.bonusPct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
            {selected.kind === "shop" && (
              <>
                <div
                  className="village-info-icon"
                  style={{ background: selected.s.color }}
                >
                  🏗️
                </div>
                <div className="village-info-name">{selected.s.name}</div>
                <div className="village-info-title">
                  {structureKindLabel(selected.s.kind)}
                </div>
                <div className="village-shop-cost">🪙 {selected.s.cost}</div>
                <button
                  className="village-shop-buy"
                  disabled={!canAfford(selected.s.id)}
                  onClick={() => {
                    const id = selected.s.id;
                    const ok = purchase(id);
                    if (ok) setSelected(null);
                  }}
                >
                  {canAfford(selected.s.id) ? "Build" : "Not enough coins"}
                </button>
                <div className="village-shop-balance">
                  Balance: 🪙 {coinBalance}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [0, 18, 26], fov: 50 }}
        dpr={[1, 2]}
        gl={{ outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Suspense fallback={null}>
          <Sky
            sunPosition={sunPos}
            turbidity={6}
            rayleigh={1}
            mieCoefficient={0.005}
            mieDirectionalG={0.8}
          />
          <fog attach="fog" args={["#cfe8e3", 45, 110]} />
          <Lighting tod={tod} />
          <VillageTerrain />
          <VillageLake />
          <VillageEnvironment structures={structures} />
          <StreetLamps
            glow={Math.max(0, 1 - day * 1.8)}
            structures={structures.map((s) => ({ position: s.position }))}
          />
          <DecorTrees />
          <Motes count={60} />
          <Butterflies />
          {structures.some((s) => s.id === "shrine") && (
            <Smoke position={[5, 0.8, 8]} color="#e8b87a" count={8} />
          )}
          {structures.some((s) => s.id === "forge") && (
            <Smoke position={[-13, 2.4, -3]} color="#8b8b8b" count={6} />
          )}
          {structures.some((s) => s.id === "starter-house") && (
            <Smoke position={[-12, 2.8, 5]} color="#aab0b6" count={5} />
          )}
          {structures.map((s) => (
            <VillageStructure
              key={s.id}
              s={s}
              isNew={newStructureIds.has(s.id)}
              isBuilding={buildingIds.has(s.id)}
              onClick={() => {
                markStructureSeen(s.id);
                setSelected({ kind: "structure", s });
              }}
            />
          ))}
          {!devAllStructures &&
            availableStructures.map((s) => (
              <EmptyPlot
                key={`plot-${s.id}`}
                s={s}
                affordable={canAfford(s.id)}
                onClick={() => setSelected({ kind: "shop", s })}
                onBuy={() => purchase(s.id)}
              />
            ))}
          {villagers.map((v) => (
            <Villager
              key={v.id}
              v={v}
              obstacles={obstacles}
              isNew={newVillagerIds.has(v.id)}
              onClick={() => {
                if (v.source === "unlocked") markVillagerSeen(realIdOf(v.id));
                setSelected({ kind: "villager", v });
              }}
            />
          ))}
          <CameraSync savedCamera={savedCamera} onChange={setCamera} />
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.5}
            blur={2.5}
            far={20}
            scale={30}
            resolution={512}
          />
          <OrbitControls
            makeDefault
            maxPolarAngle={Math.PI / 2.2}
            minDistance={6}
            maxDistance={40}
            enableDamping
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default VillageView;
