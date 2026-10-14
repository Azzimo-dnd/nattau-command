"use client";

import Link from "next/link";
import { useState } from "react";
import type { ArmyGroup } from "@/lib/strategic-map/armyGroups";
import { provinceCenter } from "@/lib/strategic-map/armyGroups";
import type { StrategicMapState } from "@/lib/strategic-map/types";
import type { StrategicGalleon } from "@/lib/strategic-map/galleon";
import {specialUnitByKey, resolvedDisplayName, type StrategicSpecialUnit} from "@/lib/strategic-map/specialUnits";
import { StrategicIntelligence } from "./StrategicIntelligence";
import { ProvinceOverlay } from "./ProvinceOverlay";
import type { FactionId } from "./provinceData";

export function InteractiveMap({
  state,
  isDm = false,
  armyGroups = [],
  galleon = null,
  specialUnits = [],
}: {
  state: StrategicMapState;
  isDm?: boolean;
  armyGroups?: ArmyGroup[];
  galleon?: StrategicGalleon | null;
  specialUnits?: StrategicSpecialUnit[];
}) {
  const [selectedProvinceId, setSelectedProvinceId] = useState(
    state.provinces[0]?.id ?? ""
  );
  const [selectedFactionId, setSelectedFactionId] = useState<FactionId | null>(
    null
  );
  const [intelligenceTab,setIntelligenceTab] = useState<"overview"|"factions"|"armies"|"special-units"|"provinces">("overview");
  const [showArmies,setShowArmies] = useState(true);
  const [showVessel,setShowVessel] = useState(true);
  const [showSpecialUnits,setShowSpecialUnits] = useState(true);
  const [selectedSpecialUnitKey,setSelectedSpecialUnitKey] = useState<string|null>(null);
  const [vesselSelected,setVesselSelected] = useState(false);
  const [selectedArmyId,setSelectedArmyId] = useState<string | null>(null);

  type IntelligenceTab = "overview" | "factions" | "armies" | "special-units" | "provinces";
  function switchTab(tab: IntelligenceTab) {
    setIntelligenceTab(tab);
    setSelectedFactionId(null);
    setSelectedArmyId(null);
    setSelectedProvinceId("");
    setVesselSelected(false);
    setSelectedSpecialUnitKey(null);
  }
  function selectProvince(id: string) {
    switchTab("provinces");
    setSelectedProvinceId(id);
  }
  function selectArmy(id: string | null) {
    switchTab("armies");
    setSelectedArmyId(id);
    setShowArmies(true);
  }
  function selectSpecialUnit(key:string|null){
    switchTab("special-units");
    setSelectedSpecialUnitKey(key);
    setShowSpecialUnits(true);
  }
  function selectFaction(id: FactionId | null) {
    switchTab("factions");
    setSelectedFactionId(id);
  }

  return (
    <section className="space-y-6">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                Strategic Map
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Inspect province control and toggle the strategic markers you need.
              </p>
              {state.mapOriginalName ? (
                <p className="mt-1 text-xs text-slate-600">
                  Active map: {state.mapOriginalName}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {isDm ? (
                <Link
                  href="/gm/map"
                  className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400/60"
                >
                  GM Map Controls
                </Link>
              ) : null}
              {galleon && <button type="button" onClick={()=>setShowVessel(value=>!value)} className={`rounded-xl border px-4 py-2 text-sm ${showVessel?"border-amber-400 bg-amber-400/10 text-amber-200":"border-slate-700 bg-slate-950/70 text-slate-300"}`}>{showVessel?"Hide Galleon":"Show Galleon"}</button>}
              <button type="button" onClick={()=>setShowSpecialUnits(value=>!value)} className={`rounded-xl border px-4 py-2 text-sm ${showSpecialUnits?"border-teal-400/60 bg-teal-500/10 text-teal-200":"border-slate-700 bg-slate-950/70 text-slate-300"}`}>{showSpecialUnits?"Hide Special Units":"Show Special Units"}</button>
              <button type="button" onClick={()=>setShowArmies(value=>!value)} className={`rounded-xl border px-4 py-2 text-sm ${showArmies?"border-yellow-500 bg-yellow-500/15 text-yellow-300":"border-slate-700 bg-slate-950/70 text-slate-300"}`}>{showArmies?"Hide Armies":"Show Armies"}</button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-slate-950">
            {/* The strategic-map bucket is private, so runtime signed URLs are
                rendered directly instead of going through Next Image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.mapUrl}
              alt="Strategic map of Hinewai"
              className="h-auto w-full select-none"
              draggable={false}
            />

            <ProvinceOverlay
              provinces={state.provinces}
              provinceControl={state.provinceControl}
              selectedProvinceId={selectedProvinceId}
              selectedFactionId={selectedFactionId}
              onSelectProvince={selectProvince}
            />

            {showVessel && galleon && galleon.pos_x !== null && galleon.pos_y !== null &&
              <button type="button" onClick={()=>{switchTab("overview");setVesselSelected(true);}}
                aria-label={`View vessel: ${galleon.name}`}
                title={galleon.name}
                style={{left:`${galleon.pos_x}%`,top:`${galleon.pos_y}%`}}
                className="group/vessel absolute z-40 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                <span aria-hidden="true" className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-300 bg-slate-950 text-lg shadow-lg transition-transform group-hover/vessel:scale-110 ${vesselSelected?"ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-950":""}`}>⛵</span>
                <span className="pointer-events-none max-w-28 truncate rounded-md bg-slate-950/90 px-1.5 py-0.5 text-center text-[10px] font-bold text-amber-100 shadow-sm md:max-w-36">{galleon.name}</span>
              </button>}
            {showSpecialUnits && specialUnits.map(unit=>{
              if(unit.pos_x===null||unit.pos_y===null)return null;
              const def=specialUnitByKey(unit.unit_key);
              if(!def)return null;
              const isSelected=selectedSpecialUnitKey===unit.unit_key;
              const isPrivate=isDm && unit.visible_to_players===false;
              const collisions=specialUnits.filter(other=>
                other.unit_key<unit.unit_key && other.pos_x!==null&&other.pos_y!==null
                &&Math.abs(other.pos_x-unit.pos_x!)<1.5
                &&Math.abs(other.pos_y-unit.pos_y!)<1.5
              ).length;
              const offset=Math.min(collisions,4);
              return <button type="button" key={unit.unit_key} onClick={()=>selectSpecialUnit(unit.unit_key)}
                aria-label={`View special unit: ${resolvedDisplayName(unit.unit_key,unit.unit_profile)}`}
                title={`${resolvedDisplayName(unit.unit_key,unit.unit_profile)} — ${unit.status}${isPrivate?" (GM only)":""}`}
                style={{left:`calc(${unit.pos_x}% + ${offset*12}px)`,top:`calc(${unit.pos_y}% - ${offset*10}px)`}}
                className="group/special absolute z-[35] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
                <span aria-hidden="true" className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm shadow-lg transition-transform group-hover/special:scale-110 ${def.color} ${isPrivate?"opacity-55":""} ${isSelected?"ring-2 ring-teal-300 ring-offset-1 ring-offset-slate-950":""}`}>{def.icon}</span>
                <span className={`pointer-events-none max-w-24 truncate rounded bg-slate-950/85 px-1.5 py-0.5 text-center text-[9px] font-semibold leading-tight text-slate-100 md:max-w-32 md:text-[10px] ${isPrivate?"opacity-60":""}`}>{resolvedDisplayName(unit.unit_key,unit.unit_profile)}</span>
              </button>;
            })}
            {showArmies && armyGroups.map(group=>{
              const rumor=group.visibility==="rumored"&&!isDm;
              const province=state.provinces.find(p=>p.number===group.province_number);
              const p=rumor?(province?provinceCenter(province.points):null):(group.pos_x!==null&&group.pos_y!==null?{x:group.pos_x,y:group.pos_y}:null);
              if(!p)return null;
              const colors:Record<string,string>={
                "kainites":"border-amber-400 bg-amber-900 text-amber-100",
                "empire":"border-orange-400 bg-orange-950 text-orange-100",
                "mazamundi-cult":"border-violet-400 bg-violet-950 text-violet-100",
                "wild-lizardfolk":"border-red-400 bg-red-950 text-red-100",
                "merrydock":"border-emerald-400 bg-emerald-950 text-emerald-100",
              };
              const factionColor=rumor?"border-slate-300 bg-slate-800 text-white":(colors[group.faction_key]??"border-slate-300 bg-slate-900 text-white");
              const label=rumor?"Unknown force":group.name;
              const overlaps=armyGroups.filter(other=>{
                if(other.id===group.id)return false;
                const r=other.visibility==="rumored"&&!isDm;
                const pp=state.provinces.find(v=>v.number===other.province_number);
                const q=r?(pp?provinceCenter(pp.points):null):(other.pos_x!==null&&other.pos_y!==null?{x:other.pos_x,y:other.pos_y}:null);
                return q && Math.abs(p.x-q.x)<1.5 && Math.abs(p.y-q.y)<1.5 && other.id<group.id;
              }).length;
              return <button
                key={group.id}
                type="button"
                onClick={()=>selectArmy(group.id)}
                title={label}
                aria-label={`View army group: ${label}`}
                style={{left:`calc(${p.x}% + ${Math.min(overlaps,4)*15}px)`,top:`calc(${p.y}% - ${Math.min(overlaps,4)*9}px)`}}
                className="group/army absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-base leading-none shadow-md transition-transform group-hover/army:scale-110 ${factionColor} ${selectedArmyId===group.id?"ring-2 ring-yellow-300 ring-offset-1 ring-offset-slate-950":""}`} aria-hidden="true">{rumor?"?":"⚑"}</span>
                <span className={`pointer-events-none max-w-24 truncate rounded bg-slate-950/85 px-1.5 py-0.5 text-center text-[9px] font-semibold leading-tight text-slate-100 shadow-sm md:max-w-32 md:text-[10px] ${selectedArmyId===group.id?"text-yellow-200":""}`}>{label}</span>
              </button>;
            })}
          </div>
        </div>

        <StrategicIntelligence
          state={state}
          armyGroups={armyGroups}
          specialUnits={specialUnits}
          selectedSpecialUnitKey={selectedSpecialUnitKey}
          onSpecialUnit={selectSpecialUnit}
          galleon={galleon}
          isDm={isDm}
          selectedProvinceId={selectedProvinceId}
          selectedFactionId={selectedFactionId}
          selectedArmyId={selectedArmyId}
          activeTab={intelligenceTab}
          onTabChange={switchTab}
          onProvince={selectProvince}
          onFaction={selectFaction}
          onArmy={selectArmy}
        />
      </div>
    </section>
  );
}
