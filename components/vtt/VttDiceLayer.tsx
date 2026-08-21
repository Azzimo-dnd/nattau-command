"use client";

import { useFrame } from "@react-three/fiber";
import {
  CuboidCollider,
  MeshCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Quaternion, Vector3 } from "three";
import {
  displayFaceValue,
  getDieDefinition,
  getFaceMaterialSide,
  getLabelTexture,
  resultFaceValue,
} from "@/components/dice-physics/diceGeometry";
import {
  getDiceCosmetic,
  getDiceNumberScale,
  getDiceSurfaceTexture,
} from "@/components/dice-physics/diceCosmetics";
import type {
  DiceSimulationProfileId,
  PhysicsDieRequest,
  PhysicsDieResult,
  PhysicsRollRequest,
  PhysicsRollResult,
} from "@/components/dice-physics/dicePhysicsTypes";

const MAX_AUTOMATIC_REROLLS = 2;
const SETTLE_CONFIRMATION_MS = 260;
const ROLL_WATCHDOG_MS = 9_000;
const MAX_SAFETY_RESCUES = 3;

type VttDiceProfile = {
  id: DiceSimulationProfileId;
  dieScale: number;
};

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

function getVttProfile(count: number): VttDiceProfile {
  if (count <= 4) return { id: "showcase", dieScale: 0.28 };
  if (count <= 8) return { id: "standard", dieScale: 0.25 };
  return { id: "crowded", dieScale: 0.225 };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = hashString(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(random: () => number, minimum: number, maximum: number) {
  return minimum + (maximum - minimum) * random();
}

function spawnGrid(index: number, count: number, width: number, height: number) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const spreadX = Math.max(0.35, Math.min(2.8, width * 0.1));
  const spreadZ = Math.max(0.35, Math.min(2.2, height * 0.1));
  const x = columns === 1 ? 0 : -spreadX + (2 * spreadX * column) / (columns - 1);
  const z = rows === 1 ? 0 : -spreadZ + (2 * spreadZ * row) / (rows - 1);
  return { x, z, row };
}

function createSpawn(
  spec: PhysicsDieRequest,
  dieIndex: number,
  count: number,
  request: PhysicsRollRequest,
  sceneWidth: number,
  sceneHeight: number,
  generation = 0,
  automaticRerolls = 0,
  safetyRescues = 0,
): SpawnedDie {
  const profile = getVttProfile(count);
  const grid = spawnGrid(dieIndex, count, sceneWidth, sceneHeight);
  const random = seededRandom(`${request.rollId}:${spec.id}:${generation}:${safetyRescues}`);
  const rescueMultiplier = Math.max(0.42, Math.pow(0.74, safetyRescues));
  const horizontalStrength = randomBetween(random, 0.22, 0.34) * request.settings.throwForce * rescueMultiplier;
  const angle = randomBetween(random, 0, Math.PI * 2);
  const torqueScale = request.settings.spinForce * 0.16 * rescueMultiplier;

  return {
    spec,
    generation,
    automaticRerolls,
    safetyRescues,
    scale: profile.dieScale,
    position: [
      grid.x + randomBetween(random, -0.14, 0.14),
      1.65 + (grid.row % 3) * 0.12 + randomBetween(random, 0, 0.3),
      grid.z + randomBetween(random, -0.14, 0.14),
    ],
    rotation: [
      randomBetween(random, 0, Math.PI * 2),
      randomBetween(random, 0, Math.PI * 2),
      randomBetween(random, 0, Math.PI * 2),
    ],
    impulse: {
      x: Math.cos(angle) * horizontalStrength,
      y: randomBetween(random, 0.16, 0.24) * request.settings.throwForce * rescueMultiplier,
      z: Math.sin(angle) * horizontalStrength,
    },
    torque: {
      x: randomBetween(random, -1, 1) * torqueScale,
      y: randomBetween(random, -1, 1) * torqueScale,
      z: randomBetween(random, -1, 1) * torqueScale,
    },
  };
}

function VttDiceVisual({ spec, request }: { spec: PhysicsDieRequest; request: PhysicsRollRequest }) {
  const definition = useMemo(() => getDieDefinition(spec.kind), [spec.kind]);
  const cosmetic = useMemo(() => getDiceCosmetic(request.settings.cosmeticId), [request.settings.cosmeticId]);
  const surfaceTexture = useMemo(() => getDiceSurfaceTexture(cosmetic.id), [cosmetic.id]);
  const labelScale = getDiceNumberScale(request.settings.numberSize);

  return (
    <group>
      <mesh geometry={definition.geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={cosmetic.baseColor}
          map={surfaceTexture ?? undefined}
          roughness={cosmetic.roughness}
          metalness={cosmetic.metalness}
          clearcoat={cosmetic.clearcoat}
          clearcoatRoughness={cosmetic.clearcoatRoughness}
          emissive={cosmetic.emissive ?? "#000000"}
          emissiveIntensity={cosmetic.emissiveIntensity ?? 0}
        />
      </mesh>
      <lineSegments geometry={definition.edges} renderOrder={8}>
        <lineBasicMaterial color={cosmetic.edgeColor} transparent opacity={0.88} depthWrite={false} />
      </lineSegments>
      {definition.labels.map((face, labelIndex) => {
        const display = displayFaceValue(face.value, spec.percentilePart);
        const texture = getLabelTexture(
          definition.kind,
          display,
          cosmetic.numberColor,
          cosmetic.numberOutlineColor,
          request.settings.numberSize,
        );
        const size = definition.labelSize * labelScale;
        return (
          <mesh
            key={`${face.value}-${display}-${labelIndex}`}
            position={face.center}
            quaternion={face.labelQuaternion}
            renderOrder={9}
          >
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
  automaticRerolls: number,
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

function VttPhysicsDie({
  die,
  request,
  sceneWidth,
  sceneHeight,
  onSleep,
  onWake,
  onEscape,
  onImpact,
  onForcedSettle,
}: {
  die: SpawnedDie;
  request: PhysicsRollRequest;
  sceneWidth: number;
  sceneHeight: number;
  onSleep: (result: PhysicsDieResult) => void;
  onWake: (id: string) => void;
  onEscape: (id: string) => void;
  onImpact: (force: number) => void;
  onForcedSettle: () => void;
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
    onSleep(resolveDieResult(
      die.spec,
      body.rotation(),
      request.settings.cockedThreshold,
      die.automaticRerolls,
    ));
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
      position.y < -1.2
      || Math.abs(position.x) > sceneWidth / 2 + 0.8
      || Math.abs(position.z) > sceneHeight / 2 + 0.8;
    if (outOfBounds) {
      escapeReportedRef.current = true;
      onEscape(die.spec.id);
      return;
    }

    const linear = body.linvel();
    const angular = body.angvel();
    const linearSpeed = Math.hypot(linear.x, linear.y, linear.z);
    const angularSpeed = Math.hypot(angular.x, angular.y, angular.z);
    if (linearSpeed < 0.045 && angularSpeed < 0.075) {
      stableSecondsRef.current += Math.min(delta, 0.05);
      if (stableSecondsRef.current >= 0.82) {
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
      <VttDiceVisual spec={die.spec} request={request} />
    </RigidBody>
  );
}

function VttDiceBounds({ request, sceneWidth, sceneHeight }: { request: PhysicsRollRequest; sceneWidth: number; sceneHeight: number }) {
  const halfWidth = sceneWidth / 2;
  const halfHeight = sceneHeight / 2;
  const wallHeight = 4.5;
  const restitution = Math.max(0, request.settings.restitution * 0.7);

  return (
    <RigidBody type="fixed" colliders={false} name="vtt-dice-bounds">
      <CuboidCollider
        args={[halfWidth, 0.04, halfHeight]}
        position={[0, -0.04, 0]}
        friction={request.settings.trayFriction}
        restitution={restitution}
      />
      <CuboidCollider args={[halfWidth + 0.12, wallHeight, 0.08]} position={[0, wallHeight, -halfHeight - 0.05]} friction={request.settings.trayFriction} restitution={restitution} />
      <CuboidCollider args={[halfWidth + 0.12, wallHeight, 0.08]} position={[0, wallHeight, halfHeight + 0.05]} friction={request.settings.trayFriction} restitution={restitution} />
      <CuboidCollider args={[0.08, wallHeight, halfHeight + 0.12]} position={[-halfWidth - 0.05, wallHeight, 0]} friction={request.settings.trayFriction} restitution={restitution} />
      <CuboidCollider args={[0.08, wallHeight, halfHeight + 0.12]} position={[halfWidth + 0.05, wallHeight, 0]} friction={request.settings.trayFriction} restitution={restitution} />
      <CuboidCollider args={[halfWidth + 2, 0.08, halfHeight + 2]} position={[0, -2.2, 0]} friction={1.2} restitution={0.02} />
    </RigidBody>
  );
}

export function VttDiceLayer({
  request,
  sceneWidth,
  sceneHeight,
  onComplete,
  onImpact,
}: {
  request: PhysicsRollRequest;
  sceneWidth: number;
  sceneHeight: number;
  onComplete: (result: PhysicsRollResult) => void;
  onImpact: (force: number) => void;
}) {
  const profile = useMemo(() => getVttProfile(request.dice.length), [request.dice.length]);
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
    const initialDice = request.dice.map((spec, index) => createSpawn(
      spec,
      index,
      request.dice.length,
      request,
      sceneWidth,
      sceneHeight,
    ));
    asleepRef.current.clear();
    resultsRef.current.clear();
    peakImpactRef.current = 0;
    forcedSettlesRef.current = 0;
    escapeCountRef.current = 0;
    rescuedDiceRef.current = 0;
    timeoutRescuesRef.current = 0;
    completedRef.current = false;
    setDice(initialDice);
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [request, sceneHeight, sceneWidth]);

  const rescueDice = useCallback((ids: Set<string>, source: "escape" | "timeout") => {
    if (ids.size === 0 || completedRef.current) return;
    ids.forEach((id) => {
      asleepRef.current.delete(id);
      resultsRef.current.delete(id);
    });
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (source === "timeout") timeoutRescuesRef.current += ids.size;
    rescuedDiceRef.current += ids.size;
    setDice((currentDice) => currentDice.map((die, index) => {
      if (!ids.has(die.spec.id)) return die;
      const nextSafetyRescues = Math.min(MAX_SAFETY_RESCUES, die.safetyRescues + 1);
      return createSpawn(
        die.spec,
        index,
        currentDice.length,
        request,
        sceneWidth,
        sceneHeight,
        die.generation + 1,
        die.automaticRerolls,
        nextSafetyRescues,
      );
    }));
  }, [request, sceneHeight, sceneWidth]);

  useEffect(() => {
    if (completedRef.current || dice.length === 0) return;
    const timer = window.setTimeout(() => {
      if (completedRef.current) return;
      const unsettled = new Set(
        dice.filter((die) => !asleepRef.current.has(die.spec.id)).map((die) => die.spec.id),
      );
      rescueDice(unsettled, "timeout");
    }, ROLL_WATCHDOG_MS);
    return () => window.clearTimeout(timer);
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
          .map((result) => result.id),
      );
      if (cockedIds.size > 0) {
        cockedIds.forEach((id) => {
          asleepRef.current.delete(id);
          resultsRef.current.delete(id);
        });
        setDice((currentDice) => currentDice.map((die, index) => (
          cockedIds.has(die.spec.id)
            ? createSpawn(
              die.spec,
              index,
              currentDice.length,
              request,
              sceneWidth,
              sceneHeight,
              die.generation + 1,
              die.automaticRerolls + 1,
              die.safetyRescues,
            )
            : die
        )));
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
        durationMs: Math.max(0, completedAt - request.startedAt),
        dice: finalDice,
        physicalTotal: finalDice.reduce((sum, result) => sum + result.value, 0),
        peakImpact: peakImpactRef.current,
        forcedSettles: forcedSettlesRef.current,
        escapeCount: escapeCountRef.current,
        rescuedDice: rescuedDiceRef.current,
        timeoutRescues: timeoutRescuesRef.current,
        simulationProfile: profile.id,
        dieScale: profile.dieScale,
        trayWidth: sceneWidth,
        trayDepth: sceneHeight,
      });
    }, SETTLE_CONFIRMATION_MS);
  }, [dice, onComplete, profile.dieScale, profile.id, request, sceneHeight, sceneWidth]);

  const handleSleep = useCallback((result: PhysicsDieResult) => {
    asleepRef.current.add(result.id);
    resultsRef.current.set(result.id, result);
    finalizeWhenReady();
  }, [finalizeWhenReady]);

  const handleWake = useCallback((id: string) => {
    asleepRef.current.delete(id);
    resultsRef.current.delete(id);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  const handleEscape = useCallback((id: string) => {
    if (completedRef.current) return;
    escapeCountRef.current += 1;
    rescueDice(new Set([id]), "escape");
  }, [rescueDice]);

  return (
    <Physics
      key={request.rollId}
      gravity={[0, request.settings.gravity, 0]}
      colliders={false}
      debug={false}
      timeStep={1 / 60}
      interpolate
    >
      <VttDiceBounds request={request} sceneWidth={sceneWidth} sceneHeight={sceneHeight} />
      {dice.map((die) => (
        <VttPhysicsDie
          key={`${die.spec.id}-${die.generation}`}
          die={die}
          request={request}
          sceneWidth={sceneWidth}
          sceneHeight={sceneHeight}
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
  );
}
