"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GALLEON_STATS, defaultGalleon, type GalleonStatus, type StrategicGalleon } from "@/lib/strategic-map/galleon";
import type { StrategicMapState } from "@/lib/strategic-map/types";
import { GalleonDossier } from "./GalleonDossier";

const field = "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none";
const label = "block text-sm font-medium text-slate-300";

function pointFromEvent(event:PointerEvent<HTMLDivElement>){
  const rect=event.currentTarget.getBoundingClientRect();
  return {
    x:Math.max(0,Math.min(100,100*(event.clientX-rect.left)/rect.width)),
    y:Math.max(0,Math.min(100,100*(event.clientY-rect.top)/rect.height)),
  };
}

export function GalleonManager({campaignId,state,initialGalleon}:{campaignId:string;state:StrategicMapState;initialGalleon:StrategicGalleon|null}) {
  const router=useRouter();
  const supabase=useMemo(()=>createClient(),[]);
  const [draft,setDraft]=useState<StrategicGalleon>(()=>initialGalleon??defaultGalleon(campaignId));
  const [placing,setPlacing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const update=<K extends keyof StrategicGalleon>(key:K,value:StrategicGalleon[K])=>setDraft(prev=>({...prev,[key]:value}));
  function move(x:number,y:number){setDraft(prev=>({...prev,pos_x:Number(x.toFixed(3)),pos_y:Number(y.toFixed(3))}));}

  async function save(){
    if(busy)return;
    const name=draft.name.trim();
    if(!name||name.length>120){setError("Vessel name must be 1–120 characters.");return;}
    if(draft.pos_x===null||draft.pos_y===null){setError("Click Place / Move, then select the vessel's location on the map before saving.");return;}
    const values=[["Hull",draft.hull_hp,GALLEON_STATS.hull.maxHp],["Magic core",draft.core_hp,GALLEON_STATS.core.maxHp],["Aether sails",draft.sails_hp,GALLEON_STATS.sails.maxHp]] as const;
    if(values.some(([,current,max])=>!Number.isInteger(current)||current<0||current>max)){
      setError("HP values must be whole numbers between 0 and the component's maximum.");return;
    }
    if(draft.crew_status.length>160||draft.condition_notes.length>1200||(draft.gm_notes??"").length>2500){setError("One of the notes exceeds the allowed character limit.");return;}
    setBusy(true);setError("");setMessage("");
    const payload={
      campaign_id:campaignId,
      name,pos_x:draft.pos_x,pos_y:draft.pos_y,
      visible_to_players:draft.visible_to_players??true,
      status:draft.status,flight_ready:draft.flight_ready,
      hull_hp:draft.hull_hp,core_hp:draft.core_hp,sails_hp:draft.sails_hp,
      crew_status:draft.crew_status.trim(),condition_notes:draft.condition_notes.trim(),
      gm_notes:(draft.gm_notes??"").trim(),updated_at:new Date().toISOString(),
    };
    try{
      const {data,error:dbError}=await supabase.from("campaign_strategic_galleon")
        .upsert(payload,{onConflict:"campaign_id"}).select("*").single();
      if(dbError)throw dbError;
      setDraft(data as StrategicGalleon);
      setPlacing(false);
      setMessage("Galleon position and condition saved.");
      router.refresh();
    }catch(caught){
      setError(caught instanceof Error?caught.message:"Unable to save the galleon.");
    }finally{setBusy(false);}
  }

  return <section className="rounded-3xl border border-amber-600/25 bg-slate-900/70 p-4 text-slate-100 sm:p-5">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-500">Party vessel</p><h2 className="mt-1 text-2xl font-bold">Flying Galleon Control</h2><p className="mt-2 text-sm text-slate-400">Set the vessel's location, damage and flight readiness. Only the GM can edit these values.</p></div>
      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">No route history</span>
    </header>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
      <div>
        <div
          className={`relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 ${placing?"cursor-crosshair touch-none":""}`}
          onPointerDown={event=>{
            if(!placing||busy)return;
            event.currentTarget.setPointerCapture(event.pointerId);
            const point=pointFromEvent(event);move(point.x,point.y);
          }}
          onPointerMove={event=>{
            if(placing&&!busy&&event.currentTarget.hasPointerCapture(event.pointerId)){
              const point=pointFromEvent(event);move(point.x,point.y);
            }
          }}
          onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
          onPointerCancel={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.mapUrl} alt="Hinewai strategic map, for placing the flying galleon" draggable={false} className="block h-auto w-full select-none"/>
          {draft.pos_x!==null&&draft.pos_y!==null&&<div className="pointer-events-none absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{left:`${draft.pos_x}%`,top:`${draft.pos_y}%`}}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-300 bg-slate-950 text-xl shadow-lg">⛵</span>
            <span className="max-w-40 truncate rounded-md bg-slate-950/90 px-2 py-1 text-center text-xs font-bold text-amber-100">{draft.name}</span>
          </div>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={()=>setPlacing(v=>!v)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${placing?"border-amber-400 bg-amber-500/20 text-amber-200":"border-slate-600 text-slate-200"}`}>{placing?"Placement active — click or drag":"Place / Move galeon"}</button>
          <span className="text-xs text-slate-400">{draft.pos_x===null?"Not placed yet":`X ${draft.pos_x.toFixed(1)}% · Y ${draft.pos_y?.toFixed(1)}%`}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">Click or drag while placement mode is active, then save. No movement history is recorded.</p>
        <div className="mt-5"><GalleonDossier galleon={draft}/></div>
      </div>
      <div className="space-y-3">
        <label className={label}>Name<input className={field} value={draft.name} maxLength={120} onChange={e=>update("name",e.target.value)}/></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Current status<select className={field} value={draft.status} onChange={e=>update("status",e.target.value as GalleonStatus)}><option value="airborne">Airborne</option><option value="anchored">Anchored</option><option value="landed">Landed</option><option value="under_repair">Under repair</option></select></label>
          <label className={label}>Crew condition<input className={field} maxLength={160} value={draft.crew_status} onChange={e=>update("crew_status",e.target.value)}/></label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={draft.flight_ready} onChange={e=>update("flight_ready",e.target.checked)} className="accent-amber-500"/>GM confirms vessel is flight-ready</label>
        <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={draft.visible_to_players??true} onChange={e=>update("visible_to_players",e.target.checked)} className="accent-amber-500"/>Show vessel and its condition to players</label>
        <p className="text-xs text-slate-500">A destroyed hull or magic core overrides flight readiness. Destroyed sails prevent forward/backward travel.</p>
        <div className="grid grid-cols-3 gap-2">
          {([{name:"Hull HP",key:"hull_hp",max:GALLEON_STATS.hull.maxHp},{name:"Core HP",key:"core_hp",max:GALLEON_STATS.core.maxHp},{name:"Sails HP",key:"sails_hp",max:GALLEON_STATS.sails.maxHp}] as const).map(part=>
            <label key={part.key} className={label}>{part.name}<input className={field} type="number" min={0} max={part.max} step={1} value={draft[part.key]} onChange={e=>update(part.key,Number(e.target.value))}/><span className="text-xs text-slate-500">Max {part.max}</span></label>
          )}
        </div>
        <label className={label}>Condition notes (visible to players)<textarea rows={3} maxLength={1200} className={field} value={draft.condition_notes} onChange={e=>update("condition_notes",e.target.value)}/></label>
        <label className={label}>GM notes (private)<textarea rows={3} maxLength={2500} className={field} value={draft.gm_notes??""} onChange={e=>update("gm_notes",e.target.value)}/></label>
        {error&&<p role="alert" className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
        {message&&<p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 text-sm text-emerald-300">{message}</p>}
        <button type="button" disabled={busy} onClick={()=>void save()} className="w-full rounded-xl bg-amber-500 px-4 py-3 font-bold text-slate-950 disabled:opacity-50">{busy?"Saving…":"Save galeon & position"}</button>
      </div>
    </div>
  </section>;
}
