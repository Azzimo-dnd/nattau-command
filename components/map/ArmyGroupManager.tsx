"use client";
import { useState, useMemo, type PointerEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { StrategicMapState } from "@/lib/strategic-map/types";
import type { ArmyGroup, ArmyVisibility } from "@/lib/strategic-map/armyGroups";
import { provinceCenter } from "@/lib/strategic-map/armyGroups";

type Draft = {name:string;faction_key:string;commander:string;composition:string;strength:number;orders:string;condition:string;gm_notes:string;visibility:ArmyVisibility;province_number:number|null;pos_x:number;pos_y:number};
const fromGroup = (g:ArmyGroup):Draft => ({name:g.name,faction_key:g.faction_key,commander:g.commander??"",composition:g.composition??"",strength:g.strength??0,orders:g.orders??"",condition:g.condition??"",gm_notes:g.gm_notes??"",visibility:g.visibility,province_number:g.province_number,pos_x:g.pos_x??50,pos_y:g.pos_y??50});
const blank = (state:StrategicMapState):Draft => ({name:"",faction_key:state.factions[0]?.id??"kainites",commander:"",composition:"",strength:0,orders:"Holding",condition:"",gm_notes:"",visibility:"hidden",province_number:state.provinces[0]?.number??null,pos_x:50,pos_y:50});
const inputClass="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100";
function position(event:PointerEvent<HTMLElement>):{x:number;y:number} {
 const rect=event.currentTarget.getBoundingClientRect();
 return {x:Math.max(0,Math.min(100,((event.clientX-rect.left)/rect.width)*100)),y:Math.max(0,Math.min(100,((event.clientY-rect.top)/rect.height)*100))};
}
export function ArmyGroupManager({campaignId,state,initialGroups}:{campaignId:string;state:StrategicMapState;initialGroups:ArmyGroup[]}) {
 const router=useRouter();
 const client=useMemo(()=>createClient(),[]);
 const [groups,setGroups]=useState(initialGroups);
 const [selected,setSelected]=useState<string|null>(null);
 const [draft,setDraft]=useState<Draft>(()=>blank(state));
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState("");
 const [placement,setPlacement]=useState(false);
 const selectedGroup=groups.find(g=>g.id===selected);
 function choose(g:ArmyGroup) {setSelected(g.id);setDraft(fromGroup(g));setPlacement(false);setFeedback("");}
 function newGroup(){setSelected(null);setDraft(blank(state));setPlacement(true);setFeedback("");}
 function change<K extends keyof Draft>(key:K,value:Draft[K]){setDraft(d=>({...d,[key]:value}));}
 function updatePosition(x:number,y:number){
  const province=state.provinces.find(p=>{
   // province match is intentionally explicit via selector; geometric containment is not inferred
   return p.number===draft.province_number;
  });
  void province;
  setDraft(d=>({...d,pos_x:x,pos_y:y}));
 }
 async function save(archive=false){
  if(busy)return;
  if(!selected && archive)return;
  if(!archive && (!draft.name.trim()||draft.name.length>120||!draft.faction_key)){setFeedback("A group name and faction are required.");return;}
  setBusy(true);setFeedback("");
  const fields={...draft,name:draft.name.trim(),strength:Math.max(0,Math.trunc(draft.strength||0)),updated_at:new Date().toISOString()};
  try{
   if(archive){
    const {data,error}=await client.from("campaign_strategic_army_groups").update({archived_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",selected!).eq("campaign_id",campaignId).select("id");
    if(error)throw error;
    if(!data?.length)throw Error("Group not found or access denied.");
    setGroups(prev=>prev.filter(g=>g.id!==selected));setSelected(null);setDraft(blank(state));setFeedback("Group archived.");
   }else{
    const query=selected?client.from("campaign_strategic_army_groups").update(fields).eq("id",selected).eq("campaign_id",campaignId):client.from("campaign_strategic_army_groups").insert({...fields,campaign_id:campaignId});
    const {data,error}=await query.select("*").single();
    if(error)throw error;
    const group=data as ArmyGroup;
    setGroups(prev=>[...prev.filter(g=>g.id!==group.id),group]);
    setSelected(group.id);setDraft(fromGroup(group));setFeedback("Group saved.");
   }
   router.refresh();
  }catch(error){setFeedback(error instanceof Error?error.message:"Failed to save group.");}
  finally{setBusy(false);}
 }
 return <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-slate-100">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-yellow-500">Strategic Forces</p><h2 className="text-2xl font-bold">Army Groups</h2></div><button className="rounded-lg bg-yellow-600 px-4 py-2 font-bold text-slate-950" onClick={newGroup}>+ New group</button></div>
  <div className="grid gap-5 xl:grid-cols-[240px_1fr_340px]">
   <div className="space-y-2">
    {groups.length===0&&<p className="text-sm text-slate-400">No groups created yet.</p>}
    {groups.map(g=><button key={g.id} onClick={()=>choose(g)} className={`block w-full rounded-lg border p-3 text-left text-sm ${selected===g.id?"border-yellow-400 bg-yellow-900/20":"border-slate-700 bg-slate-950"}`}><strong>{g.name}</strong><div className="text-slate-400">{state.factions.find(f=>f.id===g.faction_key)?.shortName??g.faction_key} · {g.strength} PZ</div><div className="text-xs text-slate-500">{g.visibility}</div></button>)}
   </div>
   <div>
    <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 touch-none" onPointerDown={event=>{if(!placement)return;event.currentTarget.setPointerCapture(event.pointerId);const p=position(event);updatePosition(p.x,p.y);}} onPointerMove={event=>{if(placement&&event.buttons===1){const p=position(event);updatePosition(p.x,p.y);}}}>
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img src={state.mapUrl} alt="Army group position preview" className="block w-full select-none" draggable={false}/>
     {groups.filter(g=>g.id!==selected&&g.pos_x!==null&&g.pos_y!==null).map(g=><button key={g.id} onClick={()=>choose(g)} title={g.name} style={{left:`${g.pos_x}%`,top:`${g.pos_y}%`}} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-300 bg-slate-900/90 p-1.5 text-lg">⚑</button>)}
     <div style={{left:`${draft.pos_x}%`,top:`${draft.pos_y}%`}} className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-300 bg-red-950 p-2 text-xl shadow-lg">⚑</div>
    </div>
    <p className="mt-2 text-xs text-slate-400">Select “Place / Move” and click or drag across the map to position the selected group. Save to publish.</p>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>setPlacement(v=>!v)} className={`rounded-lg border px-4 py-2 text-sm ${placement?"border-yellow-400 text-yellow-300":"border-slate-600"}`}>{placement?"✓ Placement mode on":"Place / Move"}</button><span className="p-2 text-xs text-slate-400">X {draft.pos_x.toFixed(1)}% · Y {draft.pos_y.toFixed(1)}%</span></div>
   </div>
   <div className="space-y-3">
    <label className="block text-sm">Group name<input className={inputClass} value={draft.name} onChange={e=>change("name",e.target.value)} maxLength={120}/></label>
    <label className="block text-sm">Faction<select className={inputClass} value={draft.faction_key} onChange={e=>change("faction_key",e.target.value)}>{state.factions.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    <label className="block text-sm">Province<select className={inputClass} value={draft.province_number??""} onChange={e=>{const n=e.target.value?Number(e.target.value):null;setDraft(d=>({...d,province_number:n}));if(n){const province=state.provinces.find(p=>p.number===n);if(province){const p=provinceCenter(province.points);updatePosition(p.x,p.y);}}}}><option value="">Unknown / At sea</option>{state.provinces.map(p=><option key={p.id} value={p.number}>{p.name}</option>)}</select></label>
    <label className="block text-sm">Commander<input className={inputClass} value={draft.commander} onChange={e=>change("commander",e.target.value)}/></label>
    <label className="block text-sm">Strength (PZ)<input className={inputClass} type="number" min="0" value={draft.strength} onChange={e=>change("strength",Number(e.target.value))}/></label>
    <label className="block text-sm">Orders<input className={inputClass} value={draft.orders} onChange={e=>change("orders",e.target.value)}/></label>
    <label className="block text-sm">Condition<input className={inputClass} value={draft.condition} onChange={e=>change("condition",e.target.value)}/></label>
    <label className="block text-sm">Composition<textarea className={inputClass} rows={3} value={draft.composition} onChange={e=>change("composition",e.target.value)}/></label>
    <label className="block text-sm">Visibility<select className={inputClass} value={draft.visibility} onChange={e=>change("visibility",e.target.value as ArmyVisibility)}><option value="public">Public — full details</option><option value="rumored">Rumored — province only</option><option value="hidden">Hidden — GM only</option></select></label>
    <label className="block text-sm">GM notes<textarea className={inputClass} rows={3} value={draft.gm_notes} onChange={e=>change("gm_notes",e.target.value)}/></label>
    {feedback&&<p role="status" className="text-sm text-yellow-300">{feedback}</p>}
    <div className="flex gap-2"><button disabled={busy} onClick={()=>void save()} className="flex-1 rounded-lg bg-yellow-600 p-3 font-semibold text-slate-950 disabled:opacity-50">{busy?"Saving…":"Save group"}</button>{selectedGroup&&<button disabled={busy} onClick={()=>{if(window.confirm("Archive this army group?"))void save(true);}} className="rounded-lg border border-red-500/50 px-3 text-red-300 disabled:opacity-50">Archive</button>}</div>
   </div>
  </div>
 </section>;
}
