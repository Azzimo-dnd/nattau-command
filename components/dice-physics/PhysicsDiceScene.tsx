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
  PhysicsDieRequest,
  PhysicsDieResult,
  PhysicsDieTone,
  PhysicsRollRequest,
  PhysicsRollResult,
} from "./dicePhysicsTypes";

const MAX_AUTOMATIC_REROLLS = 2;
const SETTLE_CONFIRMATION_MS = 320;

function normalizePhysicsRollRequest(
  value: PhysicsRollRequest | null
): PhysicsRollRequest | null {
  if (!value) return null;

  const candidate = value as PhysicsRollRequest & {
    settings?: PhysicsRollRequest["settings"] & {
      dieKind?: PhysicsDieRequest["kind"];
      count?: number;
    };
  };

  if (Array.isArray(candidate.dice)) {
    return candidate;
  }

  // Compatibility for a request kept alive by Next.js Fast Refresh after
  // upgrading from the original Dice Lab request shape.
  const legacyKind = candidate.settings?.dieKind;
  const legacyCount = candidate.settings?.count;

  if (
    !candidate.rollId ||
    !candidate.settings ||
    !legacyKind ||
    typeof legacyCount !== "number" ||
    !Number.isFinite(legacyCount)
  ) {
    return null;
  }

  const count = Math.min(12, Math.max(1, Math.floor(legacyCount)));

  return {
    rollId: candidate.rollId,
    startedAt:
      typeof candidate.startedAt === "number" && Number.isFinite(candidate.startedAt)
        ? candidate.startedAt
        : performance.now(),
    dice: Array.from({ length: count }, (_, index) => ({
      id: `${candidate.rollId}-${index}`,
      kind: legacyKind,
      groupIndex: 0,
      logicalDieIndex: index,
    })),
    settings: candidate.settings,
  };
}

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

type SpawnedDie = {
  spec: PhysicsDieRequest;
  generation: number;
  automaticRerolls: number;
  position: [number, number, number];
  rotation: [number, number, number];
  impulse: { x: number; y: number; z: number };
  torque: { x: number; y: number; z: number };
};

function createSpawn(
  spec: PhysicsDieRequest,
  dieIndex: number,
  count: number,
  request: PhysicsRollRequest,
  generation = 0,
  automaticRerolls = 0
): SpawnedDie {
  const columns = Math.min(8, Math.max(1, count));
  const column = dieIndex % columns;
  const row = Math.floor(dieIndex / columns);
  const laneOffset = columns === 1 ? 0 : (column / (columns - 1) - 0.5) * 7.8;
  const side = row % 2 === 0 ? 1 : -1;
  const throwForce = request.settings.throwForce;
  const spinForce = request.settings.spinForce;

  return {
    spec,
    generation,
    automaticRerolls,
    position: [
      laneOffset + randomBetween(-0.34, 0.34),
      4.1 + row * 0.72 + column * 0.08 + automaticRerolls * 0.55,
      side * (2.7 + row * 0.28 + randomBetween(0, 0.5)),
    ],
    rotation: [
      randomBetween(0, Math.PI * 2),
      randomBetween(0, Math.PI * 2),
      randomBetween(0, Math.PI * 2),
    ],
    impulse: {
      x: randomBetween(-0.75, 0.75) * throwForce,
      y: randomBetween(0.42, 0.7) * throwForce,
      z: -side * randomBetween(0.72, 1.03) * throwForce,
    },
    torque: {
      x: randomBetween(-1, 1) * spinForce,
      y: randomBetween(-1, 1) * spinForce,
      z: randomBetween(-1, 1) * spinForce,
    },
  };
}

function CameraRig({ mode }: { mode: PhysicsRollRequest["settings"]["cameraMode"] }) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    if (mode === "top") {
      camera.position.set(0, 15.2, 0.01);
      camera.lookAt(0, 0, 0);
    } else if (mode === "close") {
      camera.position.set(0, 6.3, 8.9);
      camera.lookAt(0, 0.45, 0);
    } else {
      camera.position.set(0, 9.8, 13.4);
      camera.lookAt(0, 0.2, 0);
    }
    camera.updateProjectionMatrix();
  }, [camera, mode]);
  return null;
}

function Tray({ request, theme }: { request: PhysicsRollRequest; theme: DiceLabTheme }) {
  const floorColor = theme === "barovia" ? "#2b111b" : "#1a242c";
  const wallColor = theme === "barovia" ? "#351722" : "#242a31";
  const edgeColor = theme === "barovia" ? "#6f3547" : "#7b6427";
  const trayRestitution = Math.max(0, request.settings.restitution * 0.68);

  return (
    <RigidBody type="fixed" colliders={false} name="dice-tray">
      <CuboidCollider args={[6.4, 0.22, 4.15]} position={[0, -0.22, 0]} friction={request.settings.trayFriction} restitution={trayRestitution} />
      <CuboidCollider args={[6.4, 0.62, 0.24]} position={[0, 0.38, -4.15]} friction={request.settings.trayFriction} restitution={trayRestitution} />
      <CuboidCollider args={[6.4, 0.62, 0.24]} position={[0, 0.38, 4.15]} friction={request.settings.trayFriction} restitution={trayRestitution} />
      <CuboidCollider args={[0.24, 0.62, 4.15]} position={[-6.4, 0.38, 0]} friction={request.settings.trayFriction} restitution={trayRestitution} />
      <CuboidCollider args={[0.24, 0.62, 4.15]} position={[6.4, 0.38, 0]} friction={request.settings.trayFriction} restitution={trayRestitution} />

      <mesh receiveShadow position={[0, -0.22, 0]}>
        <boxGeometry args={[12.8, 0.44, 8.3]} />
        <meshStandardMaterial color={wallColor} roughness={0.72} />
      </mesh>
      <mesh receiveShadow position={[0, 0.018, 0]}>
        <boxGeometry args={[12.35, 0.035, 7.85]} />
        <meshStandardMaterial color={floorColor} roughness={0.96} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.38, -4.15]}>
        <boxGeometry args={[12.8, 1.24, 0.48]} />
        <meshStandardMaterial color={wallColor} roughness={0.62} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.38, 4.15]}>
        <boxGeometry args={[12.8, 1.24, 0.48]} />
        <meshStandardMaterial color={wallColor} roughness={0.62} />
      </mesh>
      <mesh castShadow receiveShadow position={[-6.4, 0.38, 0]}>
        <boxGeometry args={[0.48, 1.24, 8.3]} />
        <meshStandardMaterial color={wallColor} roughness={0.62} />
      </mesh>
      <mesh castShadow receiveShadow position={[6.4, 0.38, 0]}>
        <boxGeometry args={[0.48, 1.24, 8.3]} />
        <meshStandardMaterial color={wallColor} roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.01, -4.15]}>
        <boxGeometry args={[12.85, 0.08, 0.5]} />
        <meshStandardMaterial color={edgeColor} roughness={0.48} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.01, 4.15]}>
        <boxGeometry args={[12.85, 0.08, 0.5]} />
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
          color={surfaceTexture ? material.baseColor : material.baseColor}
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
  onSleep,
  onWake,
  onImpact,
  onForcedSettle,
}: {
  die: SpawnedDie;
  request: PhysicsRollRequest;
  onSleep: (result: PhysicsDieResult) => void;
  onWake: (id: string) => void;
  onImpact: (force: number) => void;
  onForcedSettle: () => void;
}) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const stableSecondsRef = useRef(0);
  const sleepReportedRef = useRef(false);
  const definition = useMemo(() => getDieDefinition(die.spec.kind), [die.spec.kind]);

  const reportSleep = useCallback(() => {
    const body = bodyRef.current;
    if (!body || sleepReportedRef.current) return;
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
    body.applyImpulse(die.impulse, true);
    body.applyTorqueImpulse(die.torque, true);
  }, [die.generation, die.impulse, die.torque]);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body || body.isSleeping()) return;
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
      colliders={false}
      mass={massForKind(die.spec.kind)}
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
  const [dice, setDice] = useState<SpawnedDie[]>([]);
  const asleepRef = useRef(new Set<string>());
  const resultsRef = useRef(new Map<string, PhysicsDieResult>());
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peakImpactRef = useRef(0);
  const forcedSettlesRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    const initialDice = request.dice.map((spec, index) =>
      createSpawn(spec, index, request.dice.length, request)
    );
    asleepRef.current.clear();
    resultsRef.current.clear();
    peakImpactRef.current = 0;
    forcedSettlesRef.current = 0;
    completedRef.current = false;
    setDice(initialDice);
    onStatus("rolling");
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [onStatus, request]);

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
                  die.automaticRerolls + 1
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
      });
      onStatus("settled");
    }, SETTLE_CONFIRMATION_MS);
  }, [dice, onComplete, onStatus, request]);

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

  return (
    <>
      <CameraRig mode={request.settings.cameraMode} />
      <color attach="background" args={[theme === "barovia" ? "#090608" : "#090d11"]} />
      <fog attach="fog" args={[theme === "barovia" ? "#090608" : "#090d11", 14, 27]} />
      <ambientLight intensity={0.7} />
      <directionalLight castShadow position={[-5, 11, 6]} intensity={2.2} shadow-mapSize-width={1536} shadow-mapSize-height={1536} shadow-camera-near={1} shadow-camera-far={30} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={8} shadow-camera-bottom={-8} />
      <pointLight position={[5, 5, -3]} intensity={theme === "barovia" ? 1.4 : 1.05} color={theme === "barovia" ? "#b95772" : "#e2b84f"} />

      <Physics
        key={request.rollId}
        gravity={[0, request.settings.gravity, 0]}
        colliders={false}
        debug={request.settings.debug}
        timeStep={1 / 60}
        interpolate
      >
        <Tray request={request} theme={theme} />
        {dice.map((die) => (
          <PhysicsDie
            key={`${die.spec.id}-${die.generation}`}
            die={die}
            request={request}
            onSleep={handleSleep}
            onWake={handleWake}
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
  const normalizedRequest = useMemo(
    () => normalizePhysicsRollRequest(request),
    [request]
  );

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 39, near: 0.1, far: 60, position: [0, 9.8, 13.4] }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }: { gl: { setPixelRatio: (value: number) => void } }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      }}
    >
      <Suspense fallback={<LoadingScene theme={theme} />}>
        {normalizedRequest ? (
          <DiceSimulation
            request={normalizedRequest}
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
