"use client";
import {useState} from "react";
import {SPELL_AREA_COLORS,type VttSpellArea} from "./vttSpellAreas";
type Props={
 areas:VttSpellArea[];currentRadius:number|null;busy:boolean;loading:boolean;error:string|null;notice:string|null;
 feetPerSquare:number;isDm:boolean;
 onAdd:(label:string,color:string,visible:boolean)=>void;
 onRemove:(id:string)=>void;onVisibility:(id:string,visible:boolean)=>void;
};
export function VttSpellAreasPanel({areas,currentRadius,busy,loading,error,notice,feetPerSquare,isDm,
 onAdd,onRemove,onVisibility}:Props){
 const [label,setLabel]=useState("Lingering spell");
 const [color,setColor]=useState<string>(SPELL_AREA_COLORS[0].hex);
 const [showPlayers,setShowPlayers]=useState(true);
 return <section className="rounded-2xl border border-fuchsia-400/25 bg-slate-900/85 p-3" aria-label="Persistent spell areas">
  <div className="flex items-center justify-between gap-2">
   <h3 className="text-xs font-black uppercase tracking-[0.12em] text-fuchsia-200">Spell areas · {areas.length} saved</h3>
   {loading&&<span className="text-[10px] text-slate-400">Refreshing…</span>}
  </div>
  {isDm&&<div className="mt-3 space-y-2">
   <p className="text-[11px] text-slate-400">Draw a Spell radius on the map, then pin it. Pinned circles remain after refresh and can overlap.</p>
   <div className="flex flex-wrap gap-2">
    <input aria-label="Spell area name" maxLength={80} value={label} onChange={e=>setLabel(e.target.value)}
      className="min-h-9 min-w-28 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-100"/>
    <span className="self-center text-[10px] text-slate-500">{currentRadius?.toFixed(1)??"—"} sq</span>
   </div>
   <fieldset className="flex flex-wrap gap-2" aria-label="Spell area color">
    {SPELL_AREA_COLORS.map(item=><button key={item.hex} type="button" title={item.label}
      aria-label={item.label} aria-pressed={color===item.hex}
      onClick={()=>setColor(item.hex)} className={`h-7 w-7 rounded-full border-2 ${color===item.hex?"border-white ring-2 ring-fuchsia-300":"border-slate-700"}`}
      style={{backgroundColor:item.hex}}/>)}
   </fieldset>
   <label className="flex items-center gap-2 text-xs text-slate-300">
    <input type="checkbox" className="accent-fuchsia-400" checked={showPlayers} onChange={e=>setShowPlayers(e.target.checked)}/>
    Visible to players (subject to fog of war)
   </label>
   <button type="button" disabled={busy||!currentRadius||currentRadius<0.1||!label.trim()}
     onClick={()=>onAdd(label,color,showPlayers)}
     className="min-h-9 w-full rounded-lg border border-fuchsia-400/40 bg-fuchsia-400/10 px-3 text-xs font-bold text-fuchsia-100 disabled:opacity-40">
    Pin current spell radius
   </button>
  </div>}
  {error&&<p role="alert" className="mt-2 text-xs text-rose-200">{error}</p>}
  {notice&&<p role="status" className="mt-2 text-xs text-emerald-200">{notice}</p>}
  <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto">
   {areas.map(a=><div key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
    <span className="h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:a.color}}/>
    <div className="min-w-0 flex-1">
     <p className="truncate text-xs font-medium text-slate-200">{a.label}</p>
     <p className="text-[10px] text-slate-500">{a.radius.toFixed(1)} sq · {(a.radius*feetPerSquare).toFixed(0)} ft · {a.visible_to_players?"Shared":"GM only"}</p>
    </div>
    {isDm&&<>
     <button disabled={busy} type="button" onClick={()=>onVisibility(a.id,!a.visible_to_players)}
       className="min-h-8 rounded-lg border border-slate-700 px-2 text-[10px] text-slate-300 disabled:opacity-40">{a.visible_to_players?"Hide":"Show"}</button>
     <button disabled={busy} type="button" aria-label={`Remove ${a.label}`}
       onClick={()=>onRemove(a.id)}
       className="min-h-8 rounded-lg border border-rose-400/25 px-2 text-[10px] text-rose-200 disabled:opacity-40">Remove</button>
    </>}
   </div>)}
   {!areas.length&&<p className="text-[11px] text-slate-500">No persistent effects on this scene.</p>}
  </div>
 </section>;
}
