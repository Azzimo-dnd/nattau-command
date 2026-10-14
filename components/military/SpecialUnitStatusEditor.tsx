"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { specialUnitStatusOptions, type SpecialUnitRosterRow } from "@/lib/strategic-map/specialUnits";

type Props={
  campaignId:string;
  unitKey:string;
  record:SpecialUnitRosterRow;
};

/** GM-only controls. The database update is additionally guarded by RLS. */
export function SpecialUnitStatusEditor({campaignId,unitKey,record}:Props){
  const router=useRouter();
  const [status,setStatus]=useState(record.status);
  const [mission,setMission]=useState(record.mission??"");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  useEffect(()=>{setStatus(record.status);setMission(record.mission??"");},[record.status,record.mission,record.updated_at]);
  const dirty=status!==record.status||mission!==(record.mission??"");
  async function save(){
    if(busy||!dirty)return;
    if(status.trim().length<1||status.length>80||mission.length>1000){
      setError("Status must have 1–80 characters; mission must be at most 1000 characters.");return;
    }
    if(!record.updated_at){
      setError("Missing current database revision. Refresh the page before editing.");return;
    }
    setBusy(true);setError("");setSuccess("");
    try{
      const db=createClient();
      const {data,error:saveError}=await db.from("campaign_strategic_special_units")
        .update({status:status.trim(),mission:mission.trim(),updated_at:new Date().toISOString()})
        .eq("campaign_id",campaignId)
        .eq("unit_key",unitKey)
        .eq("updated_at",record.updated_at)
        .select("unit_key, status, mission, updated_at")
        .maybeSingle();
      if(saveError)throw saveError;
      if(!data)throw new Error("This unit changed elsewhere. Refresh the page to load its newest status before saving.");
      setSuccess("Saved to Supabase. Strategic Map now uses these values.");
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Unable to update this unit.");}
    finally{setBusy(false);}
  }
  return <div className="rounded-xl border border-amber-500/30 bg-slate-900/70 p-3">
    <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-widest text-amber-400">GM · Live unit orders</p><span className="text-xs text-slate-500">Shared with Strategic Map</span></div>
    <label className="block text-xs text-slate-300">Current status
      <select className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" value={status} onChange={e=>{setStatus(e.target.value);setError("");setSuccess("");}}>
        {!specialUnitStatusOptions.some(option=>option===status)&&<option value={status}>{status}</option>}
        {specialUnitStatusOptions.map(option=><option key={option} value={option}>{option}</option>)}
      </select>
    </label>
    <label className="mt-3 block text-xs text-slate-300">Current mission / assignment
      <textarea rows={2} maxLength={1000} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" value={mission} onChange={e=>{setMission(e.target.value);setError("");setSuccess("");;}} placeholder="The unit's current assignment"/>
    </label>
    <p className="mt-1 text-xs text-slate-500">Missions are shared with players only when the unit is published on the map. Status is visible in the War Room roster.</p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy||!dirty} onClick={()=>void save()} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy?"Saving…":"Save status & mission"}</button>
      <button type="button" disabled={busy} onClick={()=>{setSuccess("");setError("");router.refresh();}} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Refresh live data</button>
    </div>
    {error&&<p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    {success&&<p role="status" className="mt-2 text-xs text-emerald-300">{success}</p>}
  </div>;
}
