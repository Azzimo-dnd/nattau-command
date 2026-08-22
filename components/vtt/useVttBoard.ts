"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VttMeasurePoint, VttPing, VttToolMode } from "./VttCanvas";
import type { VttEnemyModel, VttScene, VttToken } from "./vttTypes";

const MAX_MAP_BYTES = 20 * 1024 * 1024;
const SCENE_FIELDS = "id,campaign_id,name,grid_width,grid_height,feet_per_square,is_active,visible_to_players,map_storage_path,map_original_name,map_opacity,grid_opacity,show_grid,show_nameplates,initiative_active,initiative_round,initiative_current_token_id";
const ENEMY_FIELDS = "id,campaign_id,name,storage_path,web_storage_path,original_name,file_size_bytes,web_file_size_bytes,triangle_count,width_mm,depth_mm,height_mm,created_at";

type CalibrationRow = {
  id: string;
  map_scale: number | null;
  map_offset_x: number | null;
  map_offset_z: number | null;
};

type DirectTokenRow = {
  character_miniature_id: string | null;
  enemy_model_id: string | null;
  name: string;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  size_squares: number;
  visible_to_players: boolean;
};

function normalizeRotation(value: number) {
  const full = Math.PI * 2;
  return ((value % full) + full) % full;
}

function mapExtension(file: File) {
  const match = file.name.toLowerCase().match(/\.(webp|png|jpe?g)$/);
  return match?.[1] === "jpeg" ? "jpg" : match?.[1] ?? null;
}

function storagePathExtension(path: string) {
  const match = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "webp";
}

function withCalibration(scene: Partial<VttScene>, calibration?: CalibrationRow): VttScene {
  return {
    ...scene,
    visible_to_players: scene.visible_to_players ?? true,
    show_nameplates: scene.show_nameplates ?? false,
    initiative_active: scene.initiative_active ?? false,
    initiative_round: scene.initiative_round ?? 1,
    initiative_current_token_id: scene.initiative_current_token_id ?? null,
    map_scale: calibration?.map_scale ?? scene.map_scale ?? 1,
    map_offset_x: calibration?.map_offset_x ?? scene.map_offset_x ?? 0,
    map_offset_z: calibration?.map_offset_z ?? scene.map_offset_z ?? 0,
  } as VttScene;
}

function clampSceneCoordinate(value: number, squares: number) {
  const limit = Math.max(0.5, squares / 2 - 0.5);
  return Math.max(-limit, Math.min(limit, value));
}

function duplicateEnemyName(name: string, allNames: string[]) {
  const match = name.trim().match(/^(.*?)(?:\s+(\d+))?$/);
  const base = (match?.[1] || name).trim();
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}(?:\\s+(\\d+))?$`, "i");
  let max = 1;
  for (const existing of allNames) {
    const existingMatch = existing.trim().match(pattern);
    if (!existingMatch) continue;
    max = Math.max(max, existingMatch[1] ? Number(existingMatch[1]) : 1);
  }
  return `${base} ${max + 1}`;
}

export function useVttBoard(campaignId: string, isDm: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const workspaceSceneIdRef = useRef<string | null>(null);
  const mapInputRef = useRef<HTMLInputElement | null>(null);

  const [scenes, setScenes] = useState<VttScene[]>([]);
  const [scene, setScene] = useState<VttScene | null>(null);
  const [tokens, setTokens] = useState<VttToken[]>([]);
  const [enemyModels, setEnemyModels] = useState<VttEnemyModel[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playerPreview, setPlayerPreview] = useState(false);
  const [toolMode, setToolMode] = useState<VttToolMode>("navigate");
  const [measureStart, setMeasureStart] = useState<VttMeasurePoint | null>(null);
  const [measureEnd, setMeasureEnd] = useState<VttMeasurePoint | null>(null);
  const [ping, setPing] = useState<VttPing | null>(null);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftWidth, setDraftWidth] = useState(24);
  const [draftHeight, setDraftHeight] = useState(18);
  const [draftMapOpacity, setDraftMapOpacity] = useState(100);
  const [draftGridOpacity, setDraftGridOpacity] = useState(78);
  const [draftShowGrid, setDraftShowGrid] = useState(true);
  const [draftMapScale, setDraftMapScale] = useState(1);
  const [draftMapOffsetX, setDraftMapOffsetX] = useState(0);
  const [draftMapOffsetZ, setDraftMapOffsetZ] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    workspaceSceneIdRef.current = scene?.id ?? null;
  }, [scene?.id]);

  const loadCalibrationMap = useCallback(async () => {
    const { data, error: calibrationError } = await supabase
      .from("vtt_scenes")
      .select("id,map_scale,map_offset_x,map_offset_z")
      .eq("campaign_id", campaignId);
    if (calibrationError) return new Map<string, CalibrationRow>();
    return new Map((data ?? []).map((row) => [row.id, row as CalibrationRow]));
  }, [campaignId, supabase]);

  const refreshScenes = useCallback(async (preferredId?: string | null) => {
    if (!isDm) return [] as VttScene[];
    const [{ data, error: sceneError }, calibration] = await Promise.all([
      supabase.from("vtt_scenes").select(SCENE_FIELDS).eq("campaign_id", campaignId).order("created_at", { ascending: true }),
      loadCalibrationMap(),
    ]);
    if (sceneError) throw sceneError;

    const nextScenes = (data ?? []).map((item) => withCalibration(item as unknown as Partial<VttScene>, calibration.get(item.id)));
    setScenes(nextScenes);
    const wantedId = preferredId ?? workspaceSceneIdRef.current;
    const workspace = nextScenes.find((item) => item.id === wantedId)
      ?? nextScenes.find((item) => item.is_active)
      ?? nextScenes[0]
      ?? null;
    setScene(workspace);
    return nextScenes;
  }, [campaignId, isDm, loadCalibrationMap, supabase]);

  const refreshPlayerScene = useCallback(async () => {
    const { data, error: sceneError } = await supabase
      .from("vtt_scenes")
      .select(SCENE_FIELDS)
      .eq("campaign_id", campaignId)
      .eq("is_active", true)
      .maybeSingle();
    if (sceneError) throw sceneError;
    const next = data ? withCalibration(data as unknown as Partial<VttScene>) : null;
    setScene(next);
    return next;
  }, [campaignId, supabase]);

  const refreshTokens = useCallback(async (sceneId: string) => {
    const { data, error: rpcError } = await supabase.rpc("list_vtt_scene_tokens", { p_scene_id: sceneId });
    if (rpcError) throw rpcError;
    setTokens((data ?? []) as VttToken[]);
  }, [supabase]);

  const refreshEnemies = useCallback(async () => {
    if (!isDm) return;
    const { data, error: queryError } = await supabase
      .from("vtt_enemy_models")
      .select(ENEMY_FIELDS)
      .eq("campaign_id", campaignId)
      .order("name");
    if (queryError) throw queryError;
    setEnemyModels((data ?? []) as VttEnemyModel[]);
  }, [campaignId, isDm, supabase]);

  const broadcastRefresh = useCallback(() => {
    void channelRef.current?.send({ type: "broadcast", event: "refresh", payload: {} });
  }, []);

  const refreshFromBroadcast = useCallback(async () => {
    if (isDm) {
      await refreshScenes();
      const workspaceId = workspaceSceneIdRef.current;
      if (workspaceId) await refreshTokens(workspaceId).catch(() => undefined);
      return;
    }
    const active = await refreshPlayerScene();
    if (active) await refreshTokens(active.id);
    else setTokens([]);
  }, [isDm, refreshPlayerScene, refreshScenes, refreshTokens]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isDm) {
          const { error: rpcError } = await supabase.rpc("ensure_vtt_alpha_scene", { p_campaign_id: campaignId });
          if (rpcError) throw rpcError;
          const nextScenes = await refreshScenes();
          const workspace = nextScenes.find((item) => item.is_active) ?? nextScenes[0] ?? null;
          if (!cancelled && workspace) {
            setScene(workspace);
            await refreshTokens(workspace.id);
          }
          await refreshEnemies();
        } else {
          const active = await refreshPlayerScene();
          if (active) await refreshTokens(active.id);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not open the VTT.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void boot();
    return () => { cancelled = true; };
  }, [campaignId, isDm, refreshEnemies, refreshPlayerScene, refreshScenes, refreshTokens, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`vtt-campaign-${campaignId}`)
      .on("broadcast", { event: "refresh" }, () => { void refreshFromBroadcast().catch(() => undefined); })
      .on("broadcast", { event: "ping" }, ({ payload }) => {
        const next = payload as { sceneId?: string; id?: string; x?: number; z?: number };
        if (next.sceneId !== workspaceSceneIdRef.current || typeof next.x !== "number" || typeof next.z !== "number") return;
        setPing({ id: next.id ?? crypto.randomUUID(), x: next.x, z: next.z });
      });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [campaignId, refreshFromBroadcast, supabase]);

  useEffect(() => {
    if (!scene) return;
    setDraftName(scene.name);
    setDraftWidth(scene.grid_width);
    setDraftHeight(scene.grid_height);
    setDraftMapOpacity(Math.round(scene.map_opacity * 100));
    setDraftGridOpacity(Math.round(scene.grid_opacity * 100));
    setDraftShowGrid(scene.show_grid);
    setDraftMapScale(scene.map_scale);
    setDraftMapOffsetX(scene.map_offset_x);
    setDraftMapOffsetZ(scene.map_offset_z);
    setSelectedIds([]);
    setMeasureStart(null);
    setMeasureEnd(null);
    setPlayerPreview(false);
    if (isDm) void refreshTokens(scene.id).catch(() => undefined);
  }, [isDm, refreshTokens, scene?.id]);

  useEffect(() => {
    if (!ping) return;
    const timeout = window.setTimeout(() => setPing((current) => current?.id === ping.id ? null : current), 2200);
    return () => window.clearTimeout(timeout);
  }, [ping]);

  const selectedTokens = useMemo(() => tokens.filter((token) => selectedIds.includes(token.id)), [selectedIds, tokens]);
  const selected = selectedTokens.length === 1 ? selectedTokens[0] : null;
  const visibleTokens = playerPreview ? tokens.filter((token) => token.visible_to_players) : tokens;
  const initiativeTokens = useMemo(() => tokens
    .filter((token) => token.initiative !== null)
    .slice()
    .sort((a, b) => (b.initiative ?? -999) - (a.initiative ?? -999) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), [tokens]);
  const rotationDegrees = selected ? Math.round(normalizeRotation(selected.rotation) * 180 / Math.PI) : 0;
  const canvasScene = scene ? {
    ...scene,
    map_scale: draftMapScale,
    map_offset_x: draftMapOffsetX,
    map_offset_z: draftMapOffsetZ,
  } : null;

  const selectToken = useCallback((id: string | null, additive: boolean) => {
    if (playerPreview) return;
    if (!id) {
      setSelectedIds([]);
      return;
    }
    if (!additive) {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }, [playerPreview]);

  const sceneDraft = useCallback(() => ({
    name: draftName.trim() || scene?.name || "Untitled Scene",
    grid_width: Math.max(4, Math.min(100, Math.round(draftWidth))),
    grid_height: Math.max(4, Math.min(100, Math.round(draftHeight))),
    map_opacity: Math.max(0, Math.min(1, draftMapOpacity / 100)),
    grid_opacity: Math.max(0, Math.min(1, draftGridOpacity / 100)),
    show_grid: draftShowGrid,
    updated_at: new Date().toISOString(),
  }), [draftGridOpacity, draftHeight, draftMapOpacity, draftName, draftShowGrid, draftWidth, scene?.name]);

  const saveScenePresentation = useCallback(async () => {
    if (!scene || !isDm || busy) return;
    setBusy(true); setError(null); setMessage(null);
    const { error: updateError } = await supabase.from("vtt_scenes").update(sceneDraft()).eq("id", scene.id);
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    const calibration = {
      map_scale: Math.max(0.25, Math.min(4, Number(draftMapScale) || 1)),
      map_offset_x: Math.max(-100, Math.min(100, Number(draftMapOffsetX) || 0)),
      map_offset_z: Math.max(-100, Math.min(100, Number(draftMapOffsetZ) || 0)),
    };
    const { error: calibrationError } = await supabase.from("vtt_scenes").update(calibration).eq("id", scene.id);
    await refreshScenes(scene.id);
    if (scene.is_active) broadcastRefresh();
    setMessage(calibrationError ? "Scene settings saved, but grid calibration could not be persisted." : "Scene settings and grid calibration saved.");
    setBusy(false);
  }, [broadcastRefresh, busy, draftMapOffsetX, draftMapOffsetZ, draftMapScale, isDm, refreshScenes, scene, sceneDraft, supabase]);

  const uploadSceneMap = useCallback(async () => {
    if (!scene || !isDm || !mapFile || busy) return;
    const extension = mapExtension(mapFile);
    if (!extension) { setError("Battle maps must be WebP, PNG, JPG or JPEG files."); return; }
    if (mapFile.size <= 0 || mapFile.size > MAX_MAP_BYTES) { setError("Battle map must be larger than 0 bytes and no more than 20 MB."); return; }

    setBusy(true); setError(null); setMessage(null);
    const path = `${campaignId}/${scene.id}/${crypto.randomUUID()}.${extension}`;
    const oldPath = scene.map_storage_path;
    const { error: uploadError } = await supabase.storage.from("vtt-maps").upload(path, mapFile, {
      cacheControl: "3600",
      contentType: mapFile.type || (extension === "webp" ? "image/webp" : extension === "png" ? "image/png" : "image/jpeg"),
      upsert: false,
    });
    if (uploadError) { setError(uploadError.message); setBusy(false); return; }

    const { error: updateError } = await supabase.from("vtt_scenes").update({ ...sceneDraft(), map_storage_path: path, map_original_name: mapFile.name }).eq("id", scene.id);
    if (updateError) {
      await supabase.storage.from("vtt-maps").remove([path]);
      setError(updateError.message);
    } else {
      if (oldPath && oldPath !== path) await supabase.storage.from("vtt-maps").remove([oldPath]);
      setMapFile(null);
      if (mapInputRef.current) mapInputRef.current.value = "";
      await refreshScenes(scene.id);
      if (scene.is_active) broadcastRefresh();
      setMessage(`Battle map ${mapFile.name} applied to ${scene.name}.`);
    }
    setBusy(false);
  }, [broadcastRefresh, busy, campaignId, isDm, mapFile, refreshScenes, scene, sceneDraft, supabase]);

  const removeSceneMap = useCallback(async () => {
    if (!scene || !isDm || !scene.map_storage_path || busy) return;
    setBusy(true); setError(null); setMessage(null);
    const oldPath = scene.map_storage_path;
    const { error: updateError } = await supabase.from("vtt_scenes").update({ map_storage_path: null, map_original_name: null, updated_at: new Date().toISOString() }).eq("id", scene.id);
    if (updateError) setError(updateError.message);
    else {
      await supabase.storage.from("vtt-maps").remove([oldPath]);
      await refreshScenes(scene.id);
      if (scene.is_active) broadcastRefresh();
      setMessage("Battle map removed. The grid remains available.");
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshScenes, scene, supabase]);

  const createScene = useCallback(async () => {
    if (!isDm || busy) return;
    setBusy(true); setError(null); setMessage(null);
    const { data, error: insertError } = await supabase.from("vtt_scenes").insert({
      campaign_id: campaignId,
      name: `Prepared Scene ${scenes.length + 1}`,
      grid_width: scene?.grid_width ?? 24,
      grid_height: scene?.grid_height ?? 18,
      feet_per_square: scene?.feet_per_square ?? 5,
      is_active: false,
      visible_to_players: true,
      show_nameplates: false,
    }).select(SCENE_FIELDS).single();
    if (insertError) setError(insertError.message);
    else {
      const next = withCalibration(data as unknown as Partial<VttScene>);
      await refreshScenes(next.id);
      setScene(next);
      setTokens([]);
      setMessage(`${next.name} created privately. Players cannot see it until you make it live.`);
    }
    setBusy(false);
  }, [busy, campaignId, isDm, refreshScenes, scene, scenes.length, supabase]);

  const duplicateScene = useCallback(async (target: VttScene) => {
    if (!isDm || busy) return;
    setBusy(true); setError(null); setMessage(null);

    const { data: created, error: createError } = await supabase.from("vtt_scenes").insert({
      campaign_id: campaignId,
      name: `${target.name} copy`,
      grid_width: target.grid_width,
      grid_height: target.grid_height,
      feet_per_square: target.feet_per_square,
      is_active: false,
      visible_to_players: true,
      map_opacity: target.map_opacity,
      grid_opacity: target.grid_opacity,
      show_grid: target.show_grid,
      show_nameplates: target.show_nameplates,
      map_scale: target.map_scale,
      map_offset_x: target.map_offset_x,
      map_offset_z: target.map_offset_z,
    }).select("id").single();

    if (createError || !created) {
      setError(createError?.message ?? "Could not duplicate scene.");
      setBusy(false);
      return;
    }

    const newSceneId = created.id as string;
    let copiedMapPath: string | null = null;

    if (target.map_storage_path) {
      const { data: mapBlob, error: mapDownloadError } = await supabase.storage.from("vtt-maps").download(target.map_storage_path);
      if (!mapDownloadError && mapBlob) {
        copiedMapPath = `${campaignId}/${newSceneId}/${crypto.randomUUID()}.${storagePathExtension(target.map_storage_path)}`;
        const { error: mapUploadError } = await supabase.storage.from("vtt-maps").upload(copiedMapPath, mapBlob, { contentType: mapBlob.type || undefined, upsert: false });
        if (mapUploadError) copiedMapPath = null;
      }
    }

    if (copiedMapPath) {
      await supabase.from("vtt_scenes").update({ map_storage_path: copiedMapPath, map_original_name: target.map_original_name }).eq("id", newSceneId);
    }

    const { data: sourceRows } = await supabase.from("vtt_tokens")
      .select("character_miniature_id,enemy_model_id,name,x,z,rotation,scale,size_squares,visible_to_players")
      .eq("scene_id", target.id);

    if (sourceRows?.length) {
      const inserts = (sourceRows as DirectTokenRow[]).map((row) => ({ ...row, scene_id: newSceneId, initiative: null }));
      await supabase.from("vtt_tokens").insert(inserts);
    }

    await refreshScenes(newSceneId);
    await refreshTokens(newSceneId);
    setMessage(`${target.name} duplicated as a private prepared scene.`);
    setBusy(false);
  }, [busy, campaignId, isDm, refreshScenes, refreshTokens, supabase]);

  const openScene = useCallback(async (next: VttScene) => {
    if (busy || next.id === scene?.id) return;
    setScene(next); setSelectedIds([]); setError(null);
    setMessage(next.is_active ? "Editing the live scene." : `Editing prepared scene: ${next.name}.`);
    await refreshTokens(next.id).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load scene tokens."));
  }, [busy, refreshTokens, scene?.id]);

  const setScenePlayerVisibility = useCallback(async (target: VttScene, visible: boolean) => {
    if (!isDm || busy || !target.is_active) return;
    setBusy(true); setError(null); setMessage(null);
    const { error: updateError } = await supabase.from("vtt_scenes").update({ visible_to_players: visible, updated_at: new Date().toISOString() }).eq("id", target.id);
    if (updateError) setError(updateError.message);
    else {
      await refreshScenes(target.id);
      broadcastRefresh();
      setMessage(visible ? "The live tabletop is visible to players." : "The live tabletop is hidden from players.");
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshScenes, supabase]);

  const activateScene = useCallback(async (target: VttScene) => {
    if (!isDm || busy || target.is_active) return;
    const previous = scenes.find((item) => item.is_active) ?? null;
    setBusy(true); setError(null); setMessage(null);
    if (previous) {
      const { error: deactivateError } = await supabase.from("vtt_scenes").update({ is_active: false }).eq("id", previous.id);
      if (deactivateError) { setError(deactivateError.message); setBusy(false); return; }
    }
    const { error: activateError } = await supabase.from("vtt_scenes").update({ is_active: true, visible_to_players: true }).eq("id", target.id);
    if (activateError) {
      if (previous) await supabase.from("vtt_scenes").update({ is_active: true }).eq("id", previous.id);
      setError(activateError.message);
    } else {
      await refreshScenes(target.id);
      await refreshTokens(target.id);
      broadcastRefresh();
      setMessage(`${target.name} is now live for players.`);
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshScenes, refreshTokens, scenes, supabase]);

  const deleteScene = useCallback(async (target: VttScene) => {
    if (!isDm || busy || target.is_active) return;
    setBusy(true); setError(null); setMessage(null);
    if (target.map_storage_path) await supabase.storage.from("vtt-maps").remove([target.map_storage_path]);
    const { error: deleteError } = await supabase.from("vtt_scenes").delete().eq("id", target.id);
    if (deleteError) setError(deleteError.message);
    else {
      const remaining = await refreshScenes();
      const next = remaining.find((item) => item.is_active) ?? remaining[0] ?? null;
      if (next) await refreshTokens(next.id); else setTokens([]);
      setMessage(`${target.name} deleted.`);
    }
    setBusy(false);
  }, [busy, isDm, refreshScenes, refreshTokens, supabase]);

  const placeParty = useCallback(async () => {
    if (!scene || !isDm || busy) return;
    setBusy(true); setError(null); setMessage(null);
    const { data, error: rpcError } = await supabase.rpc("seed_vtt_party", { p_scene_id: scene.id });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(`Party ready: ${Number(data ?? 0)} new character token${Number(data ?? 0) === 1 ? "" : "s"} placed.`);
      await refreshTokens(scene.id).catch(() => undefined);
      if (scene.is_active) broadcastRefresh();
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshTokens, scene, supabase]);

  const spawnEnemy = useCallback(async (enemy: VttEnemyModel) => {
    if (!scene || !isDm || busy) return;
    setBusy(true); setError(null); setMessage(null);
    const { error: rpcError } = await supabase.rpc("spawn_vtt_enemy", { p_scene_id: scene.id, p_enemy_model_id: enemy.id, p_x: 0, p_z: 0 });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(`${enemy.name} spawned hidden on ${scene.name}.`);
      await refreshTokens(scene.id).catch(() => undefined);
      if (scene.is_active) broadcastRefresh();
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshTokens, scene, supabase]);

  const localMove = useCallback((id: string, x: number, z: number) => {
    setTokens((current) => current.map((token) => token.id === id ? { ...token, x, z } : token));
  }, []);

  const commitMove = useCallback(async (id: string, x: number, z: number) => {
    if (!isDm) return;
    const token = tokens.find((item) => item.id === id);
    if (!token) return;
    const { error: updateError } = await supabase.from("vtt_tokens").update({ x, z, revision: token.revision + 1, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      if (scene) await refreshTokens(scene.id).catch(() => undefined);
    } else if (scene?.is_active) broadcastRefresh();
  }, [broadcastRefresh, isDm, refreshTokens, scene, supabase, tokens]);

  const rotateSelected = useCallback(async (delta: number, absolute = false) => {
    if (!selected || !isDm || busy) return;
    const nextRotation = normalizeRotation(absolute ? delta : selected.rotation + delta);
    setTokens((current) => current.map((token) => token.id === selected.id ? { ...token, rotation: nextRotation } : token));
    const { error: updateError } = await supabase.from("vtt_tokens").update({ rotation: nextRotation, revision: selected.revision + 1, updated_at: new Date().toISOString() }).eq("id", selected.id);
    if (updateError) {
      setError(updateError.message);
      if (scene) await refreshTokens(scene.id).catch(() => undefined);
    } else if (scene?.is_active) broadcastRefresh();
  }, [broadcastRefresh, busy, isDm, refreshTokens, scene, selected, supabase]);

  const renameSelectedEnemy = useCallback(async (name: string) => {
    if (!selected || selected.source_kind !== "enemy" || !scene || !isDm || busy) return;
    const nextName = name.trim().slice(0, 120);
    if (!nextName) return;
    setBusy(true); setError(null);
    const { error: updateError } = await supabase.from("vtt_tokens").update({ name: nextName, revision: selected.revision + 1, updated_at: new Date().toISOString() }).eq("id", selected.id);
    if (updateError) setError(updateError.message);
    else {
      await refreshTokens(scene.id);
      if (scene.is_active) broadcastRefresh();
      setMessage(`Enemy renamed to ${nextName}.`);
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshTokens, scene, selected, supabase]);

  const setTokenInitiative = useCallback(async (tokenId: string, initiative: number | null) => {
    if (!scene || !isDm || busy) return;
    const normalized = initiative === null || Number.isNaN(initiative) ? null : Math.max(-100, Math.min(100, Math.round(initiative)));
    setBusy(true); setError(null);
    const { error: updateError } = await supabase.from("vtt_tokens").update({ initiative: normalized, updated_at: new Date().toISOString() }).eq("id", tokenId);
    if (updateError) setError(updateError.message);
    else {
      await refreshTokens(scene.id);
      if (scene.is_active) broadcastRefresh();
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshTokens, scene, supabase]);

  const toggleNameplates = useCallback(async () => {
    if (!scene || !isDm || busy) return;
    setBusy(true); setError(null);
    const next = !scene.show_nameplates;
    const { error: updateError } = await supabase.from("vtt_scenes").update({ show_nameplates: next, updated_at: new Date().toISOString() }).eq("id", scene.id);
    if (updateError) setError(updateError.message);
    else {
      await refreshScenes(scene.id);
      if (scene.is_active) broadcastRefresh();
      setMessage(next ? "Token nameplates enabled." : "Token nameplates hidden.");
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshScenes, scene, supabase]);

  const bulkUpdate = useCallback(async (patch: Record<string, unknown>, successMessage: string) => {
    if (!scene || !isDm || selectedIds.length === 0 || busy) return;
    setBusy(true); setError(null); setMessage(null);
    const { error: updateError } = await supabase.from("vtt_tokens").update({ ...patch, updated_at: new Date().toISOString() }).in("id", selectedIds);
    if (updateError) setError(updateError.message);
    else {
      await refreshTokens(scene.id);
      if (scene.is_active) broadcastRefresh();
      setMessage(successMessage);
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshTokens, scene, selectedIds, supabase]);

  const removeSelected = useCallback(async () => {
    if (!scene || !isDm || selectedIds.length === 0 || busy) return;
    setBusy(true); setError(null); setMessage(null);
    const { error: deleteError } = await supabase.from("vtt_tokens").delete().in("id", selectedIds);
    if (deleteError) setError(deleteError.message);
    else {
      setSelectedIds([]);
      await refreshTokens(scene.id);
      await refreshScenes(scene.id);
      if (scene.is_active) broadcastRefresh();
      setMessage("Selected tokens removed.");
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshScenes, refreshTokens, scene, selectedIds, supabase]);

  const duplicateSelected = useCallback(async () => {
    if (!scene || !isDm || selectedTokens.length === 0 || busy) return;
    const enemies = selectedTokens.filter((token) => token.source_kind === "enemy");
    if (enemies.length === 0) { setMessage("Party character tokens stay unique per scene. Select enemies to duplicate."); return; }
    setBusy(true); setError(null); setMessage(null);
    let created = 0;
    let workingNames = tokens.map((token) => token.name);
    for (const token of enemies) {
      const model = enemyModels.find((enemy) => enemy.storage_path === token.model_storage_path || enemy.web_storage_path === token.model_storage_path);
      if (!model) continue;
      const nextName = duplicateEnemyName(token.name, workingNames);
      const { data: tokenId, error: spawnError } = await supabase.rpc("spawn_vtt_enemy", {
        p_scene_id: scene.id,
        p_enemy_model_id: model.id,
        p_x: clampSceneCoordinate(token.x + 1, scene.grid_width),
        p_z: clampSceneCoordinate(token.z + 1, scene.grid_height),
      });
      if (spawnError || !tokenId) continue;
      const { error: copyError } = await supabase.from("vtt_tokens").update({
        name: nextName,
        rotation: token.rotation,
        scale: token.scale,
        size_squares: token.size_squares,
        visible_to_players: token.visible_to_players,
        initiative: token.initiative,
      }).eq("id", tokenId as string);
      if (!copyError) {
        created += 1;
        workingNames = [...workingNames, nextName];
      }
    }
    await refreshTokens(scene.id);
    if (scene.is_active) broadcastRefresh();
    setMessage(created > 0 ? `${created} enemy token${created === 1 ? "" : "s"} duplicated and numbered.` : "No enemy tokens could be duplicated.");
    setBusy(false);
  }, [broadcastRefresh, busy, enemyModels, isDm, refreshTokens, scene, selectedTokens, supabase, tokens]);

  const startInitiative = useCallback(async () => {
    if (!scene || !isDm || busy || initiativeTokens.length === 0) return;
    setBusy(true); setError(null);
    const { error: updateError } = await supabase.from("vtt_scenes").update({ initiative_active: true, initiative_round: 1, initiative_current_token_id: initiativeTokens[0].id }).eq("id", scene.id);
    if (updateError) setError(updateError.message);
    else {
      await refreshScenes(scene.id);
      if (scene.is_active) broadcastRefresh();
    }
    setBusy(false);
  }, [broadcastRefresh, busy, initiativeTokens, isDm, refreshScenes, scene, supabase]);

  const stopInitiative = useCallback(async (clearValues = false) => {
    if (!scene || !isDm || busy) return;
    setBusy(true); setError(null);
    if (clearValues) await supabase.from("vtt_tokens").update({ initiative: null }).eq("scene_id", scene.id);
    const { error: updateError } = await supabase.from("vtt_scenes").update({ initiative_active: false, initiative_round: 1, initiative_current_token_id: null }).eq("id", scene.id);
    if (updateError) setError(updateError.message);
    else {
      await Promise.all([refreshScenes(scene.id), refreshTokens(scene.id)]);
      if (scene.is_active) broadcastRefresh();
    }
    setBusy(false);
  }, [broadcastRefresh, busy, isDm, refreshScenes, refreshTokens, scene, supabase]);

  const stepInitiative = useCallback(async (direction: 1 | -1) => {
    if (!scene || !isDm || busy || initiativeTokens.length === 0) return;
    const currentIndex = Math.max(0, initiativeTokens.findIndex((token) => token.id === scene.initiative_current_token_id));
    let nextIndex = currentIndex + direction;
    let nextRound = scene.initiative_round;
    if (nextIndex >= initiativeTokens.length) { nextIndex = 0; nextRound += 1; }
    if (nextIndex < 0) { nextIndex = initiativeTokens.length - 1; nextRound = Math.max(1, nextRound - 1); }
    setBusy(true); setError(null);
    const { error: updateError } = await supabase.from("vtt_scenes").update({ initiative_active: true, initiative_round: nextRound, initiative_current_token_id: initiativeTokens[nextIndex].id }).eq("id", scene.id);
    if (updateError) setError(updateError.message);
    else {
      await refreshScenes(scene.id);
      if (scene.is_active) broadcastRefresh();
    }
    setBusy(false);
  }, [broadcastRefresh, busy, initiativeTokens, isDm, refreshScenes, scene, supabase]);

  const selectToolMode = useCallback((mode: VttToolMode) => {
    setToolMode(mode); setMeasureStart(null); setMeasureEnd(null);
  }, []);

  const sendPing = useCallback((point: VttMeasurePoint) => {
    if (!scene) return;
    const next: VttPing = { id: crypto.randomUUID(), x: point[0], z: point[1] };
    setPing(next);
    void channelRef.current?.send({ type: "broadcast", event: "ping", payload: { sceneId: scene.id, id: next.id, x: next.x, z: next.z } });
  }, [scene]);

  const measurement = useMemo(() => {
    if (!scene || !measureStart || !measureEnd || (toolMode !== "ruler" && toolMode !== "radius")) return null;
    const dx = measureEnd[0] - measureStart[0];
    const dz = measureEnd[1] - measureStart[1];
    const squares = Math.sqrt(dx * dx + dz * dz);
    return { squares, feet: squares * scene.feet_per_square };
  }, [measureEnd, measureStart, scene, toolMode]);

  return {
    supabase, mapInputRef,
    scenes, scene, canvasScene, tokens: visibleTokens, allTokens: tokens, enemyModels, selectedIds, selectedTokens, initiativeTokens,
    loading, busy, playerPreview, toolMode, measureStart, measureEnd, measurement, ping,
    mapFile, draftName, draftWidth, draftHeight, draftMapOpacity, draftGridOpacity, draftShowGrid,
    draftMapScale, draftMapOffsetX, draftMapOffsetZ, error, message, rotationDegrees,
    setPlayerPreview, setMapFile, setDraftName, setDraftWidth, setDraftHeight, setDraftMapOpacity,
    setDraftGridOpacity, setDraftShowGrid, setDraftMapScale, setDraftMapOffsetX, setDraftMapOffsetZ,
    selectToken, selectToolMode, setMeasureStart, setMeasureEnd, sendPing,
    saveScenePresentation, uploadSceneMap, removeSceneMap, createScene, duplicateScene, openScene, activateScene, deleteScene, setScenePlayerVisibility,
    placeParty, spawnEnemy, localMove, commitMove, rotateSelected, renameSelectedEnemy, setTokenInitiative, toggleNameplates,
    bulkUpdate, removeSelected, duplicateSelected, startInitiative, stopInitiative, stepInitiative,
  };
}
