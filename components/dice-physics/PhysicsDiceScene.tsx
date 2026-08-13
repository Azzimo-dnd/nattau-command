"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CuboidCollider,
  MeshCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Color, Quaternion, Vector3 } from "three";
import {
  displayFaceValue,
  getDieDefinition,
  getFaceMaterialSide,
  getLabelTexture,
  resultFaceValue,
} from "./diceGeometry";
import {
  getDiceCosmetic,
  getDiceNumberScale,
  getDiceSurfaceTexture,
} from "./diceCosmetics";
import type {
  DiceLabStatus,
  DiceLabTheme,
  DiceSimulationProfileId,
  PhysicsDieRequest,
  PhysicsDieResult,
  PhysicsDieTone,
  PhysicsRollRequest,
  PhysicsRollResult,
} from "./dicePhysicsTypes";

const MAX_AUTOMATIC_REROLLS = 2;
const SETTLE_CONFIRMATION_MS = 320;
const ROLL_WATCHDOG_MS = 10_000;
const MAX_SAFETY_RESCUES = 3;
const BASE_DIE_RADIUS = 1.3;

function randomUnit() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] / 0xffffffff;
  }
  return Math.random();
}

function randomBetween(minimum: number, maximum: number) {
  return minimum + (maximum - minimum) * randomUnit();
}

type SimulationProfile = {
  id: DiceSimulationProfileId;
  dieScale: number;
  halfWidth: number;
  halfDepth: number;
};

function getSimulationProfile(count: number): SimulationProfile {
  if (count <= 4) {
    return { id: "showcase", dieScale: 1, halfWidth: 6.4, halfDepth: 4.15 };
  }
  if (count <= 8) {
    return { id: "standard", dieScale: 0.9, halfWidth: 6.4, halfDepth: 4.15 };
  }
  if (count <= 12) {
    return { id: "crowded", dieScale: 0.8, halfWidth: 7.25, halfDepth: 4.7 };
  }
  if (count <= 18) {
    return { id: "mass-roll", dieScale: 0.7, halfWidth: 7.75, halfDepth: 5.1 };
  }
  return { id: "stress", dieScale: 0.64, halfWidth: 8.25, halfDepth: 5.4 };
}

type SpawnedDie = {
  spec: PhysicsDieRequest;
  generation: number;
  automaticRerolls: number;
  safetyRescues: number;
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  impulse: { x: number; y: number; z: number };
  torque: { x: number; y: number; z: number };
};

function gridCoordinates(index: number, count: number, profile: SimulationProfile) {
  const aspect = profile.halfWidth / profile.halfDepth;
  const columns = Math.min(
    count,
    Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count) * aspect)))
  );
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const margin = BASE_DIE_RADIUS * profile.dieScale + 0.72;
  const safeX = Math.max(0, profile.halfWidth - margin);
  const safeZ = Math.max(0, profile.halfDepth - margin);
  const x = columns === 1 ? 0 : -safeX + (2 * safeX * column) / (columns - 1);
  const z = rows === 1 ? 0 : -safeZ + (2 * safeZ * row) / (rows - 1);
  return { x, z, row, column };
}

function createSpawn(
  spec: PhysicsDieRequest,
  dieIndex: number,
  count: number,
  request: PhysicsRollRequest,
  generation = 0,
  automaticRerolls = 0,
  safetyRescues = 0
): SpawnedDie {
  const profile = getSimulationProfile(count);
  const grid = gridCoordinates(dieIndex, count, profile);
  const throwForce = request.settings.throwForce;
  const spinForce = request.settings.spinForce;
  const rescueMultiplier = Math.max(0.34, Math.pow(0.72, safetyRescues));
  const jitter = Math.min(0.2, 0.14 * profile.dieScale + 0.06);
  const angle = randomBetween(0, Math.PI * 2);
  const horizontalStrength = randomBetween(0.58, 0.88) * throwForce * rescueMultiplier;

  return {
    spec,
    generation,
    automaticRerolls,
    safetyRescues,
    scale: profile.dieScale,
    position: [
      grid.x + randomBetween(-jitter, jitter),
      3.25 + (grid.row % 3) * 0.16 + randomBetween(0, 0.3) + safetyRescues * 0.12,
      grid.z + randomBetween(-jitter, jitter),
    ],
    rotation: [
      randomBetween(0, Math.PI * 2),
      randomBetween(0, Math.PI * 2),
      randomBetween(0, Math.PI * 2),
    ],
    impulse: {
      x: Math.cos(angle) * horizontalStrength,
      y: randomBetween(0.36, 0.58) * throwForce * rescueMultiplier,
      z: Math.sin(angle) * horizontalStrength,
    },
    torque: {
      x: randomBetween(-1, 1) * spinForce * rescueMultiplier,
      y: randomBetween(-1, 1) * spinForce * rescueMultiplier,
      z: randomBetween(-1, 1) * spinForce * rescueMultiplier,
    },
  };
}

function CameraRig({
  mode,
  profile,
}: {
  mode: PhysicsRollRequest["settings"]["cameraMode"];
  profile: SimulationProfile;
}) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const zoom = Math.max(profile.halfWidth / 6.4, profile.halfDepth / 4.15);
    if (mode === "top") {
      camera.position.set(0, 15.2 * zoom, 0.01);
      camera.lookAt(0, 0, 0);
    } else if (mode === "close") {
      camera.position.set(0, 6.3 * zoom, 8.9 * zoom);
      camera.lookAt(0, 0.45, 0);
    } else {
      camera.position.set(0, 9.8 * zoom, 13.4 * zoom);
      camera.lookAt(0, 0.2, 0);
    }
    camera.updateProjectionMatrix();
  }, [camera, mode, profile.halfDepth, profile.halfWidth]);
  return null;
}

function Tray({
  request,
  theme,
  profile,
}: {
  request: PhysicsRollRequest;
  theme: DiceLabTheme;
  profile: SimulationProfile;
}) {
  const floorColor = theme === "barovia" ? "#2b111b" : "#1a242c";
  const wallColor = theme === "barovia" ? "#351722" : "#242a31";
  const edgeColor = theme === "barovia" ? "#6f3547" : "#7b6427";
  const trayRestitution = Math.max(0, request.settings.restitution * 0.68);
  const width = profile.halfWidth * 2;
  const depth = profile.halfDepth * 2;
  const containmentHalfHeight = 5.5;
  const containmentY = containmentHalfHeight;

  return (
    <RigidBody type="fixed" colliders={false} name="dice-tray">
      <CuboidCollider
        args={[profile.halfWidth, 0.22, profile.halfDepth]}
        position={[0, -0.22, 0]}
        friction={request.settings.trayFriction}
        restitution={trayRestitution}
      />

      {/* Visible low rim. */}
      <CuboidCollider args={[profile.halfWidth, 0.62, 0.24]} position={[0, 0.38, -profile.halfDepth]} friction={request.settings.trayFriction} restitution={trayRestitution} />
      <CuboidCollider args={[profile.halfWidth, 0.62, 0.24]} position={[0, 0.38, profile.halfDepth]} friction={request.settings.trayFriction} restitution={trayRestitution} />
      <CuboidCollider args={[0.24, 0.62, profile.halfDepth]} position={[-profile.halfWidth, 0.38, 0]} friction={request.settings.trayFriction} restitution={trayRestitution} />
      <CuboidCollider args={[0.24, 0.62, profile.halfDepth]} position={[profile.halfWidth, 0.38, 0]} friction={request.settings.trayFriction} restitution={trayRestitution} />

      {/* Invisible containment cage. The tray still looks low, but dice cannot jump the rim. */}
      <CuboidCollider args={[profile.halfWidth + 0.3, containmentHalfHeight, 0.18]} position={[0, containmentY, -profile.halfDepth - 0.28]} friction={request.settings.trayFriction} restitution={trayRestitution * 0.72} />
      <CuboidCollider args={[profile.halfWidth + 0.3, containmentHalfHeight, 0.18]} position={[0, containmentY, profile.halfDepth + 0.28]} friction={request.settings.trayFriction} restitution={trayRestitution * 0.72} />
      <CuboidCollider args={[0.18, containmentHalfHeight, profile.halfDepth + 0.3]} position={[-profile.halfWidth - 0.28, containmentY, 0]} friction={request.settings.trayFriction} restitution={trayRestitution * 0.72} />
      <CuboidCollider args={[0.18, containmentHalfHeight, profile.halfDepth + 0.3]} position={[profile.halfWidth + 0.28, containmentY, 0]} friction={request.settings.trayFriction} restitution={trayRestitution * 0.72} />

      {/* Last-resort catch floor below the tray. The watchdog will respawn anything that reaches it. */}
      <CuboidCollider args={[24, 0.16, 24]} position={[0, -2.7, 0]} friction={1.2} restitution={0.05} />

      <mesh receiveShadow position={[0, -0.22, 0]}>
        <boxGeometry args={[width, 0.44, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.72} />
      </mesh>
      <mesh receiveShadow position={[0, 0.018, 0]}>
        <boxGeometry args={[Math.max(0.5, width - 0.45), 0.035, Math.max(0.5, depth - 0.45)]} />
        <meshStandardMaterial color={floorColor} roughness={0.96} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.38, -profile.halfDepth]}>
        <boxGeometry args={[width, 1.24, 0.48]} />
        <meshStandardMaterial color={wallColor} roughness={0.62} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.38, profile.halfDepth]}>
        <boxGeometry args={[width, 1.24, 0.48]} />
        <meshStandardMaterial color={wallColor} roughness={0.62} />
      </mesh>
      <mesh castShadow receiveShadow position={[-profile.halfWidth, 0.38, 0]}>
        <boxGeometry args={[0.48, 1.24, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.62} />
      </mesh>
      <mesh castShadow receiveShadow position={[profile.halfWidth, 0.38, 0]}>
        <boxGeometry args={[0.48, 1.24, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.01, -profile.halfDepth]}>
        <boxGeometry args={[width + 0.05, 0.08, 0.5]} />
        <meshStandardMaterial color={edgeColor} roughness={0.48} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.01, profile.halfDepth]}>
        <boxGeometry args={[width + 0.05, 0.08, 0.5]} />
        <meshStandardMaterial color={edgeColor} roughness={0.48} metalness={0.08} />
      </mesh>
    </RigidBody>
  );
}

function toneMaterial(cosmeticId: string, tone: PhysicsDieTone) {
  const cosmetic = getDiceCosmetic(cosmeticId);
  const base = new Color(cosmetic.baseColor);
  const edge = new Color(cosmetic.edgeColor);
  if (tone === "hope") {
    base.lerp(new Color("#f7edcf"), 0.58);
    edge.lerp(new Color("#ffe2a1"), 0.45);
  } else if (tone === "fear") {
    base.lerp(new Color("#170710"), 0.5);
    edge.lerp(new Color("#c04b70"), 0.35);
  }
  return {
    cosmetic,
    baseColor: `#${base.getHexString()}`,
    edgeColor: `#${edge.getHexString()}`,
    numberColor:
      tone === "hope" ? "#fff5c9" : tone === "fear" ? "#ffd3df" : cosmetic.numberColor,
    numberOutline:
      tone === "hope" ? "#533a12" : tone === "fear" ? "#260713" : cosmetic.numberOutlineColor,
  };
}

function DieVisual({ spec, request }: { spec: PhysicsDieRequest; request: PhysicsRollRequest }) {
  const definition = useMemo(() => getDieDefinition(spec.kind), [spec.kind]);
  const tone = spec.tone ?? "normal";
  const material = useMemo(
    () => toneMaterial(request.settings.cosmeticId, tone),
    [request.settings.cosmeticId, tone]
  );
  const surfaceTexture = useMemo(
    () => getDiceSurfaceTexture(material.cosmetic.id),
    [material.cosmetic.id]
  );
  const labelScale = getDiceNumberScale(request.settings.numberSize);

  return (
    <group>
      <mesh geometry={definition.geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={material.baseColor}
          map={surfaceTexture ?? undefined}
          roughness={material.cosmetic.roughness}
          metalness={material.cosmetic.metalness}
          clearcoat={material.cosmetic.clearcoat}
          clearcoatRoughness={material.cosmetic.clearcoatRoughness}
          emissive={material.cosmetic.emissive ?? "#000000"}
          emissiveIntensity={material.cosmetic.emissiveIntensity ?? 0}
        />
      </mesh>
      <lineSegments geometry={definition.edges} renderOrder={3}>
        <lineBasicMaterial color={material.edgeColor} transparent opacity={0.8} depthWrite={false} />
      </lineSegments>
      {definition.labels.map((face, labelIndex) => {
        const display = displayFaceValue(face.value, spec.percentilePart);
        const texture = getLabelTexture(
          definition.kind,
          display,
          material.numberColor,
          material.numberOutline,
          request.settings.numberSize
        );
        const size = definition.labelSize * labelScale;
        return (
          <mesh key={`${face.value}-${display}-${labelIndex}`} position={face.center} quaternion={face.labelQuaternion} renderOrder={4}>
            <planeGeometry args={[size, size]} />
            <meshBasicMaterial
              map={texture}
              transparent
              alphaTest={0.055}
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-3}
              side={getFaceMaterialSide()}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function resolveDieResult(
  spec: PhysicsDieRequest,
  rotation: { x: number; y: number; z: number; w: number },
  threshold: number,
  automaticRerolls: number
): PhysicsDieResult {
  const definition = getDieDefinition(spec.kind);
  const quaternion = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
  const worldUp = new Vector3(0, 1, 0);
  const transformedNormal = new Vector3();
  let bestFace = definition.faces[0];
  let bestAlignment = -1;

  for (const face of definition.faces) {
    transformedNormal.copy(face.normal).applyQuaternion(quaternion);
    const alignment = transformedNormal.dot(worldUp);
    if (alignment > bestAlignment) {
      bestAlignment = alignment;
      bestFace = face;
    }
  }

  return {
    id: spec.id,
    kind: spec.kind,
    groupIndex: spec.groupIndex,
    logicalDieIndex: spec.logicalDieIndex,
    tone: spec.tone ?? "normal",
    percentilePart: spec.percentilePart ?? null,
    faceValue: bestFace.value,
    value: resultFaceValue(bestFace.value, spec.percentilePart),
    alignment: bestAlignment,
    cocked: bestAlignment < threshold,
    automaticRerolls,
    quaternion: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
  };
}

function massForKind(kind: PhysicsDieRequest["kind"]) {
  if (kind === "d4" || kind === "d6") return 0.28;
  if (kind === "d20") return 0.36;
  return 0.32;
}

function PhysicsDie({
  die,
  request,
  profile,
  onSleep,
  onWake,
  onImpact,
  onForcedSettle,
  onEscape,
}: {
  die: SpawnedDie;
  request: PhysicsRollRequest;
  profile: SimulationProfile;
  onSleep: (result: PhysicsDieResult) => void;
  onWake: (id: string) => void;
  onImpact: (force: number) => void;
  onForcedSettle: () => void;
  onEscape: (id: string) => void;
}) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const stableSecondsRef = useRef(0);
  const sleepReportedRef = useRef(false);
  const escapeReportedRef = useRef(false);
  const definition = useMemo(() => getDieDefinition(die.spec.kind), [die.spec.kind]);

  const reportSleep = useCallback(() => {
    const body = bodyRef.current;
    if (!body || sleepReportedRef.current || escapeReportedRef.current) return;
    sleepReportedRef.current = true;
    onSleep(
      resolveDieResult(
        die.spec,
        body.rotation(),
        request.settings.cockedThreshold,
        die.automaticRerolls
      )
    );
  }, [die.automaticRerolls, die.spec, onSleep, request.settings.cockedThreshold]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    stableSecondsRef.current = 0;
    sleepReportedRef.current = false;
    escapeReportedRef.current = false;
    body.applyImpulse(die.impulse, true);
    body.applyTorqueImpulse(die.torque, true);
  }, [die.generation, die.impulse, die.torque]);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body || body.isSleeping() || escapeReportedRef.current) return;

    const position = body.translation();
    const outOfBounds =
      position.y < -1.45 ||
      Math.abs(position.x) > profile.halfWidth + 1.35 ||
      Math.abs(position.z) > profile.halfDepth + 1.35;

    if (outOfBounds) {
      escapeReportedRef.current = true;
      onEscape(die.spec.id);
      return;
    }

    const linear = body.linvel();
    const angular = body.angvel();
    const linearSpeed = Math.hypot(linear.x, linear.y, linear.z);
    const angularSpeed = Math.hypot(angular.x, angular.y, angular.z);
    if (linearSpeed < 0.055 && angularSpeed < 0.085) {
      stableSecondsRef.current += Math.min(delta, 0.05);
      if (stableSecondsRef.current >= 0.78) {
        onForcedSettle();
        body.sleep();
        reportSleep();
      }
    } else {
      stableSecondsRef.current = 0;
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      key={`${die.spec.id}-${die.generation}`}
      name={`physics-${die.spec.kind}-${die.spec.id}`}
      position={die.position}
      rotation={die.rotation}
      scale={die.scale}
      colliders={false}
      mass={massForKind(die.spec.kind) * Math.max(0.42, die.scale ** 3)}
      ccd
      canSleep
      additionalSolverIterations={4}
      friction={request.settings.dieFriction}
      restitution={request.settings.restitution}
      linearDamping={request.settings.linearDamping}
      angularDamping={request.settings.angularDamping}
      onSleep={reportSleep}
      onWake={() => {
        stableSecondsRef.current = 0;
        sleepReportedRef.current = false;
        onWake(die.spec.id);
      }}
      onContactForce={(payload: { totalForceMagnitude: number }) => onImpact(payload.totalForceMagnitude)}
    >
      <MeshCollider type="hull">
        <mesh geometry={definition.geometry}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </MeshCollider>
      <DieVisual spec={die.spec} request={request} />
    </RigidBody>
  );
}

function DiceSimulation({
  request,
  theme,
  onStatus,
  onComplete,
  onImpact,
}: {
  request: PhysicsRollRequest;
  theme: DiceLabTheme;
  onStatus: (status: DiceLabStatus) => void;
  onComplete: (result: PhysicsRollResult) => void;
  onImpact: (force: number) => void;
}) {
  const profile = useMemo(() => getSimulationProfile(request.dice.length), [request.dice.length]);
  const [dice, setDice] = useState<SpawnedDie[]>([]);
  const asleepRef = useRef(new Set<string>());
  const resultsRef = useRef(new Map<string, PhysicsDieResult>());
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peakImpactRef = useRef(0);
  const forcedSettlesRef = useRef(0);
  const escapeCountRef = useRef(0);
  const rescuedDiceRef = useRef(0);
  const timeoutRescuesRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    const initialDice = request.dice.map((spec, index) =>
      createSpawn(spec, index, request.dice.length, request)
    );
    asleepRef.current.clear();
    resultsRef.current.clear();
    peakImpactRef.current = 0;
    forcedSettlesRef.current = 0;
    escapeCountRef.current = 0;
    rescuedDiceRef.current = 0;
    timeoutRescuesRef.current = 0;
    completedRef.current = false;
    setDice(initialDice);
    onStatus("rolling");
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [onStatus, request]);

  const rescueDice = useCallback(
    (ids: Set<string>, source: "escape" | "timeout") => {
      if (ids.size === 0 || completedRef.current) return;
      ids.forEach((id) => {
        asleepRef.current.delete(id);
        resultsRef.current.delete(id);
      });
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (source === "timeout") timeoutRescuesRef.current += ids.size;
      rescuedDiceRef.current += ids.size;
      onStatus("rerolling");
      setDice((currentDice) =>
        currentDice.map((die, index) => {
          if (!ids.has(die.spec.id)) return die;
          const nextSafetyRescues = Math.min(MAX_SAFETY_RESCUES, die.safetyRescues + 1);
          return createSpawn(
            die.spec,
            index,
            currentDice.length,
            request,
            die.generation + 1,
            die.automaticRerolls,
            nextSafetyRescues
          );
        })
      );
    },
    [onStatus, request]
  );

  useEffect(() => {
    if (completedRef.current || dice.length === 0) return;
    const timer = setTimeout(() => {
      if (completedRef.current) return;
      const unsettled = new Set(
        dice
          .filter((die) => !asleepRef.current.has(die.spec.id))
          .map((die) => die.spec.id)
      );
      rescueDice(unsettled, "timeout");
    }, ROLL_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [dice, rescueDice]);

  const finalizeWhenReady = useCallback(() => {
    if (completedRef.current || asleepRef.current.size !== dice.length || dice.length === 0) return;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);

    settleTimerRef.current = setTimeout(() => {
      if (completedRef.current || asleepRef.current.size !== dice.length) return;
      const orderedResults = dice
        .map((die) => resultsRef.current.get(die.spec.id))
        .filter((result): result is PhysicsDieResult => Boolean(result));
      if (orderedResults.length !== dice.length) return;

      const cockedIds = new Set(
        orderedResults
          .filter((result) => result.cocked && result.automaticRerolls < MAX_AUTOMATIC_REROLLS)
          .map((result) => result.id)
      );

      if (cockedIds.size > 0) {
        onStatus("rerolling");
        cockedIds.forEach((id) => {
          asleepRef.current.delete(id);
          resultsRef.current.delete(id);
        });
        setDice((currentDice) =>
          currentDice.map((die, index) =>
            cockedIds.has(die.spec.id)
              ? createSpawn(
                  die.spec,
                  index,
                  currentDice.length,
                  request,
                  die.generation + 1,
                  die.automaticRerolls + 1,
                  die.safetyRescues
                )
              : die
          )
        );
        return;
      }

      completedRef.current = true;
      const completedAt = performance.now();
      const finalDice = orderedResults.map((result) => ({
        ...result,
        cocked: result.cocked && result.automaticRerolls >= MAX_AUTOMATIC_REROLLS,
      }));
      onComplete({
        rollId: request.rollId,
        startedAt: request.startedAt,
        completedAt,
        durationMs: completedAt - request.startedAt,
        dice: finalDice,
        physicalTotal: finalDice.reduce((sum, result) => sum + result.value, 0),
        peakImpact: peakImpactRef.current,
        forcedSettles: forcedSettlesRef.current,
        escapeCount: escapeCountRef.current,
        rescuedDice: rescuedDiceRef.current,
        timeoutRescues: timeoutRescuesRef.current,
        simulationProfile: profile.id,
        dieScale: profile.dieScale,
        trayWidth: profile.halfWidth * 2,
        trayDepth: profile.halfDepth * 2,
      });
      onStatus("settled");
    }, SETTLE_CONFIRMATION_MS);
  }, [dice, onComplete, onStatus, profile, request]);

  const handleSleep = useCallback(
    (result: PhysicsDieResult) => {
      asleepRef.current.add(result.id);
      resultsRef.current.set(result.id, result);
      finalizeWhenReady();
    },
    [finalizeWhenReady]
  );

  const handleWake = useCallback((id: string) => {
    asleepRef.current.delete(id);
    resultsRef.current.delete(id);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  const handleEscape = useCallback(
    (id: string) => {
      if (completedRef.current) return;
      escapeCountRef.current += 1;
      rescueDice(new Set([id]), "escape");
    },
    [rescueDice]
  );

  const zoom = Math.max(profile.halfWidth / 6.4, profile.halfDepth / 4.15);

  return (
    <>
      <CameraRig mode={request.settings.cameraMode} profile={profile} />
      <color attach="background" args={[theme === "barovia" ? "#090608" : "#090d11"]} />
      <fog attach="fog" args={[theme === "barovia" ? "#090608" : "#090d11", 14 * zoom, 27 * zoom]} />
      <ambientLight intensity={0.7} />
      <directionalLight castShadow position={[-5, 11, 6]} intensity={2.2} shadow-mapSize-width={1536} shadow-mapSize-height={1536} shadow-camera-near={1} shadow-camera-far={35} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={9} shadow-camera-bottom={-9} />
      <pointLight position={[5, 5, -3]} intensity={theme === "barovia" ? 1.4 : 1.05} color={theme === "barovia" ? "#b95772" : "#e2b84f"} />

      <Physics
        key={request.rollId}
        gravity={[0, request.settings.gravity, 0]}
        colliders={false}
        debug={request.settings.debug}
        timeStep={1 / 60}
        interpolate
      >
        <Tray request={request} theme={theme} profile={profile} />
        {dice.map((die) => (
          <PhysicsDie
            key={`${die.spec.id}-${die.generation}`}
            die={die}
            request={request}
            profile={profile}
            onSleep={handleSleep}
            onWake={handleWake}
            onEscape={handleEscape}
            onImpact={(force) => {
              peakImpactRef.current = Math.max(peakImpactRef.current, force);
              onImpact(force);
            }}
            onForcedSettle={() => {
              forcedSettlesRef.current += 1;
            }}
          />
        ))}
      </Physics>
    </>
  );
}

function LoadingScene({ theme }: { theme: DiceLabTheme }) {
  return (
    <>
      <color attach="background" args={[theme === "barovia" ? "#090608" : "#090d11"]} />
      <ambientLight intensity={0.8} />
    </>
  );
}

export function PhysicsDiceScene({
  request,
  theme,
  onStatus,
  onComplete,
  onImpact,
}: {
  request: PhysicsRollRequest | null;
  theme: DiceLabTheme;
  onStatus: (status: DiceLabStatus) => void;
  onComplete: (result: PhysicsRollResult) => void;
  onImpact: (force: number) => void;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 39, near: 0.1, far: 80, position: [0, 9.8, 13.4] }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }: { gl: { setPixelRatio: (value: number) => void } }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      }}
    >
      <Suspense fallback={<LoadingScene theme={theme} />}>
        {request ? (
          <DiceSimulation
            request={request}
            theme={theme}
            onStatus={onStatus}
            onComplete={onComplete}
            onImpact={onImpact}
          />
        ) : (
          <LoadingScene theme={theme} />
        )}
      </Suspense>
    </Canvas>
  );
}
