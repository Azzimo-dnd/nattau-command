"use client";

import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createClient } from "@/lib/supabase/client";
import { applyMiniaturePaintDocumentToGeometry, parseMiniaturePaintDocument } from "@/components/miniatures/miniaturePaintData";
import { loadMiniatureGeometry } from "@/components/miniatures/miniatureModelFiles";
import type { PhysicsRollRequest, PhysicsRollResult } from "@/components/dice-physics/dicePhysicsTypes";
import { VttDiceLayer } from "./VttDiceLayer";
import { VttFogDraftOverlay, VttFogLayer } from "./VttFogLayer";
import type {
  VttFogBaseState,
  VttFogDrawShape,
  VttFogOperation,
  VttFogPoint,
  VttFogRegion,
  VttScene,
  VttToken,
} from "./vttTypes";

export type VttToolMode = "navigate" | "ruler" | "radius" | "ping";
export type VttMeasurePoint = [number, number];
export type VttPing = { id: string; x: number; z: number };
export type VttCameraCommand = { id: number; type: "fit" | "reset" | "focus"; x?: number; z?: number };
export type VttAssetProgress = { loaded: number; failed: number; total: number };

type LoadedTokenAsset = { geometry: THREE.BufferGeometry; baseScale: number; hasColors: boolean };

type Props = {
  scene: VttScene;
  tokens: VttToken[];
  isDm: boolean;
  selectedIds: string[];
  supabase: ReturnType<typeof createClient>;
  toolMode: VttToolMode;
  measureStart: VttMeasurePoint | null;
  measureEnd: VttMeasurePoint | null;
  ping: VttPing | null;
  diceRequest: PhysicsRollRequest | null;
  cameraCommand?: VttCameraCommand | null;
  onAssetProgress?: (progress: VttAssetProgress) => void;
  fogEnabled: boolean;
  fogBaseState: VttFogBaseState;
  fogRegions: VttFogRegion[];
  fogEditing: boolean;
  fogOperation: VttFogOperation;
  fogShape: VttFogDrawShape;
  fogDraftPoints: VttFogPoint[];
  onSelect: (id: string | null, additive: boolean) => void;
  onLocalMove: (id: string, x: number, z: number) => void;
  onCommitMove: (id: string, x: number, z: number) => void;
  onMeasureStart: (point: VttMeasurePoint) => void;
  onMeasureMove: (point: VttMeasurePoint) => void;
  onMeasureEnd: (point: VttMeasurePoint) => void;
  onPing: (point: VttMeasurePoint) => void;
  onFogPointerDown: (point: VttFogPoint) => void;
  onFogPointerMove: (point: VttFogPoint) => void;
  onFogPointerUp: (point: VttFogPoint) => void;
  onDiceComplete: (result: PhysicsRollResult) => void;
  onDiceImpact: (force: number) => void;
};

const assetCache = new Map<string, Promise<LoadedTokenAsset>>();

function clampAndSnap(value: number, halfExtent: number) {
  const limit = Math.max(0.5, halfExtent - 0.5);
  return Math.max(-limit, Math.min(limit, Math.round(value)));
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.tagName === "SELECT" || element.isContentEditable;
}

function defaultCameraPosition(width: number, height: number) {
  return new THREE.Vector3(width * 0.42, Math.max(width, height) * 0.62, height * 0.72);
}

async function loadTokenAsset(supabase: ReturnType<typeof createClient>, token: VttToken): Promise<LoadedTokenAsset> {
  const key = `${token.source_kind}:${token.model_storage_path}:${token.paint_storage_path ?? "none"}`;
  const cached = assetCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const modelBucket = token.source_kind === "character" ? "character-miniatures" : "vtt-enemy-models";
    const paintBucket = token.source_kind === "character" ? "character-miniature-paints" : "vtt-enemy-paints";
    const { data: modelBlob, error: modelError } = await supabase.storage.from(modelBucket).download(token.model_storage_path);
    if (modelError) throw modelError;
    const file = new File([modelBlob], token.model_file_name, { type: modelBlob.type || (token.model_format === "glb" ? "model/gltf-binary" : "application/octet-stream") });
    const loaded = await loadMiniatureGeometry(file);
    const geometry = loaded.geometry;
    let hasColors = false;
    if (token.paint_storage_path) {
      const { data: paintBlob, error: paintError } = await supabase.storage.from(paintBucket).download(token.paint_storage_path);
      if (paintError) throw paintError;
      const document = parseMiniaturePaintDocument(JSON.parse(await paintBlob.text()) as unknown);
      hasColors = applyMiniaturePaintDocumentToGeometry(geometry, document);
    }
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) throw new Error("Could not determine token model bounds.");
    const footprint = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, 0.001);
    return { geometry, baseScale: 0.82 / footprint, hasColors };
  })().catch((error) => { assetCache.delete(key); throw error; });
  assetCache.set(key, promise);
  return promise;
}

function VttOrbitControls({ disabled, width, height, command }: { disabled: boolean; width: number; height: number; command?: VttCameraCommand | null }) {
  const { camera, gl } = useThree();
  const ref = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = false;
    controls.minDistance = 4;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.target.set(0, 0, 0);
    controls.update();
    ref.current = controls;
    let frame = 0;
    const tick = () => { controls.update(); frame = requestAnimationFrame(tick); };
    tick();

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || !ref.current || !ref.current.enabled) return;
      const key = event.key.toLowerCase();
      if (!["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) return;
      event.preventDefault();
      const active = ref.current;
      const forward = active.target.clone().sub(camera.position);
      forward.y = 0;
      if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const delta = new THREE.Vector3();
      const amount = event.shiftKey ? 2 : 0.8;
      if (key === "arrowup" || key === "w") delta.addScaledVector(forward, amount);
      if (key === "arrowdown" || key === "s") delta.addScaledVector(forward, -amount);
      if (key === "arrowright" || key === "d") delta.addScaledVector(right, amount);
      if (key === "arrowleft" || key === "a") delta.addScaledVector(right, -amount);
      camera.position.add(delta);
      active.target.add(delta);
      active.update();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); cancelAnimationFrame(frame); controls.dispose(); ref.current = null; };
  }, [camera, gl]);

  useEffect(() => { if (ref.current) ref.current.enabled = !disabled; }, [disabled]);

  useEffect(() => {
    const controls = ref.current;
    if (!controls || !command) return;
    if (command.type === "focus" && typeof command.x === "number" && typeof command.z === "number") {
      controls.target.set(command.x, 0, command.z);
      camera.position.set(command.x + 4.5, 6.5, command.z + 6.5);
    } else if (command.type === "fit") {
      const max = Math.max(width, height);
      controls.target.set(0, 0, 0);
      camera.position.set(0, max * 0.82, max * 0.64);
    } else {
      controls.target.set(0, 0, 0);
      camera.position.copy(defaultCameraPosition(width, height));
    }
    camera.lookAt(controls.target);
    controls.update();
  }, [camera, command, height, width]);

  return null;
}

function BattleGrid({ width, height, opacity }: { width: number; height: number; opacity: number }) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    const halfW = width / 2; const halfH = height / 2;
    for (let x = 0; x <= width; x += 1) { const worldX = -halfW + x; points.push(worldX, 0.006, -halfH, worldX, 0.006, halfH); }
    for (let z = 0; z <= height; z += 1) { const worldZ = -halfH + z; points.push(-halfW, 0.006, worldZ, halfW, 0.006, worldZ); }
    const next = new THREE.BufferGeometry(); next.setAttribute("position", new THREE.Float32BufferAttribute(points, 3)); return next;
  }, [height, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <lineSegments geometry={geometry}><lineBasicMaterial color="#5b7ca8" transparent opacity={opacity} depthWrite={false} /></lineSegments>;
}

function BoardBase({ width, height }: { width: number; height: number }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow><planeGeometry args={[width, height]} /><meshBasicMaterial color="#121a26" side={THREE.DoubleSide} /></mesh>;
}

function BattleMap({ scene, supabase }: { scene: VttScene; supabase: ReturnType<typeof createClient> }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true; let objectUrl: string | null = null; let loadedTexture: THREE.Texture | null = null; setTexture(null);
    if (!scene.map_storage_path) return () => undefined;
    void supabase.storage.from("vtt-maps").download(scene.map_storage_path).then(({ data, error }) => {
      if (!alive || error || !data) return;
      objectUrl = URL.createObjectURL(data);
      new THREE.TextureLoader().load(objectUrl, (next) => {
        if (!alive) { next.dispose(); return; }
        next.colorSpace = THREE.SRGBColorSpace; next.wrapS = THREE.ClampToEdgeWrapping; next.wrapT = THREE.ClampToEdgeWrapping; next.needsUpdate = true;
        loadedTexture = next; setTexture(next); if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      });
    });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); loadedTexture?.dispose(); };
  }, [scene.map_storage_path, supabase]);
  if (!texture) return null;
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[scene.map_offset_x, -0.012, scene.map_offset_z]} receiveShadow><planeGeometry args={[scene.grid_width * scene.map_scale, scene.grid_height * scene.map_scale]} /><meshBasicMaterial color="#ffffff" map={texture} opacity={scene.map_opacity} transparent={scene.map_opacity < 0.999} side={THREE.DoubleSide} /></mesh>;
}

function InteractionSurface({ width, height, onPointerDown, onPointerMove, onPointerUp }: { width: number; height: number; onPointerDown: (event: ThreeEvent<PointerEvent>) => void; onPointerMove: (event: ThreeEvent<PointerEvent>) => void; onPointerUp: (event: ThreeEvent<PointerEvent>) => void }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}><planeGeometry args={[width, height]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} /></mesh>;
}

function MeasurementOverlay({ mode, start, end }: { mode: VttToolMode; start: VttMeasurePoint | null; end: VttMeasurePoint | null }) {
  const lineGeometry = useMemo(() => {
    if (!start || !end || mode !== "ruler") return null;
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute([start[0], 0.055, start[1], end[0], 0.055, end[1]], 3)); return geometry;
  }, [end, mode, start]);
  useEffect(() => () => lineGeometry?.dispose(), [lineGeometry]);
  if (!start || !end || (mode !== "ruler" && mode !== "radius")) return null;
  const dx = end[0] - start[0]; const dz = end[1] - start[1]; const radius = Math.sqrt(dx * dx + dz * dz);
  if (mode === "ruler") return <group>{lineGeometry ? <lineSegments geometry={lineGeometry}><lineBasicMaterial color="#22d3ee" depthTest={false} /></lineSegments> : null}<mesh position={[start[0], 0.06, start[1]]}><sphereGeometry args={[0.09, 16, 12]} /><meshBasicMaterial color="#67e8f9" depthTest={false} /></mesh><mesh position={[end[0], 0.06, end[1]]}><sphereGeometry args={[0.09, 16, 12]} /><meshBasicMaterial color="#67e8f9" depthTest={false} /></mesh></group>;
  if (radius < 0.02) return null;
  return <group position={[start[0], 0.035, start[1]]}><mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[radius, 96]} /><meshBasicMaterial color="#c084fc" transparent opacity={0.11} depthWrite={false} side={THREE.DoubleSide} /></mesh><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}><ringGeometry args={[Math.max(0.01, radius - 0.025), radius + 0.025, 96]} /><meshBasicMaterial color="#d8b4fe" transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} /></mesh></group>;
}

function PingOverlay({ ping }: { ping: VttPing | null }) {
  if (!ping) return null;
  return <group key={ping.id} position={[ping.x, 0.07, ping.z]}>{[0.28, 0.48, 0.7].map((radius, index) => <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]} position={[0, index * 0.004, 0]}><ringGeometry args={[radius - 0.035, radius, 64]} /><meshBasicMaterial color="#fde047" transparent opacity={0.95 - index * 0.22} depthTest={false} depthWrite={false} side={THREE.DoubleSide} /></mesh>)}<mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.09, 16, 12]} /><meshBasicMaterial color="#fef08a" depthTest={false} /></mesh></group>;
}

function TokenNameplate({ name, size }: { name: string; size: number }) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;
    const label = name.slice(0, 42);
    context.font = "700 42px sans-serif";
    const width = Math.max(180, Math.ceil(context.measureText(label).width + 56));
    canvas.width = width; canvas.height = 74;
    context.fillStyle = "rgba(2,6,23,0.88)"; context.beginPath(); context.roundRect(2, 2, width - 4, 70, 20); context.fill();
    context.strokeStyle = "rgba(103,232,249,0.55)"; context.lineWidth = 3; context.stroke();
    context.font = "700 42px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillStyle = "#e2e8f0"; context.fillText(label, width / 2, 37);
    const next = new THREE.CanvasTexture(canvas); next.colorSpace = THREE.SRGBColorSpace; next.needsUpdate = true; return next;
  }, [name]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  const aspect = texture.image.width / texture.image.height;
  const labelHeight = Math.max(0.48, 0.5 * Math.min(2, size));
  return <sprite position={[0, 1.05 * Math.max(1, size), 0]} scale={[labelHeight * aspect, labelHeight, 1]}><spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} /></sprite>;
}

function TokenMesh({ token, selected, currentTurn, showNameplate, isDm, canDrag, supabase, onSelect, onDragStart, onAssetSettled }: { token: VttToken; selected: boolean; currentTurn: boolean; showNameplate: boolean; isDm: boolean; canDrag: boolean; supabase: ReturnType<typeof createClient>; onSelect: (id: string, additive: boolean) => void; onDragStart: (id: string) => void; onAssetSettled: (id: string, ok: boolean) => void }) {
  const [asset, setAsset] = useState<LoadedTokenAsset | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true; setAsset(null); setFailed(false);
    loadTokenAsset(supabase, token).then((next) => { if (alive) { setAsset(next); onAssetSettled(token.id, true); } }).catch(() => { if (alive) { setFailed(true); onAssetSettled(token.id, false); } });
    return () => { alive = false; };
  }, [onAssetSettled, supabase, token, token.id]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: asset?.hasColors ? 0xffffff : token.source_kind === "enemy" ? 0x93615a : 0x8f949b, roughness: 0.7, metalness: 0.06, vertexColors: Boolean(asset?.hasColors), transparent: isDm && !token.visible_to_players, opacity: isDm && !token.visible_to_players ? 0.42 : 1 }), [asset?.hasColors, isDm, token.source_kind, token.visible_to_players]);
  useEffect(() => () => material.dispose(), [material]);
  const down = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); const additive = event.shiftKey || event.ctrlKey || event.metaKey; onSelect(token.id, additive); if (isDm && canDrag && event.button === 0 && !additive) onDragStart(token.id); };
  const worldScale = (asset?.baseScale ?? 1) * token.scale * token.size_squares;
  const ringColor = token.source_kind === "enemy" ? (token.visible_to_players ? "#fb7185" : "#a855f7") : "#22d3ee";
  return <group position={[token.x, 0.02, token.z]} rotation={[0, token.rotation, 0]}>
    {currentTurn ? <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[0.5 * token.size_squares, 0.62 * token.size_squares, 64]} /><meshBasicMaterial color="#fbbf24" transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} /></mesh> : null}
    {selected ? <><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}><ringGeometry args={[0.42 * token.size_squares, 0.52 * token.size_squares, 48]} /><meshBasicMaterial color={ringColor} transparent opacity={0.9} side={THREE.DoubleSide} /></mesh><mesh position={[0, 0.045, -0.62 * token.size_squares]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.11 * token.size_squares, 0.28 * token.size_squares, 3]} /><meshBasicMaterial color={ringColor} depthTest={false} /></mesh></> : null}
    {showNameplate ? <TokenNameplate name={token.name} size={token.size_squares} /> : null}
    {asset ? <mesh geometry={asset.geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} scale={worldScale} castShadow receiveShadow onPointerDown={down} /> : <mesh onPointerDown={down} position={[0, 0.34, 0]}><cylinderGeometry args={[0.34, 0.42, 0.68, 20]} /><meshStandardMaterial color={failed ? "#7f1d1d" : token.source_kind === "enemy" ? "#7f4650" : "#53657b"} /></mesh>}
  </group>;
}

export function VttCanvas({
  scene,
  tokens,
  isDm,
  selectedIds,
  supabase,
  toolMode,
  measureStart,
  measureEnd,
  ping,
  diceRequest,
  cameraCommand,
  onAssetProgress,
  fogEnabled,
  fogBaseState,
  fogRegions,
  fogEditing,
  fogOperation,
  fogShape,
  fogDraftPoints,
  onSelect,
  onLocalMove,
  onCommitMove,
  onMeasureStart,
  onMeasureMove,
  onMeasureEnd,
  onPing,
  onFogPointerDown,
  onFogPointerMove,
  onFogPointerUp,
  onDiceComplete,
  onDiceImpact,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [assetState, setAssetState] = useState<Record<string, boolean>>({});
  const halfW = scene.grid_width / 2; const halfH = scene.grid_height / 2;

  useEffect(() => { setAssetState({}); }, [scene.id, tokens.map((token) => `${token.id}:${token.model_storage_path}:${token.paint_storage_path ?? ""}`).join("|")]);
  useEffect(() => {
    const values = Object.values(assetState);
    onAssetProgress?.({ loaded: values.filter(Boolean).length, failed: values.filter((value) => !value).length, total: tokens.length });
  }, [assetState, onAssetProgress, tokens.length]);
  const assetSettled = useCallback((id: string, ok: boolean) => setAssetState((current) => current[id] === ok ? current : { ...current, [id]: ok }), []);

  const planeDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 || diceRequest) return;
    if (fogEditing) {
      event.stopPropagation();
      onFogPointerDown([event.point.x, event.point.z]);
      return;
    }
    if (toolMode === "ping") { event.stopPropagation(); onPing([event.point.x, event.point.z]); return; }
    if (toolMode === "navigate") return;
    event.stopPropagation(); setMeasuring(true); onMeasureStart([event.point.x, event.point.z]);
  };

  const planeMove = (event: ThreeEvent<PointerEvent>) => {
    if (fogEditing && !diceRequest) {
      event.stopPropagation();
      onFogPointerMove([event.point.x, event.point.z]);
      return;
    }
    if (draggingId && isDm && !diceRequest) { event.stopPropagation(); onLocalMove(draggingId, clampAndSnap(event.point.x, halfW), clampAndSnap(event.point.z, halfH)); return; }
    if (measuring && !diceRequest && (toolMode === "ruler" || toolMode === "radius")) { event.stopPropagation(); onMeasureMove([event.point.x, event.point.z]); }
  };

  const planeUp = (event: ThreeEvent<PointerEvent>) => {
    if (fogEditing && !diceRequest) {
      event.stopPropagation();
      onFogPointerUp([event.point.x, event.point.z]);
      return;
    }
    if (draggingId && isDm && !diceRequest) { event.stopPropagation(); const id = draggingId; setDraggingId(null); onCommitMove(id, clampAndSnap(event.point.x, halfW), clampAndSnap(event.point.z, halfH)); return; }
    if (measuring && !diceRequest && (toolMode === "ruler" || toolMode === "radius")) { event.stopPropagation(); setMeasuring(false); onMeasureEnd([event.point.x, event.point.z]); }
  };

  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: defaultCameraPosition(scene.grid_width, scene.grid_height).toArray() as [number, number, number], fov: 44, near: 0.1, far: 300 }} onPointerMissed={() => { if (toolMode === "navigate" && !diceRequest && !fogEditing) onSelect(null, false); }}>
    <color attach="background" args={["#070b11"]} /><ambientLight intensity={1.25} /><directionalLight position={[12, 22, 10]} intensity={2.5} castShadow /><directionalLight position={[-12, 10, -8]} intensity={0.8} />
    <BoardBase width={scene.grid_width} height={scene.grid_height} />
    <BattleMap scene={scene} supabase={supabase} />
    <VttFogLayer width={scene.grid_width} height={scene.grid_height} enabled={fogEnabled} baseState={fogBaseState} regions={fogRegions} isDm={isDm} />
    <InteractionSurface width={scene.grid_width} height={scene.grid_height} onPointerDown={planeDown} onPointerMove={planeMove} onPointerUp={planeUp} />
    {scene.show_grid ? <BattleGrid width={scene.grid_width} height={scene.grid_height} opacity={scene.grid_opacity} /> : null}
    {fogEditing ? <VttFogDraftOverlay points={fogDraftPoints} shape={fogShape} operation={fogOperation} /> : null}
    <MeasurementOverlay mode={toolMode} start={measureStart} end={measureEnd} />
    <PingOverlay ping={ping} />
    {tokens.map((token) => <TokenMesh key={token.id} token={token} selected={selectedIds.includes(token.id)} currentTurn={scene.initiative_active && token.id === scene.initiative_current_token_id} showNameplate={scene.show_nameplates} isDm={isDm} canDrag={toolMode === "navigate" && !diceRequest && !fogEditing} supabase={supabase} onSelect={onSelect} onDragStart={(id) => setDraggingId(id)} onAssetSettled={assetSettled} />)}
    {diceRequest ? <VttDiceLayer key={diceRequest.rollId} request={diceRequest} sceneWidth={scene.grid_width} sceneHeight={scene.grid_height} onComplete={onDiceComplete} onImpact={onDiceImpact} /> : null}
    <VttOrbitControls disabled={Boolean(draggingId) || measuring || fogEditing} width={scene.grid_width} height={scene.grid_height} command={cameraCommand} />
  </Canvas>;
}
