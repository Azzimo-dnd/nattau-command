"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { SupabaseClient } from "@supabase/supabase-js";
import { disposeTerrainModel } from "@/lib/terrain/terrainGeometry";
import { readTerrainFile } from "@/lib/terrain/terrainModels";
import type { TerrainAssetRow } from "@/lib/terrain/terrainTypes";
import type { VttSceneTerrainInstance } from "./terrainSceneTypes";
import { terrainDragPoint } from "./terrainSceneTypes";

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
type TerrainPosition = [number, number];
type DragSession = {
  id: string; pointerId: number; origin: TerrainPosition; hit: TerrainPosition;
  moved: boolean; current: TerrainPosition;
};
type LoadedTerrain = { path: string; object: THREE.Group };

type Props = {
  instances: VttSceneTerrainInstance[];
  assets: TerrainAssetRow[];
  supabase: SupabaseClient;
  selectedId: string | null;
  canSelect: boolean;
  gridWidth: number;
  gridHeight: number;
  snapToGrid: boolean;
  onSelect: (id: string) => void;
  onDraggingChange: (active: boolean) => void;
  onCommitMove: (id: string, position: TerrainPosition) => Promise<boolean>;
  onError?: (error: string | null) => void;
};

function groundHit(event: ThreeEvent<PointerEvent>): TerrainPosition | null {
  const hit = event.ray.intersectPlane(ground, new THREE.Vector3());
  return hit && Number.isFinite(hit.x) && Number.isFinite(hit.z) ? [hit.x, hit.z] : null;
}

function TerrainObject({ instance, model, selected, canSelect, position, onDown, onMove, onUp }: {
  instance: VttSceneTerrainInstance;
  model: THREE.Object3D;
  selected: boolean;
  canSelect: boolean;
  position: TerrainPosition;
  onDown: (event: ThreeEvent<PointerEvent>, instance: VttSceneTerrainInstance) => void;
  onMove: (event: ThreeEvent<PointerEvent>) => void;
  onUp: (event: ThreeEvent<PointerEvent>) => void;
}) {
  // Each placed object shares one geometry/material cache, but has an independent transform.
  const clone = useMemo(() => model.clone(true), [model]);
  return <group position={[position[0], 0.04, position[1]]}
    rotation={[0, instance.rotation_y, 0]} scale={instance.scale}>
    <group onPointerDown={(event) => onDown(event, instance)}
      onPointerMove={onMove} onPointerUp={onUp}>
      <primitive object={clone} dispose={null} />
    </group>
    {selected && <mesh position={[0, 0.028, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
      <ringGeometry args={[0.40, 0.49, 40]} />
      <meshBasicMaterial color="#22d3ee" depthTest={false} transparent opacity={0.86} side={THREE.DoubleSide} />
    </mesh>}
  </group>;
}

export function VttTerrainLayer({
  instances, assets, supabase, selectedId, canSelect, gridWidth, gridHeight, snapToGrid,
  onSelect, onDraggingChange, onCommitMove, onError,
}: Props) {
  const [loaded, setLoaded] = useState<Map<string, LoadedTerrain>>(new Map());
  const [draft, setDraft] = useState<{id:string; point:TerrainPosition} | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const savingRef = useRef(false);
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const paths = useMemo(() => [...new Set(instances.map((inst) =>
    byId.get(inst.terrain_asset_id)?.storage_path).filter((p): p is string => Boolean(p)))].sort(), [instances, byId]);
  const keys = paths.join("|");

  useEffect(() => {
    let alive = true;
    const cache = new Map<string, LoadedTerrain>();
    setLoaded(new Map());
    onError?.(null);
    void Promise.all(paths.map(async (path) => {
      const { data, error } = await supabase.storage.from("vtt-terrain-assets").download(path);
      if (error || !data) throw new Error("Terrain " + path + ": " + (error?.message ?? "File was not found"));
      const file = new File([data], path.split("/").at(-1) ?? "terrain.glb", { type: data.type || "model/gltf-binary" });
      const result = await readTerrainFile(file);
      if (!alive) { disposeTerrainModel(result.model); return; }
      cache.set(path, { path, object: result.model });
      setLoaded(new Map(cache));
    })).catch((cause) => {
      if (alive) onError?.(cause instanceof Error ? cause.message : "Some terrain objects could not load.");
    });
    return () => {
      alive = false;
      cache.forEach((asset) => disposeTerrainModel(asset.object));
      cache.clear();
    };
    // Reuse geometry when the scene references the same GLB paths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, supabase]);

  const cancelDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDraft(null);
    onDraggingChange(false);
  }, [onDraggingChange]);

  // A lost pointer capture or a tab switch must never leave the canvas in drag mode.
  useEffect(() => {
    window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("blur", cancelDrag);
    return () => {
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("blur", cancelDrag);
      cancelDrag();
    };
  }, [cancelDrag]);

  useEffect(() => {
    if (!canSelect) cancelDrag();
  }, [canSelect, cancelDrag]);

  const down = (event: ThreeEvent<PointerEvent>, instance: VttSceneTerrainInstance) => {
    if (!canSelect || event.button !== 0 || dragRef.current || savingRef.current) return;
    const hit = groundHit(event);
    if (!hit) return;
    event.stopPropagation();
    onSelect(instance.id);
    const start: TerrainPosition = [instance.position_x, instance.position_z];
    dragRef.current = { id:instance.id, pointerId:event.pointerId, origin:start, hit, moved:false, current:start };
    try { event.target.setPointerCapture(event.pointerId); }
    catch { /* Window blur / pointercancel still reset the state. */ }
    onDraggingChange(true);
  };

  const move = (event: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const hit = groundHit(event);
    if (!hit) return;
    // Threshold avoids accidentally moving a crate when merely selecting it.
    if (!drag.moved && Math.hypot(hit[0]-drag.hit[0], hit[1]-drag.hit[1]) < 0.06) return;
    drag.moved = true;
    const next = terrainDragPoint(drag.origin, drag.hit, hit, gridWidth, gridHeight, snapToGrid);
    drag.current = next;
    setDraft({id:drag.id, point:next});
  };

  const up = (event: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    try { event.target.releasePointerCapture(event.pointerId); }
    catch { /* The pointer may already have been released by the browser. */ }
    dragRef.current = null;
    onDraggingChange(false);
    if (!drag.moved ||
      (Math.abs(drag.current[0]-drag.origin[0]) < 0.00001 &&
       Math.abs(drag.current[1]-drag.origin[1]) < 0.00001)) {
      setDraft(null);
      return;
    }
    // Keep the local preview until the single database write completes.
    savingRef.current = true;
    void onCommitMove(drag.id, drag.current).catch((cause) => {
      onError?.(cause instanceof Error ? cause.message : "Could not save terrain movement.");
      return false;
    }).finally(() => {
      savingRef.current = false;
      setDraft(null); // Authoritative row is refreshed on success; revert on failure.
    });
  };

  return <group name="scene-terrain">
    {instances.map((instance) => {
      const path = byId.get(instance.terrain_asset_id)?.storage_path;
      const asset = path ? loaded.get(path) : null;
      if (!asset) return null;
      const position: TerrainPosition = draft?.id === instance.id ? draft.point : [instance.position_x, instance.position_z];
      return <TerrainObject key={instance.id} instance={instance} model={asset.object}
        position={position} canSelect={canSelect} selected={selectedId === instance.id}
        onDown={down} onMove={move} onUp={up} />;
    })}
  </group>;
}
