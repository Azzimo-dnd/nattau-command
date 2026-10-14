"use client";

import type { StrategicSpecialUnit } from "@/lib/strategic-map/specialUnits";
import { specialUnitByKey, resolveSpecialUnitProfile, resolvedDisplayName } from "@/lib/strategic-map/specialUnits";
import { formatDeploymentCost } from "@/components/military/militaryData";

type Props={
  units:StrategicSpecialUnit[];
  selectedKey:string|null;
  onSelect:(key:string|null)=>void;
  isDm:boolean;
};

export function SpecialUnitsIntelligence({units,selectedKey,onSelect,isDm}:Props){
  const selected=units.find(unit=>unit.unit_key===selectedKey);
  const selectedDefinition=selected?specialUnitByKey(selected.unit_key):null;
  const selectedProfile=selected?resolveSpecialUnitProfile(selected.unit_key,selected.unit_profile):null;
  const ordered=units.slice().sort((a,b)=>{
    const nameA=resolvedDisplayName(a.unit_key,a.unit_profile);
    const nameB=resolvedDisplayName(b.unit_key,b.unit_profile);
    return nameA.localeCompare(nameB);
  });
  return <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(230px,0.85fr)_minmax(0,1.4fr)]">
    <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
      {ordered.length===0&&<p className="rounded-xl border border-slate-700 p-4 text-sm text-slate-400">No special units are currently visible on the map.</p>}
      {ordered.map(unit=>{
        const def=specialUnitByKey(unit.unit_key);
        if(!def)return null;
        const published=unit.visible_to_players!==false&&unit.pos_x!==null&&unit.pos_y!==null;
        return <button key={unit.unit_key} type="button" onClick={()=>onSelect(unit.unit_key)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selectedKey===unit.unit_key?"border-amber-500 bg-amber-500/10":"border-slate-700 bg-slate-950/50 hover:border-amber-500/40"}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg ${def.color}`}>{def.icon}</span>
          <span className="min-w-0 flex-1"><strong className="block text-sm">{resolvedDisplayName(unit.unit_key,unit.unit_profile)}</strong><span className="mt-1 block text-xs text-slate-400">{unit.status}{isDm&&!published?" · GM only / unplaced":""}</span></span>
        </button>;
      })}
    </div>
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:p-5">
      {selected&&selectedDefinition&&selectedProfile?<div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-amber-500">Special unit dossier</p><h3 className="mt-2 text-xl font-bold text-slate-100">{selectedProfile.name}</h3><p className="mt-1 text-sm text-slate-400">{selectedProfile.commander} · {selectedProfile.size}</p></div>
          <button type="button" onClick={()=>onSelect(null)} className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-slate-300">Clear</button>
        </div>
        <p className="text-sm leading-6 text-slate-300">{selectedProfile.detail}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 p-3"><p className="text-xs uppercase text-slate-500">Status</p><p className="mt-1 font-semibold text-amber-200">{selected.status}</p></div>
          <div className="rounded-lg border border-slate-800 p-3"><p className="text-xs uppercase text-slate-500">Location</p><p className="mt-1 text-sm text-slate-200">{selected.location_note||"No location details provided"}</p></div>
        </div>
        <div><p className="text-xs font-bold uppercase tracking-widest text-amber-500">Current orders / assignment</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{selected.mission||"No current task reported."}</p></div>
        <details className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-amber-300">Deployment, durability, headquarters & members</summary>
          <div className="mt-3 space-y-3 text-sm text-slate-300">
            <p><span className="text-slate-500">Deployment cost:</span> {formatDeploymentCost(selectedProfile.cost)}</p>
            <p><span className="text-slate-500">Durability:</span> {selectedProfile.durability.type==="finite"
              ?`${selectedProfile.durability.current} / ${selectedProfile.durability.max}`
              :`${selectedProfile.durability.label} — ${selectedProfile.durability.description}`}</p>
            <p><span className="text-slate-500">Headquarters:</span> {selectedProfile.headquarters.state==="built"
              ?`Built: ${selectedProfile.headquarters.name}`
              :selectedProfile.headquarters.state==="available"
              ?`Available: ${selectedProfile.headquarters.constructionCost}`
              :`Unavailable: ${selectedProfile.headquarters.reason}`}</p>
            <div><p className="text-slate-500">Named members</p><ul className="mt-1 space-y-1">
              {selectedProfile.members.map((member,index)=><li key={index}>• {member}</li>)}
            </ul></div>
          </div>
        </details>
        {isDm&&selected.gm_notes&&<div className="rounded-lg border border-amber-500/25 bg-amber-950/20 p-3"><p className="text-xs font-bold text-amber-300">Private GM notes</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{selected.gm_notes}</p></div>}
        {isDm&&selected.visible_to_players===false&&<p className="text-xs text-amber-300">Hidden from players. Only the GM can see this marker.</p>}
      </div>:<p className="text-sm text-slate-400">Select a special unit on the left or click its marker on the map to see its current mission, status and location.</p>}
    </div>
  </div>;
}
