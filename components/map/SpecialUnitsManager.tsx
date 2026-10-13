"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { StrategicMapState } from "@/lib/strategic-map/types";
import {
  specialUnitDefaults, specialUnitDefinitions, specialUnitByKey,
  type StrategicSpecialUnit,
} from "@/lib/strategic-map/specialUnits";

const input="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none";
const statuses=["Ready","Operational","Expanded","On Mission","Travelling","Reconnaissance","Garrisoned","Supporting","Resting","Inactive","Wounded","Missing"];

function relativePoint(event:PointerEvent<HTMLDivElement>){
  const rect=event.currentTarget.getBoundingClientRect();
  return {
    x:Math.round(Math.max(0,Math.min(100,100*(event.clientX-rect.left)/rect.width))*1000)/1000,
    y:Math.round(Math.max(0,Math.min(100,100*(event.clientY-rect.top)/rect.height))*1000)/1000,
  };
}

export function SpecialUnitsManager({
  campaignId,state,initialUnits,
}:{
  campaignId:string;state:StrategicMapState;initialUnits:StrategicSpecialUnit[];
}){
  const client=useMemo(()=>createClient(),[]);
  const router=useRouter();
  const [units,setUnits]=useState(()=>{
    const defaults=specialUnitDefaults(campaignId);
    return defaults.map(def=>initialUnits.find(unit=>unit.unit_key===def.unit_key)??def);
  });
  const [selectedKey,setSelectedKey]=useState(specialUnitDefinitions[0].key as string);
  const [placement,setPlacement]=useState(false);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [error,setError]=useState("");
  const current=units.find(item=>item.unit_key===selectedKey);
  const definition=specialUnitByKey(selectedKey);
  const setField=<K extends keyof StrategicSpecialUnit>(field:K,value:StrategicSpecialUnit[K])=>{
    setUnits(prev=>prev.map(unit=>unit.unit_key===selectedKey?{...unit,[field]:value}:unit));
    setFeedback("");setError("");
  };
  function setLocation(x:number,y:number) {
    setUnits(prev=>prev.map(unit=>unit.unit_key===selectedKey?{...unit,pos_x:x,pos_y:y}:unit));
    setFeedback("");setError("");
  }
  function choose(key:string){setSelectedKey(key);setPlacement(false);setFeedback("");setError("");}
  async function save(){
    if(!current||busy)return;
    if(!current.status.trim()||current.status.length>80){setError("Enter a status (maximum 80 characters).");return;}
    if(current.mission.length>1000||current.location_note.length>320||(current.gm_notes??"").length>2500){setError("A note exceeds its length limit.");return;}
    if(current.visible_to_players&&(current.pos_x===null||current.pos_y===null)){setError("Place the unit on the map before making it visible to players.");return;}
    setBusy(true);setFeedback("");setError("");
    try{
      const payload={
        campaign_id:campaignId,unit_key:current.unit_key,
        status:current.status.trim(),mission:current.mission.trim(),
        location_note:current.location_note.trim(),gm_notes:(current.gm_notes??"").trim(),
        pos_x:current.pos_x,pos_y:current.pos_y,
        visible_to_players:current.visible_to_players??false,
        updated_at:new Date().toISOString(),
      };
      const {data,error:saveError}=await client.from("campaign_strategic_special_units")
        .upsert(payload,{onConflict:"campaign_id,unit_key"}).select("*").single();
      if(saveError)throw saveError;
      setUnits(prev=>prev.map(item=>item.unit_key===data.unit_key?data as StrategicSpecialUnit:item));
      setPlacement(false);setFeedback("Special unit saved.");router.refresh();
    }catch(err){setError(err instanceof Error?err.message:"Unable to save the unit.");}
    finally{setBusy(false);}
  }

  return <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 text-slate-100 md:p-5">
    <header className="mb-5">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-500">Strategic forces · Independent layer</p>
      <h2 className="mt-1 text-2xl font-bold">Special Units Control</h2>
      <p className="mt-2 text-sm text-slate-400">Track the eight existing War Room detachments. Set positions, current orders and publication for each unit independently. Nothing appears for players until positioned and published.</p>
    </header>
    <div className="grid items-start gap-5 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
      <div className="space-y-2">{specialUnitDefinitions.map(def=>{
        const unit=units.find(item=>item.unit_key===def.key);
        const placed=unit?.pos_x!==null&&unit?.pos_y!==null;
        const publicMarker=placed&&unit?.visible_to_players;
        return <button type="button" key={def.key} onClick={()=>choose(def.key)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${selectedKey===def.key?"border-amber-400 bg-amber-500/10":"border-slate-700 bg-slate-950/60 hover:border-amber-500/40"}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg ${def.color}`}>{def.icon}</span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{def.name}</strong><span className="block text-xs text-slate-400">{unit?.status??def.unit.status} · {publicMarker?"Visible":placed?"GM only":"Unplaced"}</span></span>
        </button>;
      })}</div>
      <div className="space-y-3">
        <div className={`relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 ${placement?"cursor-crosshair touch-none":""}`}
          onPointerDown={event=>{
            if(!placement||busy)return;
            event.currentTarget.setPointerCapture(event.pointerId);
            const p=relativePoint(event);setLocation(p.x,p.y);
          }}
          onPointerMove={event=>{
            if(!placement||busy||!event.currentTarget.hasPointerCapture(event.pointerId))return;
            const p=relativePoint(event);setLocation(p.x,p.y);
          }}
          onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
          onPointerCancel={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.mapUrl} alt="Hinewai map for special-unit placement" draggable={false} className="block h-auto w-full select-none"/>
          {units.map(unit=>{
            if(unit.pos_x===null||unit.pos_y===null)return null;
            const def=specialUnitByKey(unit.unit_key);
            if(!def)return null;
            const isSelected=unit.unit_key===selectedKey;
            return <button type="button" key={unit.unit_key}
              title={def.name}
              disabled={placement}
              onClick={()=>choose(unit.unit_key)}
              style={{left:`${unit.pos_x}%`,top:`${unit.pos_y}%`}}
              className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 ${placement?"pointer-events-none":""}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-lg shadow-lg ${def.color} ${isSelected?"ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-950":""} ${unit.visible_to_players?"":"opacity-65"}`}>{def.icon}</span>
              {(isSelected||!placement)&&<span className="max-w-24 truncate rounded bg-slate-950/90 px-1 text-[9px] text-slate-100">{def.name}</span>}
            </button>;
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={()=>setPlacement(v=>!v)} className={`rounded-lg border px-3 py-2 text-sm ${placement?"border-amber-400 bg-amber-500/10 text-amber-300":"border-slate-700 text-slate-300"}`}>{placement?"Placement mode on":"Place / Move unit"}</button>
          {current?.pos_x!==null&&current?.pos_y!==null&&<button type="button" disabled={busy} onClick={()=>{setUnits(prev=>prev.map(item=>item.unit_key===selectedKey?{...item,pos_x:null,pos_y:null,visible_to_players:false}:item));setPlacement(false);}} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300">Clear position</button>}
          <span className="text-xs text-slate-500">{current?.pos_x===null?"No position":`X ${current?.pos_x?.toFixed(1)}% · Y ${current?.pos_y?.toFixed(1)}%`}</span>
        </div>
        <p className="text-xs text-slate-500">In placement mode click or drag on the map, then save. Greyed-out markers are visible only to the GM.</p>
      </div>
      {current&&definition&&<div className="space-y-3">
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
          <h3 className="font-semibold">{definition.name}</h3>
          <p className="mt-1 text-xs text-amber-400">{definition.unit.commander} · {definition.unit.size}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{definition.unit.detail}</p>
        </div>
        <label className="block text-sm text-slate-300">Status<select className={input} value={current.status} onChange={e=>setField("status",e.target.value)}>
          {!statuses.includes(current.status)&&<option value={current.status}>{current.status}</option>}
          {statuses.map(status=><option key={status} value={status}>{status}</option>)}
        </select></label>
        <label className="block text-sm text-slate-300">Current mission / task<textarea rows={3} maxLength={1000} className={input} value={current.mission} onChange={e=>setField("mission",e.target.value)} placeholder="e.g. Scouting the eastern border"/></label>
        <label className="block text-sm text-slate-300">Location notes (shown to players)<input maxLength={320} className={input} value={current.location_note} onChange={e=>setField("location_note",e.target.value)} placeholder="e.g. North of Whangaroa"/></label>
        <label className="block text-sm text-slate-300">Private GM notes<textarea rows={3} maxLength={2500} className={input} value={current.gm_notes??""} onChange={e=>setField("gm_notes",e.target.value)}/></label>
        <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" className="accent-amber-500" checked={current.visible_to_players??false} onChange={e=>setField("visible_to_players",e.target.checked)}/> Show this unit to players</label>
        <p className="text-xs text-slate-500">Player visibility reveals the unit's map position, status, location note and mission. Private notes never appear to players.</p>
        {error&&<p role="alert" className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
        {feedback&&<p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 text-sm text-emerald-300">{feedback}</p>}
        <button type="button" disabled={busy} onClick={()=>void save()} className="w-full rounded-lg bg-amber-500 px-4 py-3 font-bold text-slate-950 disabled:opacity-50">{busy?"Saving…":"Save special unit"}</button>
      </div>}
    </div>
  </section>;
}
