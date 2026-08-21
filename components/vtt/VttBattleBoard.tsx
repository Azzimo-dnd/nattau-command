"use client";

import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createClient } from "@/lib/supabase/client";
import {
  applyMiniaturePaintDocumentToGeometry,
  parseMiniaturePaintDocument,
} from "@/components/miniatures/miniaturePaintData";
import { loadMiniatureGeometry } from "@/components/miniatures/miniatureModelFiles";
import type { VttEnemyModel, VttScene, VttToken } from "./vttTypes";

type Props = {
  campaignId: string;
  isDm: boolean;
};

type LoadedTokenAsset = {
  geometry: THREE.BufferGeometry;
  baseScale: number;
  hasColors: boolean;
};

type MeasureMode = "navigate" | "ruler" | "radius";
type MeasurePoint = [number, number];

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

function normalizeRotation(value: number) {
  const full = Math.PI * 2;
  return ((value % full) + full) % full;
}

async function loadTokenAsset(
  supabase: ReturnType<typeof createClient>,
  token: VttToken,
): Promise<LoadedTokenAsset> {
  const key = `${token.source_kind}:${token.model_storage_path}:${token.paint_storage_path ?? "none"}`;
  const cached = assetCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const modelBucket = token.source_kind === "character" ? "character-miniatures" : "vtt-enemy-models";
    const paintBucket = token.source_kind === "character" ? "character-miniature-paints" : "vtt-enemy-paints";
    const { data: modelBlob, error: modelError } = await supabase.storage.from(modelBucket).download(token.model_storage_path);
    if (modelError) throw modelError;

    const file = new File([modelBlob], token.model_file_name, {
      type: modelBlob.type || (token.model_format === "glb" ? "model/gltf-binary" : "application/octet-stream"),
    });
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
  })().catch((error) => {
    assetCache.delete(key);
    throw error;
  });

  assetCache.set(key, promise);
  return promise;
}

function VttOrbitControls({ disabled }: { disabled: boolean }) {
  const { camera, gl } = useThree();
  const ref = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = false;
    controls.minDistance = 4;
    controls.maxDistance = 90;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.target.set(0, 0, 0);
    controls.update();
    ref.current = controls;

    let frame = 0;
    const tick = () => {
      controls.update();
      frame = requestAnimationFrame(tick);
    };
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
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(frame);
      controls.dispose();
      ref.current = null;
    };
  }, [camera, gl]);

  useEffect(() => {
    if (ref.current) ref.current.enabled = !disabled;
  }, [disabled]);

  return null;
}

function BattleGrid({ width, height }: { width: number; height: number }) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    const halfW = width / 2;
    const halfH = height / 2;
    for (let x = 0; x <= width; x += 1) {
      const worldX = -halfW + x;
      points.push(worldX, 0.006, -halfH, worldX, 0.006, halfH);
    }
    for (let z = 0; z <= height; z += 1) {
      const worldZ = -halfH + z;
      points.push(-halfW, 0.006, worldZ, halfW, 0.006, worldZ);
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return next;
  }, [height, width]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#34455c" transparent opacity={0.78} />
    </lineSegments>
  );
}

function MeasurementOverlay({ mode, start, end }: { mode: MeasureMode; start: MeasurePoint | null; end: MeasurePoint | null }) {
  const lineGeometry = useMemo(() => {
    if (!start || !end || mode !== "ruler") return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      start[0], 0.055, start[1],
      end[0], 0.055, end[1],
    ], 3));
    return geometry;
  }, [end, mode, start]);

  useEffect(() => () => lineGeometry?.dispose(), [lineGeometry]);

  if (!start || !end || mode === "navigate") return null;

  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const radius = Math.sqrt(dx * dx + dz * dz);

  if (mode === "ruler") {
    return (
      <group>
        {lineGeometry ? (
          <lineSegments geometry={lineGeometry}>
            <lineBasicMaterial color="#22d3ee" depthTest={false} />
          </lineSegments>
        ) : null}
        <mesh position={[start[0], 0.06, start[1]]}>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshBasicMaterial color="#67e8f9" depthTest={false} />
        </mesh>
        <mesh position={[end[0], 0.06, end[1]]}>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshBasicMaterial color="#67e8f9" depthTest={false} />
        </mesh>
      </group>
    );
  }

  if (radius < 0.02) return null;
  return (
    <group position={[start[0], 0.035, start[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 96]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.11} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry args={[Math.max(0.01, radius - 0.025), radius + 0.025, 96]} />
        <meshBasicMaterial color="#d8b4fe" transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function TokenMesh({
  token,
  selected,
  isDm,
  canDrag,
  supabase,
  onSelect,
  onDragStart,
}: {
  token: VttToken;
  selected: boolean;
  isDm: boolean;
  canDrag: boolean;
  supabase: ReturnType<typeof createClient>;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
}) {
  const [asset, setAsset] = useState<LoadedTokenAsset | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setAsset(null);
    setFailed(false);
    loadTokenAsset(supabase, token)
      .then((next) => { if (alive) setAsset(next); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [supabase, token.model_storage_path, token.paint_storage_path, token.source_kind, token.model_file_name, token.model_format]);

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: asset?.hasColors ? 0xffffff : token.source_kind === "enemy" ? 0x93615a : 0x8f949b,
    roughness: 0.7,
    metalness: 0.06,
    vertexColors: Boolean(asset?.hasColors),
    transparent: isDm && !token.visible_to_players,
    opacity: isDm && !token.visible_to_players ? 0.42 : 1,
  }), [asset?.hasColors, isDm, token.source_kind, token.visible_to_players]);

  useEffect(() => () => material.dispose(), [material]);

  const down = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onSelect(token.id);
    if (isDm && canDrag && event.button === 0) onDragStart(token.id);
  };

  const worldScale = (asset?.baseScale ?? 1) * token.scale * token.size_squares;
  const ringColor = token.source_kind === "enemy" ? (token.visible_to_players ? "#fb7185" : "#a855f7") : "#22d3ee";

  return (
    <group position={[token.x, 0.02, token.z]} rotation={[0, token.rotation, 0]}>
      {selected ? (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
            <ringGeometry args={[0.42 * token.size_squares, 0.52 * token.size_squares, 48]} />
            <meshBasicMaterial color={ringColor} transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.045, 0.62 * token.size_squares]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.11 * token.size_squares, 0.28 * token.size_squares, 3]} />
            <meshBasicMaterial color={ringColor} depthTest={false} />
          </mesh>
        </>
      ) : null}
      {asset ? (
        <mesh
          geometry={asset.geometry}
          material={material}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={worldScale}
          castShadow
          receiveShadow
          onPointerDown={down}
        />
      ) : (
        <mesh onPointerDown={down} position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.34, 0.42, 0.68, 20]} />
          <meshStandardMaterial color={failed ? "#7f1d1d" : token.source_kind === "enemy" ? "#7f4650" : "#53657b"} />
        </mesh>
      )}
    </group>
  );
}

function VttCanvas({
  scene,
  tokens,
  isDm,
  selectedId,
  supabase,
  measureMode,
  measureStart,
  measureEnd,
  onSelect,
  onLocalMove,
  onCommitMove,
  onMeasureStart,
  onMeasureMove,
  onMeasureEnd,
}: {
  scene: VttScene;
  tokens: VttToken[];
  isDm: boolean;
  selectedId: string | null;
  supabase: ReturnType<typeof createClient>;
  measureMode: MeasureMode;
  measureStart: MeasurePoint | null;
  measureEnd: MeasurePoint | null;
  onSelect: (id: string | null) => void;
  onLocalMove: (id: string, x: number, z: number) => void;
  onCommitMove: (id: string, x: number, z: number) => void;
  onMeasureStart: (point: MeasurePoint) => void;
  onMeasureMove: (point: MeasurePoint) => void;
  onMeasureEnd: (point: MeasurePoint) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const halfW = scene.grid_width / 2;
  const halfH = scene.grid_height / 2;

  const planeDown = (event: ThreeEvent<PointerEvent>) => {
    if (measureMode === "navigate" || event.button !== 0) return;
    event.stopPropagation();
    setMeasuring(true);
    onMeasureStart([event.point.x, event.point.z]);
  };

  const planeMove = (event: ThreeEvent<PointerEvent>) => {
    if (draggingId && isDm) {
      event.stopPropagation();
      const x = clampAndSnap(event.point.x, halfW);
      const z = clampAndSnap(event.point.z, halfH);
      onLocalMove(draggingId, x, z);
      return;
    }
    if (measuring && measureMode !== "navigate") {
      event.stopPropagation();
      onMeasureMove([event.point.x, event.point.z]);
    }
  };

  const planeUp = (event: ThreeEvent<PointerEvent>) => {
    if (draggingId && isDm) {
      event.stopPropagation();
      const x = clampAndSnap(event.point.x, halfW);
      const z = clampAndSnap(event.point.z, halfH);
      const id = draggingId;
      setDraggingId(null);
      onCommitMove(id, x, z);
      return;
    }
    if (measuring && measureMode !== "navigate") {
      event.stopPropagation();
      setMeasuring(false);
      onMeasureEnd([event.point.x, event.point.z]);
    }
  };

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{
        position: [scene.grid_width * 0.42, Math.max(scene.grid_width, scene.grid_height) * 0.62, scene.grid_height * 0.72],
        fov: 44,
        near: 0.1,
        far: 300,
      }}
      onPointerMissed={() => { if (measureMode === "navigate") onSelect(null); }}
    >
      <color attach="background" args={["#070b11"]} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[12, 22, 10]} intensity={2.5} castShadow />
      <directionalLight position={[-12, 10, -8]} intensity={0.8} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.012, 0]}
        receiveShadow
        onPointerDown={planeDown}
        onPointerMove={planeMove}
        onPointerUp={planeUp}
      >
        <planeGeometry args={[scene.grid_width, scene.grid_height]} />
        <meshStandardMaterial color="#121a26" roughness={0.94} metalness={0.02} />
      </mesh>
      <BattleGrid width={scene.grid_width} height={scene.grid_height} />
      <MeasurementOverlay mode={measureMode} start={measureStart} end={measureEnd} />
      {tokens.map((token) => (
        <TokenMesh
          key={token.id}
          token={token}
          selected={token.id === selectedId}
          isDm={isDm}
          canDrag={measureMode === "navigate"}
          supabase={supabase}
          onSelect={(id) => onSelect(id)}
          onDragStart={(id) => setDraggingId(id)}
        />
      ))}
      <VttOrbitControls disabled={Boolean(draggingId) || measuring} />
    </Canvas>
  );
}

export function VttBattleBoard({ campaignId, isDm }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [scene, setScene] = useState<VttScene | null>(null);
  const [tokens, setTokens] = useState<VttToken[]>([]);
  const [enemyModels, setEnemyModels] = useState<VttEnemyModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [measureMode, setMeasureMode] = useState<MeasureMode>("navigate");
  const [measureStart, setMeasureStart] = useState<MeasurePoint | null>(null);
  const [measureEnd, setMeasureEnd] = useState<MeasurePoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshTokens = useCallback(async (sceneId: string) => {
    const { data, error: rpcError } = await supabase.rpc("list_vtt_scene_tokens", { p_scene_id: sceneId });
    if (rpcError) throw rpcError;
    setTokens((data ?? []) as VttToken[]);
  }, [supabase]);

  const broadcastRefresh = useCallback(() => {
    void channelRef.current?.send({ type: "broadcast", event: "refresh", payload: {} });
  }, []);

  const refreshEnemies = useCallback(async () => {
    if (!isDm) return;
    const { data, error: queryError } = await supabase
      .from("vtt_enemy_models")
      .select("id,campaign_id,name,storage_path,web_storage_path,original_name,file_size_bytes,web_file_size_bytes,triangle_count,width_mm,depth_mm,height_mm,created_at")
      .eq("campaign_id", campaignId)
      .order("name");
    if (queryError) throw queryError;
    setEnemyModels((data ?? []) as VttEnemyModel[]);
  }, [campaignId, isDm, supabase]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setLoading(true);
      setError(null);
      try {
        let nextScene: VttScene | null = null;
        if (isDm) {
          const { data, error: rpcError } = await supabase.rpc("ensure_vtt_alpha_scene", { p_campaign_id: campaignId });
          if (rpcError) throw rpcError;
          const raw = Array.isArray(data) ? data[0] : data;
          nextScene = (raw ?? null) as VttScene | null;
        } else {
          const { data, error: sceneError } = await supabase
            .from("vtt_scenes")
            .select("id,campaign_id,name,grid_width,grid_height,feet_per_square,is_active")
            .eq("campaign_id", campaignId)
            .eq("is_active", true)
            .maybeSingle();
          if (sceneError) throw sceneError;
          nextScene = data as VttScene | null;
        }
        if (cancelled) return;
        setScene(nextScene);
        if (nextScene) await refreshTokens(nextScene.id);
        if (isDm) await refreshEnemies();
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not open the VTT alpha scene.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void boot();
    return () => { cancelled = true; };
  }, [campaignId, isDm, refreshEnemies, refreshTokens, supabase]);

  useEffect(() => {
    if (!scene) return;
    let channel = supabase
      .channel(`vtt-alpha-${scene.id}`)
      .on("broadcast", { event: "refresh" }, () => {
        void refreshTokens(scene.id).catch(() => undefined);
      });

    if (isDm) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table: "vtt_tokens" }, () => {
        void refreshTokens(scene.id).catch(() => undefined);
      });
    }

    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [isDm, refreshTokens, scene, supabase]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === boardRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const selected = tokens.find((token) => token.id === selectedId) ?? null;

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === boardRef.current) {
        await document.exitFullscreen();
      } else if (boardRef.current?.requestFullscreen) {
        await boardRef.current.requestFullscreen();
      } else {
        setError("Fullscreen mode is not supported by this browser.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not switch fullscreen mode.");
    }
  };

  const placeParty = async () => {
    if (!scene || busy) return;
    setBusy(true); setError(null); setMessage(null);
    const { data, error: rpcError } = await supabase.rpc("seed_vtt_party", { p_scene_id: scene.id });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(`Party ready: ${Number(data ?? 0)} new character token${Number(data ?? 0) === 1 ? "" : "s"} placed.`);
      await refreshTokens(scene.id).catch(() => undefined);
      broadcastRefresh();
    }
    setBusy(false);
  };

  const spawnEnemy = async (enemy: VttEnemyModel) => {
    if (!scene || busy) return;
    setBusy(true); setError(null); setMessage(null);
    const { error: rpcError } = await supabase.rpc("spawn_vtt_enemy", {
      p_scene_id: scene.id,
      p_enemy_model_id: enemy.id,
      p_x: 0,
      p_z: 0,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(`${enemy.name} spawned hidden at the center of the grid.`);
      await refreshTokens(scene.id).catch(() => undefined);
      broadcastRefresh();
    }
    setBusy(false);
  };

  const localMove = (id: string, x: number, z: number) => {
    setTokens((current) => current.map((token) => token.id === id ? { ...token, x, z } : token));
  };

  const commitMove = async (id: string, x: number, z: number) => {
    if (!isDm) return;
    const token = tokens.find((item) => item.id === id);
    if (!token) return;
    const { error: updateError } = await supabase
      .from("vtt_tokens")
      .update({ x, z, revision: token.revision + 1, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      if (scene) await refreshTokens(scene.id).catch(() => undefined);
    } else {
      broadcastRefresh();
    }
  };

  const rotateSelected = useCallback(async (delta: number, absolute = false) => {
    if (!selected || !isDm || busy) return;
    const nextRotation = normalizeRotation(absolute ? delta : selected.rotation + delta);
    setTokens((current) => current.map((token) => token.id === selected.id ? { ...token, rotation: nextRotation } : token));

    const { error: updateError } = await supabase
      .from("vtt_tokens")
      .update({ rotation: nextRotation, revision: selected.revision + 1, updated_at: new Date().toISOString() })
      .eq("id", selected.id);

    if (updateError) {
      setError(updateError.message);
      if (scene) await refreshTokens(scene.id).catch(() => undefined);
    } else {
      broadcastRefresh();
    }
  }, [broadcastRefresh, busy, isDm, refreshTokens, scene, selected, supabase]);

  useEffect(() => {
    if (!isDm || !selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key.toLowerCase() === "q") {
        event.preventDefault();
        void rotateSelected(-Math.PI / 4);
      } else if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        void rotateSelected(Math.PI / 4);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDm, rotateSelected, selected]);

  const toggleVisibility = async () => {
    if (!selected || !isDm) return;
    setBusy(true); setError(null);
    const { error: updateError } = await supabase
      .from("vtt_tokens")
      .update({ visible_to_players: !selected.visible_to_players, revision: selected.revision + 1, updated_at: new Date().toISOString() })
      .eq("id", selected.id);
    if (updateError) setError(updateError.message);
    else {
      if (scene) await refreshTokens(scene.id).catch(() => undefined);
      broadcastRefresh();
    }
    setBusy(false);
  };

  const removeSelected = async () => {
    if (!selected || !isDm) return;
    setBusy(true); setError(null);
    const { error: deleteError } = await supabase.from("vtt_tokens").delete().eq("id", selected.id);
    if (deleteError) setError(deleteError.message);
    else {
      setSelectedId(null);
      if (scene) await refreshTokens(scene.id).catch(() => undefined);
      broadcastRefresh();
    }
    setBusy(false);
  };

  const selectMeasureMode = (mode: MeasureMode) => {
    setMeasureMode(mode);
    setMeasureStart(null);
    setMeasureEnd(null);
  };

  const measurement = useMemo(() => {
    if (!scene || !measureStart || !measureEnd || measureMode === "navigate") return null;
    const dx = measureEnd[0] - measureStart[0];
    const dz = measureEnd[1] - measureStart[1];
    const squares = Math.sqrt(dx * dx + dz * dz);
    return {
      squares,
      feet: squares * scene.feet_per_square,
    };
  }, [measureEnd, measureMode, measureStart, scene]);

  if (loading) return <div className="h-[72vh] min-h-[620px] animate-pulse rounded-[30px] border border-slate-800 bg-slate-900/50" />;

  if (!scene) {
    return (
      <div className="rounded-[30px] border border-slate-800 bg-slate-900/65 p-10 text-center">
        <h2 className="text-2xl font-black text-slate-100">No active VTT scene yet</h2>
        <p className="mt-3 text-sm text-slate-500">The Game Master needs to open the VTT once to initialize the Alpha Grid.</p>
      </div>
    );
  }

  const rotationDegrees = selected ? Math.round(normalizeRotation(selected.rotation) * 180 / Math.PI) : 0;

  return (
    <div
      ref={boardRef}
      className={isFullscreen
        ? "flex h-screen w-screen flex-col gap-2 overflow-hidden bg-[#05080d] p-2 text-slate-100"
        : "space-y-4"
      }
    >
      <section className={`flex shrink-0 flex-col gap-3 border border-slate-800 bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between ${isFullscreen ? "rounded-2xl px-4 py-2" : "rounded-[26px] p-4"}`}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Live scene</p>
          <h2 className={`${isFullscreen ? "text-lg" : "mt-1 text-xl"} font-black text-slate-100`}>{scene.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{scene.grid_width} × {scene.grid_height} squares · {scene.feet_per_square} ft per square · D&amp;D grid distance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="min-h-9 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300/60"
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen table"}
          </button>
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${isDm ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-200" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"}`}>
            {isDm ? "GM control" : "Player spectator"}
          </span>
        </div>
      </section>

      <div className={`${isFullscreen ? "grid min-h-0 flex-1 gap-2" : "grid gap-4"} ${isDm ? "xl:grid-cols-[minmax(0,1fr)_330px]" : ""}`}>
        <div className={`relative overflow-hidden border border-slate-800 bg-[#070b11] ${isFullscreen ? "min-h-0 rounded-2xl" : "rounded-[30px]"}`}>
          <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-950/88 p-1.5 shadow-2xl backdrop-blur">
            {(["navigate", "ruler", "radius"] as MeasureMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => selectMeasureMode(mode)}
                className={`min-h-9 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.1em] ${measureMode === mode ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200"}`}
              >
                {mode === "navigate" ? "Navigate" : mode === "ruler" ? "Ruler" : "Spell radius"}
              </button>
            ))}
            {measurement ? (
              <span className={`rounded-xl border px-3 py-2 text-[11px] font-black ${measureMode === "radius" ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"}`}>
                {measureMode === "radius" ? "Radius " : "Distance "}{measurement.feet.toFixed(measurement.feet >= 100 ? 0 : 1)} ft · {measurement.squares.toFixed(1)} sq
              </span>
            ) : null}
            {measureMode !== "navigate" && measureStart ? (
              <button type="button" onClick={() => { setMeasureStart(null); setMeasureEnd(null); }} className="min-h-9 rounded-xl border border-slate-800 px-3 text-[10px] font-bold text-slate-400">Clear</button>
            ) : null}
          </div>

          <div className={isFullscreen ? "h-full min-h-0" : "h-[72dvh] min-h-[560px] max-h-[920px]"}>
            <VttCanvas
              scene={scene}
              tokens={tokens}
              isDm={isDm}
              selectedId={selectedId}
              supabase={supabase}
              measureMode={measureMode}
              measureStart={measureStart}
              measureEnd={measureEnd}
              onSelect={setSelectedId}
              onLocalMove={localMove}
              onCommitMove={(id, x, z) => { void commitMove(id, x, z); }}
              onMeasureStart={(point) => { setMeasureStart(point); setMeasureEnd(point); }}
              onMeasureMove={setMeasureEnd}
              onMeasureEnd={setMeasureEnd}
            />
          </div>
          {!isFullscreen ? (
            <div className="border-t border-slate-800 px-4 py-3 text-[11px] text-slate-500">
              {isDm
                ? "GM: drag a miniature to move it. Arrow keys / WASD pan the camera; Shift moves faster. Q / E rotate the selected token by 45°. Ruler and Spell radius are local measuring tools."
                : "Spectator: orbit, pan and zoom freely. Arrow keys / WASD pan the camera. Ruler and Spell radius are local tools and do not change the scene."
              }
            </div>
          ) : null}
        </div>

        {isDm ? (
          <aside className={`${isFullscreen ? "min-h-0 overflow-y-auto rounded-2xl pr-1" : "space-y-4"} space-y-4`}>
            <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">GM setup</p>
              <button type="button" disabled={busy} onClick={() => void placeParty()} className="mt-3 min-h-11 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 text-xs font-black text-cyan-100 disabled:opacity-40">Place / refresh party</button>
              <p className="mt-2 text-[10px] leading-4 text-slate-600">Uses each player&apos;s current character miniature. Existing party tokens are not duplicated.</p>
            </section>

            <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">Enemy library</p><span className="text-[10px] font-bold text-slate-600">{enemyModels.length}</span></div>
              {enemyModels.length === 0 ? <p className="mt-3 text-xs leading-5 text-slate-500">No enemy STLs yet. Add them in the GM Enemy Studio.</p> : (
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {enemyModels.map((enemy) => (
                    <button key={enemy.id} type="button" disabled={busy} onClick={() => void spawnEnemy(enemy)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 text-left text-xs font-bold text-slate-200 hover:border-rose-400/30 disabled:opacity-40">
                      <span className="truncate">{enemy.name}</span><span className="shrink-0 text-[9px] uppercase text-rose-300">Spawn hidden</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Selected token</p>
              {selected ? (
                <>
                  <h3 className="mt-3 text-lg font-black text-slate-100">{selected.name}</h3>
                  <p className="mt-1 text-[11px] text-slate-500">{selected.source_kind} · ({selected.x.toFixed(0)}, {selected.z.toFixed(0)}) · {selected.size_squares} square · facing {rotationDegrees}°</p>

                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">Facing</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button type="button" disabled={busy} onClick={() => void rotateSelected(-Math.PI / 4)} className="min-h-10 rounded-xl border border-cyan-400/25 text-xs font-black text-cyan-100">↺ 45°</button>
                      <button type="button" disabled={busy} onClick={() => void rotateSelected(0, true)} className="min-h-10 rounded-xl border border-slate-700 text-[10px] font-black text-slate-300">Reset</button>
                      <button type="button" disabled={busy} onClick={() => void rotateSelected(Math.PI / 4)} className="min-h-10 rounded-xl border border-cyan-400/25 text-xs font-black text-cyan-100">45° ↻</button>
                    </div>
                    <p className="mt-2 text-[9px] leading-4 text-slate-600">Keyboard: Q / E rotates the selected miniature. The small marker on its base shows current facing.</p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy} onClick={() => void toggleVisibility()} className={`min-h-10 rounded-xl border px-3 text-[10px] font-black ${selected.visible_to_players ? "border-emerald-400/30 text-emerald-200" : "border-fuchsia-400/30 text-fuchsia-200"}`}>{selected.visible_to_players ? "Hide from players" : "Reveal to players"}</button>
                    <button type="button" disabled={busy} onClick={() => void removeSelected()} className="min-h-10 rounded-xl border border-rose-400/30 px-3 text-[10px] font-black text-rose-200">Remove</button>
                  </div>
                  {!selected.visible_to_players ? <p className="mt-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/5 px-3 py-2 text-[10px] leading-4 text-fuchsia-100">Hidden tokens are not returned by the player token RPC, so their position/count is not merely hidden with CSS.</p> : null}
                </>
              ) : <p className="mt-3 text-xs leading-5 text-slate-500">Click a miniature to inspect it. Only the GM can move, rotate, reveal or remove tokens.</p>}
            </section>
          </aside>
        ) : null}
      </div>

      {!isFullscreen && message ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">{message}</p> : null}
      {!isFullscreen && error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
      {isFullscreen && (message || error) ? (
        <div className={`pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-xl border px-4 py-2 text-xs shadow-2xl ${error ? "border-rose-500/30 bg-rose-950/90 text-rose-100" : "border-emerald-500/25 bg-emerald-950/90 text-emerald-100"}`}>
          {error ?? message}
        </div>
      ) : null}
    </div>
  );
}
