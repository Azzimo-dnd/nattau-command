"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { disposeTerrainModel } from "@/lib/terrain/terrainGeometry";
import { generateTerrainFile, readTerrainFile } from "@/lib/terrain/terrainModels";
import { deleteTerrainAsset, saveTerrainAsset, TERRAIN_BUCKET, type TerrainAssetGateway } from "@/lib/terrain/terrainAssetOperations";
import { isTerrainCategory } from "@/lib/terrain/terrainTypes";
import type { TerrainAssetRow, TerrainCategory, TerrainRecipe, TerrainStatus } from "@/lib/terrain/terrainTypes";

const FIELDS = "id,campaign_id,name,category,status,source_kind,storage_path,original_name,file_size_bytes,mesh_count,triangle_count,width_units,height_units,depth_units,default_scale,has_textures,pivot_mode,generator_recipe,created_at";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useTerrainAssets(campaignId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [assets, setAssets] = useState<TerrainAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState(false);

  const gateway = useMemo<TerrainAssetGateway>(() => ({
    upload: async (path, file) => {
      const { error: uploadError } = await supabase.storage.from(TERRAIN_BUCKET).upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: "model/gltf-binary",
      });
      if (uploadError) throw uploadError;
    },
    register: async (metadata) => {
      const { error: insertError } = await supabase.from("vtt_terrain_assets").insert(metadata);
      if (insertError) throw insertError;
    },
    removeFile: async (path) => {
      const { data, error: removeError } = await supabase.storage.from(TERRAIN_BUCKET).remove([path]);
      if (removeError) throw removeError;
      if (!data?.some((item) => item.name === path || path.endsWith("/" + item.name))) {
        throw new Error("Storage did not confirm the model was removed.");
      }
    },
    deleteRecord: async (asset) => {
      const { data, error: deleteError } = await supabase.from("vtt_terrain_assets")
        .delete().eq("id", asset.id).eq("campaign_id", asset.campaign_id).select("id");
      if (deleteError) throw deleteError;
      return data?.length === 1;
    },
  }), [supabase]);

  const refresh = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase.from("vtt_terrain_assets")
        .select(FIELDS).eq("campaign_id", campaignId).order("created_at", { ascending: false });
      if (fetchError) throw fetchError;
      setAssets((data ?? []) as TerrainAssetRow[]);
      setBackendReady(true);
      setError(null);
      return true;
    } catch (cause) {
      // Fail closed: never allow writes when the library/table cannot be verified.
      setBackendReady(false);
      setError("Saved terrain library is unavailable. Apply the Terrain Studio migration to a development database. " + errorText(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }, [campaignId, supabase]);

  useEffect(() => { void refresh(); }, [refresh]);

  const operate = useCallback(async (action: () => Promise<string>): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true); setError(null); setMessage(null);
    try {
      const text = await action();
      setMessage(text);
      return true;
    } catch (cause) {
      setError(errorText(cause));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const store = useCallback(async (
    file: File, metrics: Parameters<typeof saveTerrainAsset>[1]["metrics"],
    name: string, category: TerrainCategory, sourceKind: "generated" | "uploaded",
    recipe: TerrainRecipe | null, scale: number
  ) => {
    if (!backendReady) throw new Error("Terrain persistence is not configured. Please use the preview or GLB export.");
    await saveTerrainAsset(gateway, {
      campaignId, objectId: crypto.randomUUID(), file, metrics, name, category, sourceKind, recipe, scale,
    });
    if (!(await refresh())) throw new Error("File saved, but library refresh failed. Reload to verify the asset before retrying.");
  }, [backendReady, campaignId, gateway, refresh]);

  const saveGenerated = useCallback((recipe: TerrainRecipe, name: string, category: TerrainCategory, scale = 1) =>
    operate(async () => {
      const prepared = await generateTerrainFile(recipe, name);
      await store(prepared.file, prepared.metrics, name, category, "generated", recipe, scale);
      return name + " saved as a draft terrain asset.";
    }), [operate, store]);

  const saveUpload = useCallback((file: File, name: string, category: TerrainCategory, scale = 1) =>
    operate(async () => {
      const { model, metrics } = await readTerrainFile(file);
      disposeTerrainModel(model);
      await store(file, metrics, name, category, "uploaded", null, scale);
      return name + " uploaded as a draft terrain asset.";
    }), [operate, store]);

  const updateAsset = useCallback((asset: TerrainAssetRow, patch: { name?: string; status?: TerrainStatus; category?: TerrainCategory }) =>
    operate(async () => {
      const updated = { ...patch };
      if (updated.name !== undefined) {
        updated.name = updated.name.trim();
        if (!updated.name || updated.name.length > 120) throw new Error("Invalid terrain name.");
      }
      if (updated.category !== undefined && !isTerrainCategory(updated.category)) throw new Error("Unknown terrain category.");
      if (updated.status !== undefined && !["draft","approved","archived"].includes(updated.status)) throw new Error("Unknown status.");
      const { data, error: updateError } = await supabase.from("vtt_terrain_assets")
        .update(updated).eq("id", asset.id).eq("campaign_id", campaignId).select("id");
      if (updateError) throw updateError;
      if (!data?.length) throw new Error("Asset was not updated. Check your GM permissions.");
      if (!(await refresh())) throw new Error("Changes were saved, but library refresh failed.");
      return (updated.name ?? asset.name) + " updated.";
    }), [campaignId, operate, refresh, supabase]);

  const removeAsset = useCallback((asset: TerrainAssetRow) =>
    operate(async () => {
      if (!backendReady) throw new Error("Terrain library is unavailable.");
      try {
        await deleteTerrainAsset(gateway, asset);
      } catch (cause) {
        // A failed cleanup may still have removed the metadata. Keep the list accurate.
        await refresh();
        throw cause;
      }
      if (!(await refresh())) throw new Error("Asset deleted, but the library could not refresh.");
      return asset.name + " deleted.";
    }), [backendReady, gateway, operate, refresh]);

  const downloadAsset = useCallback(async (asset: TerrainAssetRow) => {
    if (asset.campaign_id !== campaignId) throw new Error("Terrain asset belongs to a different campaign.");
    const { data, error: downloadError } = await supabase.storage.from(TERRAIN_BUCKET).download(asset.storage_path);
    if (downloadError || !data) throw downloadError ?? new Error("No model was returned.");
    return new File([data], asset.original_name, { type: data.type || "model/gltf-binary" });
  }, [campaignId, supabase]);

  return { assets, loading, busy, error, message, backendReady, refresh, saveGenerated, saveUpload, updateAsset, removeAsset, downloadAsset };
}
