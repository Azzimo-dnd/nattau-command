"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { snapTokenCoordinate } from "./vttGridMath";
import { subscribeVttChannel } from "./vttRealtime";
import { isFogPointRevealed } from "./vttFogMath";
import type {
  VttFogBaseState,
  VttFogDrawShape,
  VttFogOperation,
  VttFogPoint,
  VttFogRegion,
  VttScene,
  VttToken,
} from "./vttTypes";

type Props = {
  campaignId: string;
  currentUserId: string;
  isDm: boolean;
  playerPreview: boolean;
  scene: VttScene | null;
  tokens: VttToken[];
  supabase: ReturnType<typeof createClient>;
  refreshTokens: (sceneId: string) => Promise<void>;
};

type FogSceneRow = {
  fog_enabled: boolean | null;
  fog_base_state: VttFogBaseState | null;
};

function normalizeRegion(row: unknown): VttFogRegion {
  const value = row as {
    id: number;
    scene_id: string;
    operation: VttFogOperation;
    shape: VttFogRegion["shape"];
    points: unknown;
    created_at: string;
  };
  const points = Array.isArray(value.points)
    ? value.points
      .filter((point): point is [unknown, unknown] => Array.isArray(point) && point.length >= 2)
      .map((point) => [Number(point[0]), Number(point[1])] as VttFogPoint)
      .filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z))
    : [];
  return { ...value, points };
}

export function useVttFog({ campaignId, currentUserId, isDm, playerPreview, scene, tokens, supabase, refreshTokens }: Props) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const rectangleStartRef = useRef<VttFogPoint | null>(null);
  const requestVersion = useRef(0);
  const [loadedSceneId, setLoadedSceneId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [baseState, setBaseState] = useState<VttFogBaseState>("revealed");
  const [regions, setRegions] = useState<VttFogRegion[]>([]);
  const [operation, setOperationState] = useState<VttFogOperation>("reveal");
  const [shape, setShapeState] = useState<VttFogDrawShape>("rectangle");
  const [draftPoints, setDraftPoints] = useState<VttFogPoint[]>([]);
  const [drawingRectangle, setDrawingRectangle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sceneId = scene?.id ?? null;
  const [draftSceneId, setDraftSceneId] = useState(sceneId);
  if (draftSceneId !== sceneId) {
    setDraftSceneId(sceneId);
    setDraftPoints([]);
    setDrawingRectangle(false);
  }

  const clampPoint = useCallback((point: VttFogPoint): VttFogPoint => {
    if (!scene) return point;
    return [
      Math.max(-scene.grid_width / 2, Math.min(scene.grid_width / 2, point[0])),
      Math.max(-scene.grid_height / 2, Math.min(scene.grid_height / 2, point[1])),
    ];
  }, [scene]);

  const refresh = useCallback(async (includeFreshTokens = false) => {
    if (!sceneId) {
      setEnabled(false);
      setBaseState("revealed");
      setRegions([]);
      setLoadedSceneId(null);
      return;
    }
    const version = ++requestVersion.current;
    setLoading(true);
    const [{ data: sceneData, error: sceneError }, { data: regionData, error: regionError }] = await Promise.all([
      supabase.from("vtt_scenes").select("fog_enabled,fog_base_state").eq("id", sceneId).single(),
      supabase.from("vtt_fog_regions").select("id,scene_id,operation,shape,points,created_at").eq("scene_id", sceneId).order("id", { ascending: true }),
    ]);
    if (version !== requestVersion.current) return;
    if (sceneError || regionError) {
      setLoadedSceneId(null);
      setError(sceneError?.message ?? regionError?.message ?? "Could not load Fog of War.");
      setLoading(false);
      return;
    }
    const row = sceneData as FogSceneRow;
    setEnabled(Boolean(row.fog_enabled));
    setBaseState(row.fog_base_state ?? "revealed");
    setRegions((regionData ?? []).map(normalizeRegion));
    setLoadedSceneId(sceneId);
    setError(null);
    setLoading(false);
    if (includeFreshTokens) await refreshTokens(sceneId).catch(() => setError("Could not refresh revealed miniatures."));
  }, [refreshTokens, sceneId, supabase]);

  useEffect(() => {
    rectangleStartRef.current = null;
    let active = true;
    void Promise.resolve().then(() => { if (active) void refresh(false); });
    return () => { active = false; };
  }, [refresh, sceneId]);

  useEffect(() => {
    const channel = supabase
      .channel(`vtt:fog:${campaignId}`, { config: { private: true } })
      .on("broadcast", { event: "fog-refresh" }, ({ payload }) => {
        const next = payload as { sceneId?: string };
        if (!next.sceneId || next.sceneId !== sceneId) return;
        void refresh(!isDm);
      });
    const unsubscribe = subscribeVttChannel(supabase, channel, (status) => {
      if (status === "SUBSCRIBED") void refresh(!isDm);
    });
    const recover = () => { if (document.visibilityState === "visible") void refresh(!isDm); };
    document.addEventListener("visibilitychange", recover);
    channelRef.current = channel;
    return () => {
      document.removeEventListener("visibilitychange", recover);
      channelRef.current = null;
      unsubscribe();
    };
  }, [campaignId, isDm, refresh, sceneId, supabase]);

  const broadcast = useCallback(() => {
    if (!sceneId) return;
    void channelRef.current?.send({ type: "broadcast", event: "fog-refresh", payload: { sceneId } });
  }, [sceneId]);

  const cancelDraft = useCallback(() => {
    rectangleStartRef.current = null;
    setDrawingRectangle(false);
    setDraftPoints([]);
  }, []);

  const setOperation = useCallback((next: VttFogOperation) => {
    cancelDraft();
    setOperationState(next);
  }, [cancelDraft]);

  const setShape = useCallback((next: VttFogDrawShape) => {
    cancelDraft();
    setShapeState(next);
  }, [cancelDraft]);

  const toggleEnabled = useCallback(async () => {
    if (!sceneId || !isDm || busy) return;
    setBusy(true);
    setError(null);
    const next = !enabled;
    const { error: updateError } = await supabase.from("vtt_scenes").update({ fog_enabled: next, updated_at: new Date().toISOString() }).eq("id", sceneId);
    if (updateError) setError(updateError.message);
    else {
      setEnabled(next);
      cancelDraft();
      broadcast();
    }
    setBusy(false);
  }, [broadcast, busy, cancelDraft, enabled, isDm, sceneId, supabase]);

  const commitRegion = useCallback(async (
    nextOperation: VttFogOperation,
    nextShape: VttFogRegion["shape"],
    nextPoints: VttFogPoint[],
  ) => {
    if (!sceneId || !isDm || busy) return false;
    const points = nextPoints.map(clampPoint);
    if (nextShape === "rectangle" && points.length !== 2) return false;
    if (nextShape === "polygon" && points.length < 3) return false;
    setBusy(true);
    setError(null);
    const { data, error: insertError } = await supabase.from("vtt_fog_regions").insert({
      scene_id: sceneId,
      operation: nextOperation,
      shape: nextShape,
      points,
      created_by: currentUserId,
    }).select("id,scene_id,operation,shape,points,created_at").single();
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not save fog region.");
      setBusy(false);
      return false;
    }
    setRegions((current) => [...current, normalizeRegion(data)]);
    cancelDraft();
    broadcast();
    setBusy(false);
    return true;
  }, [broadcast, busy, cancelDraft, clampPoint, currentUserId, isDm, sceneId, supabase]);

  const coverAll = useCallback(() => commitRegion("cover", "all", []), [commitRegion]);
  const revealAll = useCallback(() => commitRegion("reveal", "all", []), [commitRegion]);

  const undo = useCallback(async () => {
    if (!sceneId || !isDm || busy || regions.length === 0) return;
    const last = regions[regions.length - 1];
    setBusy(true);
    setError(null);
    const { error: deleteError } = await supabase.from("vtt_fog_regions").delete().eq("id", last.id).eq("scene_id", sceneId);
    if (deleteError) setError(deleteError.message);
    else {
      setRegions((current) => current.filter((region) => region.id !== last.id));
      cancelDraft();
      broadcast();
    }
    setBusy(false);
  }, [broadcast, busy, cancelDraft, isDm, regions, sceneId, supabase]);

  const pointerDown = useCallback((point: VttFogPoint) => {
    if (!enabled || !isDm || busy) return;
    const next = clampPoint(point);
    if (shape === "rectangle") {
      rectangleStartRef.current = next;
      setDraftPoints([next, next]);
      setDrawingRectangle(true);
      return;
    }
    setDraftPoints((current) => current.length >= 64 ? current : [...current, next]);
  }, [busy, clampPoint, enabled, isDm, shape]);

  const pointerMove = useCallback((point: VttFogPoint) => {
    if (!drawingRectangle || shape !== "rectangle" || !rectangleStartRef.current) return;
    setDraftPoints([rectangleStartRef.current, clampPoint(point)]);
  }, [clampPoint, drawingRectangle, shape]);

  const pointerUp = useCallback((point: VttFogPoint) => {
    if (!drawingRectangle || shape !== "rectangle" || !rectangleStartRef.current) return;
    const start = rectangleStartRef.current;
    const end = clampPoint(point);
    rectangleStartRef.current = null;
    setDrawingRectangle(false);
    if (Math.abs(start[0] - end[0]) < 0.05 && Math.abs(start[1] - end[1]) < 0.05) {
      setDraftPoints([]);
      return;
    }
    setDraftPoints([start, end]);
    void commitRegion(operation, "rectangle", [start, end]);
  }, [clampPoint, commitRegion, drawingRectangle, operation, shape]);

  const finishPolygon = useCallback(() => {
    if (shape !== "polygon" || draftPoints.length < 3) return;
    void commitRegion(operation, "polygon", draftPoints);
  }, [commitRegion, draftPoints, operation, shape]);

  const displayTokens = useMemo(() => {
    if (isDm && !playerPreview) return tokens;
    if (loadedSceneId !== sceneId) return [];
    return tokens.filter((token) => token.visible_to_players && isFogPointRevealed(enabled, baseState, regions, snapTokenCoordinate(token.x, scene?.grid_width ?? 24, token.size_squares), snapTokenCoordinate(token.z, scene?.grid_height ?? 18, token.size_squares)));
  }, [baseState, enabled, isDm, loadedSceneId, playerPreview, regions, sceneId, scene?.grid_width, scene?.grid_height, tokens]);

  const waitingForFog = Boolean(sceneId) && loadedSceneId !== sceneId;
  const protectPlayerView = (!isDm || playerPreview) && waitingForFog;
  return {
    enabled: protectPlayerView ? true : enabled,
    baseState: protectPlayerView ? "covered" as const : baseState,
    regions: protectPlayerView ? [] : regions,
    operation,
    shape,
    draftPoints,
    drawingRectangle,
    busy,
    loading,
    error,
    displayTokens,
    canUndo: regions.length > 0,
    setOperation,
    setShape,
    toggleEnabled,
    coverAll,
    revealAll,
    undo,
    cancelDraft,
    pointerDown,
    pointerMove,
    pointerUp,
    finishPolygon,
  };
}
