"use client";
import {useEffect,useState} from "react";
import {SPELL_AREA_COLORS,type VttSpellArea} from "./vttSpellAreas";
import type {SpellShape} from "./vttConeMath";
type Props={
 areas:VttSpellArea[];currentRadius:number|null;currentShape:SpellShape;
 busy:boolean;loading:boolean;error:string|null;notice:string|null;
 feetPerSquare:number;isDm:boolean;
 onAdd:(label:string,color:string,visible:boolean)=>void;
 onUpdateCone:(id:string,length:number,direction:number)=>void;
 onRemove:(id:string)=>void;onVisibility:(id:string,visible:boolean)=>void;
};
/** The selected saved cone may be adjusted without deleting or moving its origin. */
function ConeEditor({area,busy,onUpdate}:{area:VttSpellArea;busy:boolean;
 onUpdate:(id:string,length:number,direction:number)=>void}){
 const [length,setLength]=useState(String(area.radius));
 const [angle,setAngle]=useState(String(Math.round(area.direction_rad*180/Math.PI)));
 useEffect(()=>{setLength(String(area.radius));setAngle(String(Math.round(area.direction_rad*180/Math.PI)));},
   [area.radius,area.direction_rad]);
 const n=Number(length),degrees=Number(angle);
 const valid=Number.isFinite(n)&&n>=0.1&&n<=100&&Number.isFinite(degrees)&&degrees>=-180&&degrees<=180;
 return <div className="mt-2 flex flex-wrap items-end gap-2">
   <label className="text-[10px] text-slate-400">Length (squares)
    <input aria-label={`Length for ${area.label}`} type="number" step="0.5" min="0.1" max="100"
      value={length} onChange={e=>setLength(e.target.value)}
      className="mt-1 block h-9 w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100"/>
   </label>
   <label className="text-[10px] text-slate-400">Direction (°)
    <input aria-label={`Angle for ${area.label}`} type="number" min="-180" max="180" step="15"
      value={angle} onChange={e=>setAngle(e.target.value)}
      className="mt-1 block h-9 w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100"/>
   </label>
   <button type="button" disabled={busy||!valid} onClick={()=>onUpdate(area.id,n,degrees*Math.PI/180)}
    className="h-9 rounded-lg border border-fuchsia-400/40 px-3 text-[11px] font-bold text-fuchsia-100 disabled:opacity-40">
    Update cone
   </button>
 </div>;
}
export function VttSpellAreasPanel({areas,currentRadius,currentShape,busy,loading,error,notice,feetPerSquare,isDm,
 onAdd,onUpdateCone,onRemove,onVisibility}:Props){
 const [label,setLabel]=useState("Lingering spell");
 const [color,setColor]=useState<string>(SPELL_AREA_COLORS[0].hex);
 const [showPlayers,setShowPlayers]=useState(true);
 const [editing,setEditing]=useState<string|null>(null);
 return <section className="rounded-2xl border border-fuchsia-400/25 bg-slate-900/85 p-3" aria-label="Persistent spell areas">
  <div className="flex items-center justify-between gap-2">
   <h3 className="text-xs font-black uppercase tracking-[0.12em] text-fuchsia-200">Spell areas · {areas.length} saved</h3>
   {loading&&<span className="text-[10px] text-slate-400">Refreshing…</span>}
  </div>
  {isDm&&<div className="mt-3 space-y-2">
   <p className="text-[11px] text-slate-400">Draw a circle or 5e cone on the map, then pin it. The cone widens to its full length at the far edge. Multiple areas can overlap and survive refresh.</p>
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
    Pin current {currentShape==="cone"?"cone":"spell radius"}
   </button>
  </div>}
  {error&&<p role="alert" className="mt-2 text-xs text-rose-200">{error}</p>}
  {notice&&<p role="status" className="mt-2 text-xs text-emerald-200">{notice}</p>}
  <div className="mt-3 max-h-60 space-y-1.5 overflow-y-auto">
   {areas.map(a=><div key={a.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
    <div className="flex items-center gap-2">
     <span className="h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:a.color}}/>
     <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-medium text-slate-200">{a.shape_type==="cone"?"△":"◯"} {a.label}</p>
      <p className="text-[10px] text-slate-500">{a.shape_type==="cone"?"Length":"Radius"} {Number((a.radius*feetPerSquare).toFixed(1)).toLocaleString("en-US",{maximumFractionDigits:1})} ft · {a.visible_to_players?"Shared":"GM only"}</p>
     </div>
     {isDm&&<>
      {a.shape_type==="cone"&&<button type="button" disabled={busy} onClick={()=>setEditing(old=>old===a.id?null:a.id)}
       className="min-h-8 rounded-lg border border-slate-700 px-2 text-[10px] text-slate-300">{editing===a.id?"Close":"Edit"}</button>}
      <button disabled={busy} type="button" onClick={()=>onVisibility(a.id,!a.visible_to_players)}
       className="min-h-8 rounded-lg border border-slate-700 px-2 text-[10px] text-slate-300 disabled:opacity-40">{a.visible_to_players?"Hide":"Show"}</button>
      <button disabled={busy} type="button" aria-label={`Remove ${a.label}`}
       onClick={()=>{setEditing(null);onRemove(a.id);}}
       className="min-h-8 rounded-lg border border-rose-400/25 px-2 text-[10px] text-rose-200 disabled:opacity-40">Remove</button>
     </>}
    </div>
    {isDm&&a.shape_type==="cone"&&editing===a.id&&<ConeEditor area={a} busy={busy} onUpdate={onUpdateCone}/>}
   </div>)}
   {!areas.length&&<p className="text-[11px] text-slate-500">No persistent effects on this scene.</p>}
  </div>
 </section>;
}
