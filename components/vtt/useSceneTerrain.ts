"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TerrainAssetRow } from "@/lib/terrain/terrainTypes";
import type { VttSceneTerrainInstance } from "./terrainSceneTypes";
import { clampTerrainPoint, normalizeTerrainRotation } from "./terrainSceneTypes";

const INSTANCE_FIELDS = "id,campaign_id,scene_id,terrain_asset_id,position_x,position_z,rotation_y,scale,visible_to_players,created_at";
const ASSET_FIELDS = "id,campaign_id,name,category,status,source_kind,storage_path,original_name,file_size_bytes,mesh_count,triangle_count,width_units,height_units,depth_units,default_scale,has_textures,pivot_mode,generator_recipe,created_at";

function explain(error: unknown) { return error instanceof Error ? error.message : String(error); }

export function useSceneTerrain(campaignId: string, sceneId: string | null, gridWidth: number, gridHeight: number, isDm: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [assets, setAssets] = useState<TerrainAssetRow[]>([]);
  const [instances, setInstances] = useState<VttSceneTerrainInstance[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadedScene = useRef<string | null>(null);
  const request = useRef(0);
  const activeAsset = assets.find((asset) => asset.id === activeAssetId) ?? null;
  const selected = instances.find((instance) => instance.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    const serial = ++request.current;
    if (!isDm || !sceneId) { setAssets([]); setInstances([]); setError(null); return; }
    setLoading(true);
    try {
      const [modelResult, sceneResult] = await Promise.all([
        supabase.from("vtt_terrain_assets").select(ASSET_FIELDS).eq("campaign_id",campaignId).order("name"),
        supabase.from("vtt_scene_terrain_instances").select(INSTANCE_FIELDS).eq("campaign_id",campaignId).eq("scene_id",sceneId).order("created_at"),
      ]);
      if (modelResult.error) throw modelResult.error;
      if (sceneResult.error) throw sceneResult.error;
      if (serial !== request.current) return;
      const items = (modelResult.data ?? []) as TerrainAssetRow[];
      const placed = (sceneResult.data ?? []) as VttSceneTerrainInstance[];
      setAssets(items);
      setInstances(placed);
      setSelectedId((previous) => previous && placed.some((item) => item.id === previous) ? previous : null);
      setActiveAssetId((previous) => previous && items.some((item) => item.id === previous) ? previous : null);
      setError(null);
    } catch(cause) {
      if (serial === request.current) {
        setAssets([]);
        setInstances([]);
        setError("Terrain Placement is not configured yet: " + explain(cause));
      }
    } finally { if (serial === request.current) setLoading(false); }
  }, [campaignId,isDm,sceneId,supabase]);

  useEffect(() => {
    if (loadedScene.current !== sceneId) {
      loadedScene.current = sceneId;
      setSelectedId(null);
      setActiveAssetId(null);
      setInstances([]);
    }
    void refresh();
    return () => { ++request.current; };
  }, [sceneId, refresh]);

  const mutate = useCallback(async (action: () => Promise<string>) => {
    if (!sceneId || !isDm || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const result = await action();
      await refresh();
      setNotice(result);
      return true;
    } catch(cause) {
      setError(explain(cause));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [isDm,refresh,sceneId]);

  const place = useCallback(async (point: [number,number]) => {
    if (!sceneId || !activeAsset || !isDm || activeAsset.status === "archived") return false;
    const [x,z] = clampTerrainPoint(point[0],point[1],gridWidth,gridHeight);
    const assetId = activeAsset.id;
    return mutate(async () => {
      const { data, error: insertError } = await supabase.from("vtt_scene_terrain_instances").insert({
        campaign_id:campaignId,scene_id:sceneId,terrain_asset_id:assetId, position_x:x,position_z:z,
        scale:activeAsset.default_scale,rotation_y:0,visible_to_players:false
      }).select("id").single();
      if (insertError) throw insertError;
      if (!data) throw new Error("Terrain placement did not return an instance.");
      setSelectedId(data.id);
      return activeAsset.name+" placed on this scene.";
    });
  }, [activeAsset,campaignId,gridHeight,gridWidth,isDm,mutate,sceneId,supabase]);

  const removeSelected = useCallback(() => mutate(async () => {
    if (!selectedId) throw new Error("Select a placed object first.");
    const { data, error: deleteError } = await supabase.from("vtt_scene_terrain_instances")
      .delete().eq("id",selectedId).eq("scene_id",sceneId!).eq("campaign_id",campaignId).select("id");
    if (deleteError) throw deleteError;
    if (data?.length !== 1) throw new Error("The object was not deleted.");
    setSelectedId(null);
    return "Terrain object removed.";
  }), [campaignId,mutate,sceneId,selectedId,supabase]);

  const updateSelected = useCallback((patch: {rotation_y?: number; scale?: number; position_x?:number; position_z?:number}) =>
    mutate(async () => {
      if (!selected) throw new Error("Select a placed object first.");
      const values={...patch};
      if (values.rotation_y!==undefined) values.rotation_y=normalizeTerrainRotation(values.rotation_y);
      if(values.scale!==undefined && (!Number.isFinite(values.scale)||values.scale<0.1||values.scale>10))
        throw new Error("Scale must be between 0.1 and 10.");
      if(values.position_x!==undefined||values.position_z!==undefined){
        const [x,z]=clampTerrainPoint(values.position_x??selected.position_x,values.position_z??selected.position_z,gridWidth,gridHeight);
        values.position_x=x;values.position_z=z;
      }
      const { data,error: updateError }=await supabase.from("vtt_scene_terrain_instances")
        .update(values).eq("id",selected.id).eq("scene_id",sceneId!).eq("campaign_id",campaignId).select("id");
      if(updateError) throw updateError;
      if(data?.length!==1)throw new Error("Terrain object was not updated.");
      return "Object transformation saved.";
    }),[campaignId,gridWidth,gridHeight,mutate,sceneId,selected,supabase]);

  const duplicateSelected = useCallback(() => mutate(async () => {
    if (!selected) throw new Error("Select an object to duplicate.");
    const [x,z]=clampTerrainPoint(selected.position_x+0.8,selected.position_z+0.8,gridWidth,gridHeight);
    const {data,error:insertError}=await supabase.from("vtt_scene_terrain_instances")
      .insert({campaign_id:campaignId,scene_id:sceneId!,terrain_asset_id:selected.terrain_asset_id,
        position_x:x,position_z:z,rotation_y:selected.rotation_y,scale:selected.scale,visible_to_players:false})
      .select("id").single();
    if(insertError)throw insertError;
    if(!data)throw new Error("No duplicated instance was returned.");
    setSelectedId(data.id);
    return "Terrain object duplicated.";
  }),[campaignId,gridWidth,gridHeight,mutate,sceneId,selected,supabase]);

  return {assets,instances,activeAsset,activeAssetId,setActiveAssetId,
    selected,selectedId,setSelectedId,loading,busy,error,notice,refresh,place,removeSelected,updateSelected,duplicateSelected};
}
