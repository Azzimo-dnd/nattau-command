"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { disposeTerrainModel } from "@/lib/terrain/terrainGeometry";
import { generateTerrainFile, readTerrainFile, validateTerrainFile, type TerrainModelMetrics } from "@/lib/terrain/terrainModels";
import type { TerrainAssetRow, TerrainCategory, TerrainRecipe, TerrainStatus } from "@/lib/terrain/terrainTypes";

const FIELDS = "id,campaign_id,name,category,status,source_kind,storage_path,original_name,file_size_bytes,mesh_count,triangle_count,width_units,height_units,depth_units,default_scale,has_textures,pivot_mode,generator_recipe,created_at";
const BUCKET = "vtt-terrain-assets";

export function useTerrainAssets(campaignId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [assets, setAssets] = useState<TerrainAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: resultError } = await supabase.from("vtt_terrain_assets")
      .select(FIELDS).eq("campaign_id", campaignId).order("created_at", { ascending: false });
    if (resultError) {
      setBackendReady(false);
      setError("Saved terrain library is unavailable. Apply the Terrain Studio migration to the development database. " + resultError.message);
    } else {
      setAssets((data ?? []) as TerrainAssetRow[]);
      setBackendReady(true);
      setError(null);
    }
    setLoading(false);
  }, [campaignId, supabase]);

  useEffect(() => { void refresh(); }, [refresh]);

  const store = useCallback(async (
    file: File, metrics: TerrainModelMetrics,
    name: string, category: TerrainCategory, sourceKind: "generated" | "uploaded", recipe: TerrainRecipe | null
  ) => {
    if (!backendReady) throw new Error("Terrain persistence is not configured. Use the local preview and GLB export until the migration is applied.");
    validateTerrainFile(file);
    if (!name.trim() || name.trim().length > 120) throw new Error("Name must have between 1 and 120 characters.");
    const storagePath = campaignId + "/" + crypto.randomUUID() + ".glb";
    const { error: storageError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      cacheControl: "3600", upsert: false, contentType: "model/gltf-binary",
    });
    if (storageError) throw storageError;
    try {
      const { error: insertError } = await supabase.from("vtt_terrain_assets").insert({
        campaign_id: campaignId, name: name.trim(), category, status: "draft", source_kind: sourceKind,
        storage_path: storagePath, original_name: file.name, file_size_bytes: file.size,
        mesh_count: metrics.meshes, triangle_count: metrics.triangles,
        width_units: metrics.width, height_units: metrics.height, depth_units: metrics.depth,
        default_scale: 1, has_textures: metrics.hasTextures, pivot_mode: "centered_base",
        generator_recipe: recipe,
      });
      if (insertError) throw insertError;
    } catch (cause) {
      // Registration failed. Do not leave a newly-uploaded orphan.
      const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([storagePath]);
      if (cleanupError) throw new Error("Terrain registration failed and storage cleanup also failed: " + cleanupError.message);
      throw cause;
    }
    await refresh();
  }, [backendReady, campaignId, refresh, supabase]);

  const saveGenerated = useCallback(async (recipe: TerrainRecipe, name: string, category: TerrainCategory) => {
    if (busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const prepared = await generateTerrainFile(recipe, name);
      await store(prepared.file, prepared.metrics, name, category, "generated", recipe);
      setMessage(name + " saved as a draft terrain asset.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save generated terrain.");
    } finally { setBusy(false); }
  }, [busy, store]);

  const saveUpload = useCallback(async (file: File, name: string, category: TerrainCategory) => {
    if (busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const parsed = await readTerrainFile(file);
      const metrics = parsed.metrics;
      disposeTerrainModel(parsed.model);
      await store(file, metrics, name, category, "uploaded", null);
      setMessage(name + " uploaded as a draft terrain asset.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload terrain.");
    } finally { setBusy(false); }
  }, [busy, store]);

  const updateAsset = useCallback(async (asset: TerrainAssetRow, patch: { name?: string; status?: TerrainStatus; category?: TerrainCategory }) => {
    if (busy || !backendReady) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      if (patch.name !== undefined && (!patch.name.trim() || patch.name.trim().length > 120)) throw new Error("Invalid name.");
      const { error: updateError } = await supabase.from("vtt_terrain_assets")
        .update(patch).eq("id", asset.id).eq("campaign_id", campaignId);
      if (updateError) throw updateError;
      await refresh();
      setMessage(asset.name + " updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update terrain.");
    } finally { setBusy(false); }
  }, [backendReady, busy, campaignId, refresh, supabase]);

  const removeAsset = useCallback(async (asset: TerrainAssetRow) => {
    if (busy || !backendReady) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const { error: deleteError } = await supabase.from("vtt_terrain_assets")
        .delete().eq("id", asset.id).eq("campaign_id", campaignId);
      if (deleteError) throw deleteError;
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([asset.storage_path]);
      await refresh();
      if (storageError) {
        setError("Metadata deleted, but the model file could not be removed. Cleanup required: " + asset.storage_path);
      } else setMessage(asset.name + " deleted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete terrain.");
    } finally { setBusy(false); }
  }, [backendReady, busy, campaignId, refresh, supabase]);

  const downloadAsset = useCallback(async (asset: TerrainAssetRow) => {
    const { data, error: downloadError } = await supabase.storage.from(BUCKET).download(asset.storage_path);
    if (downloadError || !data) throw downloadError ?? new Error("No model was returned.");
    return new File([data], asset.original_name, { type: data.type || "model/gltf-binary" });
  }, [supabase]);

  return { assets, loading, busy, error, message, backendReady, refresh, saveGenerated, saveUpload, updateAsset, removeAsset, downloadAsset };
}
