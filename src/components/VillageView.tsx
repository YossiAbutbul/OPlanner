import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, ContactShadows, Html, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useView } from "../context/ViewContext";
import { useVillage, VillagerInstance } from "../context/VillageContext";
import { useVillageState } from "../context/VillageStateContext";
import { VillageStructure, DecorTrees, StreetLamps } from "./VillageStructures";
import { VillageEnvironment } from "./VillageEnvironment";
import { VillageTerrain, VillageLake } from "./VillageTerrain";
import { VillagerModel } from "./VillagerModel";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { StructureDef } from "../utility/structures";
import "../css/VillageView.css";

// Approximate footprint per structure kind for villager avoidance.
const FOOTPRINT: Record<StructureDef["kind"], number> = {
  house: 1.2,
  bakery: 1.4,
  tower: 0.9,
  well: 0.9,
  library: 1.7,
  forge: 1.2,
  tavern: 1.7,
  windmill: 1.0,
  shrine: 1.4,
  garden: 1.2,
};

const todLabel = (t: number): string => {
  const h = Math.floor(t * 24);
  const m = Math.floor((t * 24 - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const structureKindLabel = (k: StructureDef["kind"]): string =>
  ({
    house: "Cottage",
    bakery: "Bakery",
    tower: "Watchtower",
    well: "Well",
    library: "Library",
    forge: "Forge",
    tavern: "Tavern",
    windmill: "Windmill",
    shrine: "Shrine",
    garden: "Garden",
  }[k]);

const unlockMetricLabel = (u: StructureDef["unlock"]): string => {
  switch (u.kind) {
    case "streak":
      return `${u.days}-day streak`;
    case "totalHours":
      return `${u.hours} total hours focused`;
    case "focusCount":
      return `${u.count} focus sessions`;
    case "awards":
      return `${u.count} awards`;
    case "dailyGoalHits":
      return `${u.days} days hitting daily goal`;
  }
};

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

const randomTargetAvoiding = (
  obstacles: Array<{ x: number; z: number; r: number }>
): THREE.Vector3 => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * BOUND;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    let ok = true;
    for (const o of obstacles) {
      if (Math.hypot(x - o.x, z - o.z) < o.r + 0.6) {
        ok = false;
        break;
      }
    }
    if (ok) return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(0, 0, 0);
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
    {/* Legs */}
    <mesh ref={legLRef} position={[-0.1, 0.22, 0]} castShadow>
      <boxGeometry args={[0.14, 0.42, 0.16]} />
      <meshStandardMaterial color="#2c3e50" />
    </mesh>
    <mesh ref={legRRef} position={[0.1, 0.22, 0]} castShadow>
      <boxGeometry args={[0.14, 0.42, 0.16]} />
      <meshStandardMaterial color="#2c3e50" />
    </mesh>
    {/* Body group */}
    <group ref={bodyRef} position={[0, 0.55, 0]}>
      <mesh castShadow>
        <capsuleGeometry args={[0.28, 0.45, 6, 12]} />
        <meshStandardMaterial
          color={v.color}
          emissive={hovered ? v.color : "#000"}
          emissiveIntensity={hovered ? 0.35 : 0}
        />
      </mesh>
      <mesh ref={armLRef} position={[-0.32, 0.1, 0]} castShadow>
        <boxGeometry args={[0.1, 0.45, 0.12]} />
        <meshStandardMaterial color={v.color} />
      </mesh>
      <mesh ref={armRRef} position={[0.32, 0.1, 0]} castShadow>
        <boxGeometry args={[0.1, 0.45, 0.12]} />
        <meshStandardMaterial color={v.color} />
      </mesh>
      <mesh position={[0, 0.65, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#fde6c8" />
      </mesh>
      <mesh position={[-0.08, 0.68, 0.2]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.08, 0.68, 0.2]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 0.86, 0]} castShadow>
        <coneGeometry args={[0.24, 0.3, 12]} />
        <meshStandardMaterial color={v.color} />
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

    // Soft obstacle push: nudge away if too close to any building.
    for (const o of obstacles) {
      const ox = pos.x - o.x;
      const oz = pos.z - o.z;
      const od = Math.hypot(ox, oz);
      if (od < o.r && od > 0.001) {
        const push = (o.r - od) * 1.2;
        pos.x += (ox / od) * push * delta * 4;
        pos.z += (oz / od) * push * delta * 4;
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
      {v.modelUrl ? (
        <ModelErrorBoundary
          fallback={
            <ProceduralBody
              v={v}
              hovered={hovered}
              bodyRef={body}
              armLRef={armL}
              armRRef={armR}
              legLRef={legL}
              legRRef={legR}
            />
          }
        >
          <Suspense
            fallback={
              <ProceduralBody
                v={v}
                hovered={hovered}
                bodyRef={body}
                armLRef={armL}
                armRRef={armR}
                legLRef={legL}
                legRRef={legR}
              />
            }
          >
            <VillagerModel url={v.modelUrl} color={v.color} scale={0.75} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        <ProceduralBody
          v={v}
          hovered={hovered}
          bodyRef={body}
          armLRef={armL}
          armRRef={armR}
          legLRef={legL}
          legRRef={legR}
        />
      )}
      {/* Name tag */}
      <Html
        position={[0, 1.95, 0]}
        center
        distanceFactor={10}
        occlude={false}
        zIndexRange={[10, 0]}
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
    structures,
    structureUnlockedCount,
    structureTotalCount,
    devAllStructures,
    toggleDevAllStructures,
  } = useVillage();

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

  const hasNew = newVillagerIds.size > 0 || newStructureIds.size > 0;

  // Time of day: 0..1 (0.5 = noon). Auto-advance unless paused.
  const [tod, setTod] = useState(0.5);
  const [todPaused, setTodPaused] = useState(true);
  useEffect(() => {
    if (todPaused) return;
    const id = window.setInterval(() => {
      setTod((t) => (t + 0.0025) % 1);
    }, 120);
    return () => window.clearInterval(id);
  }, [todPaused]);

  const day = Math.max(0, Math.sin(tod * Math.PI * 2 - Math.PI / 2));
  const isNight = day < 0.08;

  const sunPos = sunPositionFor(tod);

  // Selection: which entity is in info popup.
  const [selected, setSelected] = useState<
    | { kind: "villager"; v: VillagerInstance }
    | { kind: "structure"; s: StructureDef }
    | null
  >(null);

  return (
    <div className="village-view">
      <div className="village-view-topbar">
        <button
          type="button"
          className="village-back-btn"
          onClick={() => setView("main")}
          aria-label="Back to planner"
        >
          ← Back
        </button>
        <div className="village-view-title">Village</div>
        <div className="village-view-stage-row">
          {hasNew && (
            <button
              type="button"
              className="village-ack-btn"
              onClick={() =>
                markAllSeen(
                  villagers
                    .filter((v) => v.source === "unlocked")
                    .map((v) => realIdOf(v.id)),
                  structures.map((s) => s.id)
                )
              }
            >
              Acknowledge {newVillagerIds.size + newStructureIds.size} new
            </button>
          )}
          <div className="village-view-stage">
            {unlockedCount}/{totalCount} villagers · {structureUnlockedCount}/
            {structureTotalCount} buildings
            {devExtras > 0 && ` · +${devExtras} dev`}
          </div>
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
          title="Show all buildings regardless of unlock"
        >
          {devAllStructures ? "All buildings ✓" : "Show all buildings"}
        </button>
      </div>

      <div className="village-tod-panel">
        <button
          className="village-tod-btn"
          onClick={() => setTodPaused((p) => !p)}
          title={todPaused ? "Auto cycle" : "Pause time"}
        >
          {todPaused ? "▶" : "⏸"}
        </button>
        <input
          type="range"
          className="village-tod-slider"
          min={0}
          max={1}
          step={0.005}
          value={tod}
          onChange={(e) => {
            setTodPaused(true);
            setTod(parseFloat(e.target.value));
          }}
        />
        <div className="village-tod-label">
          {todLabel(tod)}
        </div>
      </div>

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
            {selected.kind === "villager" ? (
              <>
                <div className="village-info-icon" style={{ background: selected.v.color }}>
                  {selected.v.emoji}
                </div>
                <div className="village-info-name">{selected.v.name}</div>
                <div className="village-info-title">{selected.v.title}</div>
                <div className={`village-info-rarity rarity-${selected.v.rarity}`}>
                  {selected.v.rarity}
                </div>
              </>
            ) : (
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
                <div className="village-info-unlock">
                  Unlock: {unlockMetricLabel(selected.s.unlock)}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {unlockedCount === 0 && devExtras === 0 && (
        <div className="village-empty-overlay">
          <div className="village-empty-card">
            <div className="village-empty-title">Your village is empty</div>
            <div className="village-empty-body">
              Complete a focus session to recruit your first villager.
            </div>
          </div>
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [14, 12, 14], fov: 50 }}
        dpr={[1, 2]}
        gl={{ outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Suspense fallback={null}>
          <Sky
            sunPosition={sunPos}
            turbidity={isNight ? 0.1 : 6}
            rayleigh={isNight ? 0.05 : 1}
            mieCoefficient={0.005}
            mieDirectionalG={0.8}
          />
          {isNight && <Stars radius={120} depth={50} count={2500} factor={3} fade speed={1} />}
          <Lighting tod={tod} />
          <VillageTerrain />
          <VillageLake />
          <VillageEnvironment structures={structures} />
          <StreetLamps
            glow={Math.max(0, 1 - day * 1.8)}
            structures={structures.map((s) => ({ position: s.position }))}
          />
          <DecorTrees />
          {structures.map((s) => (
            <VillageStructure
              key={s.id}
              s={s}
              isNew={newStructureIds.has(s.id)}
              onClick={() => {
                markStructureSeen(s.id);
                setSelected({ kind: "structure", s });
              }}
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
