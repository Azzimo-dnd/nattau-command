"use client";

import type { TerrainAssetRow } from "@/lib/terrain/terrainTypes";
import type { VttSceneTerrainInstance } from "./terrainSceneTypes";

type Props={
  assets:TerrainAssetRow[];
  instances:VttSceneTerrainInstance[];
  activeAssetId:string|null;
  selected:VttSceneTerrainInstance|null;
  busy:boolean;
  loading:boolean;
  error:string|null;
  notice:string|null;
  toolActive:boolean;
  onAsset:(id:string)=>void;
  onSelect:(id:string|null)=>void;
  onRotate:(delta:number)=>void;
  onScale:(scale:number)=>void;
  onDuplicate:()=>void;
  onDelete:()=>void;
  onRefresh:()=>void;
};

export function VttTerrainPanel({assets,instances,activeAssetId,selected,busy,loading,error,notice,toolActive,
  onAsset,onSelect,onRotate,onScale,onDuplicate,onDelete,onRefresh}:Props){
  const baseButton="min-h-9 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-xs font-bold text-slate-200 disabled:opacity-40 hover:border-cyan-400/40";
  return <section className="space-y-3 rounded-[26px] border border-cyan-300/20 bg-slate-900/75 p-4">
    <div className="flex items-center justify-between gap-2">
      <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Terrain · Saved 3D props</p>
        <p className="mt-1 text-[11px] text-slate-500">{instances.length} placed on this scene</p></div>
      <button type="button" className={baseButton} disabled={busy||loading} onClick={onRefresh}>Refresh</button>
    </div>
    <p className="text-xs leading-5 text-slate-400">Choose a saved crate or other model, then enable <strong className="text-cyan-200">Terrain</strong> above the map and click the floor. Terrain is currently GM-only.</p>
    {error&&<p role="alert" className="rounded-lg border border-rose-400/30 p-2 text-xs text-rose-200">{error}</p>}
    {notice&&<p role="status" className="text-xs text-emerald-200">{notice}</p>}
    {loading&&<p className="text-xs text-slate-500">Loading saved models…</p>}
    <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
      {assets.filter((asset)=>asset.status!=="archived").map(asset=><button type="button" key={asset.id} disabled={busy} onClick={()=>onAsset(asset.id)}
        className={`w-full rounded-xl border px-3 py-2.5 text-left disabled:opacity-40 ${activeAssetId===asset.id?"border-cyan-400 bg-cyan-400/15 text-cyan-50":"border-slate-700 bg-slate-950/60 text-slate-200 hover:border-cyan-400/35"}`}>
        <span className="block truncate text-xs font-bold">{asset.name}</span>
        <span className="block text-[10px] capitalize text-slate-500">{asset.category} · {asset.status} · {asset.default_scale.toFixed(2)}x</span>
      </button>)}
      {!assets.length&&!loading&&<p className="text-xs text-slate-500">No saved models found. Save a model in Terrain Asset Studio first.</p>}
    </div>
    {activeAssetId&&<div className="rounded-lg bg-cyan-950/30 px-3 py-2 text-xs text-cyan-200">
      {toolActive?"Click an empty area of the map to place another copy.":"Model selected. Click Terrain above the map to start placing."}
    </div>}
    {instances.length>0&&<label className="block text-xs text-slate-400">Placed objects
      <select value={selected?.id??""} onChange={e=>onSelect(e.target.value||null)}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
        <option value="">Select a placed object</option>
        {instances.map((item,i)=><option key={item.id} value={item.id}>#{i+1} · {assets.find(a=>a.id===item.terrain_asset_id)?.name??"Terrain"} ({item.position_x.toFixed(1)}, {item.position_z.toFixed(1)})</option>)}
      </select>
    </label>}
    {selected&&<div className="space-y-2 rounded-xl border border-slate-700 p-3">
      <p className="text-xs font-bold text-slate-200">Selected terrain object</p>
      <p className="text-xs text-slate-400">X: {selected.position_x.toFixed(2)} · Z: {selected.position_z.toFixed(2)} · Rotation: {Math.round(selected.rotation_y*180/Math.PI)}°</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={baseButton} disabled={busy} onClick={()=>onRotate(-Math.PI/4)}>↶ Rotate 45°</button>
        <button type="button" className={baseButton} disabled={busy} onClick={()=>onRotate(Math.PI/4)}>↷ Rotate 45°</button>
      </div>
      <label className="block text-xs text-slate-400">Size: {selected.scale.toFixed(2)}x
        <input type="range" className="mt-2 w-full accent-cyan-400" min="0.1" max="5" step="0.05"
          disabled={busy} value={selected.scale} onChange={e=>onScale(Number(e.target.value))}/>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={baseButton} disabled={busy} onClick={onDuplicate}>Duplicate</button>
        <button type="button" className="min-h-9 rounded-xl border border-rose-400/30 px-3 text-xs font-bold text-rose-200 disabled:opacity-40" disabled={busy} onClick={onDelete}>Delete</button>
      </div>
    </div>}
    <p className="text-[10px] text-slate-500">Alpha: GM-only terrain. No player reveal, fog visibility or physics collisions yet.</p>
  </section>;
}
