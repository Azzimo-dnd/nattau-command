"use client";

import type { StrategicSpecialUnit } from "@/lib/strategic-map/specialUnits";
import { specialUnitByKey } from "@/lib/strategic-map/specialUnits";

type Props={
  units:StrategicSpecialUnit[];
  selectedKey:string|null;
  onSelect:(key:string|null)=>void;
  isDm:boolean;
};

export function SpecialUnitsIntelligence({units,selectedKey,onSelect,isDm}:Props){
  const selected=units.find(unit=>unit.unit_key===selectedKey);
  const selectedDefinition=selected?specialUnitByKey(selected.unit_key):null;
  const ordered=units.slice().sort((a,b)=>{
    const nameA=specialUnitByKey(a.unit_key)?.name??a.unit_key;
    const nameB=specialUnitByKey(b.unit_key)?.name??b.unit_key;
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
          <span className="min-w-0 flex-1"><strong className="block text-sm">{def.name}</strong><span className="mt-1 block text-xs text-slate-400">{unit.status}{isDm&&!published?" · GM only / unplaced":""}</span></span>
        </button>;
      })}
    </div>
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:p-5">
      {selected&&selectedDefinition?<div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-amber-500">Special unit dossier</p><h3 className="mt-2 text-xl font-bold text-slate-100">{selectedDefinition.name}</h3><p className="mt-1 text-sm text-slate-400">{selectedDefinition.unit.commander} · {selectedDefinition.unit.size}</p></div>
          <button type="button" onClick={()=>onSelect(null)} className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-slate-300">Clear</button>
        </div>
        <p className="text-sm leading-6 text-slate-300">{selectedDefinition.unit.detail}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 p-3"><p className="text-xs uppercase text-slate-500">Status</p><p className="mt-1 font-semibold text-amber-200">{selected.status}</p></div>
          <div className="rounded-lg border border-slate-800 p-3"><p className="text-xs uppercase text-slate-500">Location</p><p className="mt-1 text-sm text-slate-200">{selected.location_note||"No location details provided"}</p></div>
        </div>
        <div><p className="text-xs font-bold uppercase tracking-widest text-amber-500">Current orders / assignment</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{selected.mission||"No current task reported."}</p></div>
        {isDm&&selected.gm_notes&&<div className="rounded-lg border border-amber-500/25 bg-amber-950/20 p-3"><p className="text-xs font-bold text-amber-300">Private GM notes</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{selected.gm_notes}</p></div>}
        {isDm&&selected.visible_to_players===false&&<p className="text-xs text-amber-300">Hidden from players. Only the GM can see this marker.</p>}
      </div>:<p className="text-sm text-slate-400">Select a special unit on the left or click its marker on the map to see its current mission, status and location.</p>}
    </div>
  </div>;
}
