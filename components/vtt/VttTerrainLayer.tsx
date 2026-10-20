"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { SupabaseClient } from "@supabase/supabase-js";
import { disposeTerrainModel } from "@/lib/terrain/terrainGeometry";
import { readTerrainFile } from "@/lib/terrain/terrainModels";
import type { TerrainAssetRow } from "@/lib/terrain/terrainTypes";
import type { VttSceneTerrainInstance } from "./terrainSceneTypes";

type Props = {
  instances: VttSceneTerrainInstance[];
  assets: TerrainAssetRow[];
  supabase: SupabaseClient;
  selectedId: string | null;
  canSelect: boolean;
  onSelect: (id: string) => void;
  onError?: (error: string | null) => void;
};

type LoadedTerrain = { path:string; object:THREE.Group };

function TerrainObject({ instance, model, selected, onClick, canSelect }: {
  instance: VttSceneTerrainInstance; model: THREE.Object3D; selected: boolean;
  canSelect: boolean; onClick: (id:string)=>void;
}) {
  // Every scene object gets its own transform while sharing cached geometry/materials.
  const clone = useMemo(() => model.clone(true),[model]);
  const down = (event:ThreeEvent<PointerEvent>) => {
    if (!canSelect || event.button!==0) return;
    event.stopPropagation();
    onClick(instance.id);
  };
  return <group position={[instance.position_x,0.04,instance.position_z]}
    rotation={[0,instance.rotation_y,0]} scale={instance.scale}>
      <group onPointerDown={down}><primitive object={clone} dispose={null}/></group>
      {selected && <mesh position={[0,0.028,0]} rotation={[-Math.PI/2,0,0]} raycast={() => undefined}>
        <ringGeometry args={[0.40,0.49,40]}/>
        <meshBasicMaterial color="#22d3ee" depthTest={false} transparent opacity={0.86} side={THREE.DoubleSide}/>
      </mesh>}
    </group>;
}

export function VttTerrainLayer({instances,assets,supabase,selectedId,canSelect,onSelect,onError}:Props) {
  const [loaded,setLoaded]=useState<Map<string,LoadedTerrain>>(new Map());
  const byId=useMemo(() => new Map(assets.map((asset)=>[asset.id,asset])),[assets]);
  const paths=useMemo(() => [...new Set(instances.map((inst)=>byId.get(inst.terrain_asset_id)?.storage_path).filter((p):p is string=>Boolean(p)))].sort(),[instances,byId]);
  const keys=paths.join("|");

  useEffect(()=>{
    let alive=true;
    const cache=new Map<string,LoadedTerrain>();
    setLoaded(new Map());
    onError?.(null);
    void Promise.all(paths.map(async (path)=>{
      const {data,error}=await supabase.storage.from("vtt-terrain-assets").download(path);
      if(error||!data)throw new Error("Terrain "+path+": "+(error?.message??"File was not found"));
      const file=new File([data],path.split("/").at(-1)??"terrain.glb",{type:data.type||"model/gltf-binary"});
      const result=await readTerrainFile(file);
      if(!alive){disposeTerrainModel(result.model);return;}
      cache.set(path,{path,object:result.model});
      setLoaded(new Map(cache));
    })).catch((cause)=>{
      if(alive)onError?.(cause instanceof Error?cause.message:"Some terrain objects could not load.");
    });
    return ()=>{
      alive=false;
      cache.forEach((asset)=>disposeTerrainModel(asset.object));
      cache.clear();
    };
    // Reuse geometries while the set of scene model paths remains the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[keys,supabase]);

  return <group name="scene-terrain">
    {instances.map((instance)=>{
      const path=byId.get(instance.terrain_asset_id)?.storage_path;
      const asset=path?loaded.get(path):null;
      if(!asset)return null;
      return <TerrainObject key={instance.id} instance={instance} model={asset.object}
        canSelect={canSelect} selected={selectedId===instance.id} onClick={onSelect}/>;
    })}
  </group>;
}
