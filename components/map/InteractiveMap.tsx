"use client";

import Link from "next/link";
import { useState } from "react";
import type { ArmyGroup } from "@/lib/strategic-map/armyGroups";
import { provinceCenter } from "@/lib/strategic-map/armyGroups";
import type { StrategicMapState } from "@/lib/strategic-map/types";
import { FactionInfluence } from "./FactionInfluence";
import { mapLocations } from "./mapLocations";
import { ProvinceOverlay } from "./ProvinceOverlay";
import type { FactionId } from "./provinceData";
import { getProvinceControlLabel } from "./provinceData";

function getLocationIcon(type: string) {
  switch (type) {
    case "capital":
      return "⭐";
    case "fortress":
      return "🏰";
    case "port":
      return "⚓";
    case "city":
      return "🏛";
    default:
      return "📍";
  }
}

function getOwnerClass(owner: string) {
  if (owner.includes("Kainites") && owner.includes("Cult")) {
    return "text-yellow-300";
  }

  switch (owner) {
    case "Kainites":
      return "text-yellow-400";
    case "Merrydock":
      return "text-green-400";
    case "Jin Yan Chao":
    case "Jin Yan Chao Empire":
      return "text-orange-400";
    case "Cult of Lord Mazamundi":
      return "text-purple-400";
    case "Wild Lizardfolk":
      return "text-red-400";
    case "Unknown":
      return "text-slate-400";
    default:
      return "text-slate-400";
  }
}

function getThreatClass(threatLevel: string) {
  switch (threatLevel) {
    case "low":
      return "text-green-400";
    case "medium":
      return "text-yellow-400";
    case "high":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "controlled":
      return "text-green-400";
    case "neutral":
      return "text-slate-400";
    case "hostile":
      return "text-red-400";
    case "contested":
      return "text-orange-400";
    default:
      return "text-slate-400";
  }
}

export function InteractiveMap({
  state,
  isDm = false,
  armyGroups = [],
}: {
  state: StrategicMapState;
  isDm?: boolean;
  armyGroups?: ArmyGroup[];
}) {
  const [selectedId, setSelectedId] = useState(mapLocations[0].id);
  const [selectedProvinceId, setSelectedProvinceId] = useState(
    state.provinces[0]?.id ?? ""
  );
  const [selectedFactionId, setSelectedFactionId] = useState<FactionId | null>(
    null
  );
  const [showLocations, setShowLocations] = useState(true);
  const [showArmies,setShowArmies] = useState(true);
  const [selectedArmyId,setSelectedArmyId] = useState<string | null>(null);
  const selectedArmy = armyGroups.find(g=>g.id===selectedArmyId);

  const selectedLocation =
    mapLocations.find((location) => location.id === selectedId) ??
    mapLocations[0];

  const selectedProvince =
    state.provinces.find((province) => province.id === selectedProvinceId) ??
    state.provinces[0];

  const selectedProvinceControlLabel = selectedProvince
    ? getProvinceControlLabel(
        selectedProvince.number,
        state.provinceControl
      )
    : "Unknown";

  return (
    <section className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-2xl font-bold text-yellow-500">Locations</h2>
        <p className="mt-2 text-sm text-slate-500">
          Select a known location to ping it on the strategic map.
        </p>

        <div className="mt-5 space-y-3">
          {mapLocations.map((location) => {
            const isSelected = selectedId === location.id;

            return (
              <button
                key={location.id}
                type="button"
                onClick={() => {
                  setSelectedId(location.id);
                  setShowLocations(true);
                }}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? "border-yellow-600/50 bg-yellow-500/10"
                    : "border-slate-800 bg-slate-950/60 hover:border-yellow-600/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {getLocationIcon(location.type)}
                  </span>

                  <div>
                    <h3 className="font-bold text-slate-100">
                      {location.name}
                    </h3>

                    <p
                      className={`mt-1 text-sm ${getOwnerClass(
                        location.owner
                      )}`}
                    >
                      {location.owner}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                Strategic Map
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Toggle location markers when the map becomes too crowded.
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
              <button type="button" onClick={()=>setShowArmies(value=>!value)} className={`rounded-xl border px-4 py-2 text-sm ${showArmies?"border-yellow-500 bg-yellow-500/15 text-yellow-300":"border-slate-700 bg-slate-950/70 text-slate-300"}`}>{showArmies?"Hide Armies":"Show Armies"}</button>
              <button
                type="button"
                onClick={() => setShowLocations((current) => !current)}
                className={`rounded-xl border px-4 py-2 text-sm transition ${
                  showLocations
                    ? "border-yellow-500 bg-yellow-500/15 text-yellow-300"
                    : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-yellow-600/40 hover:text-yellow-300"
                }`}
              >
                {showLocations ? "Hide Locations" : "Show Locations"}
              </button>
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
              onSelectProvince={setSelectedProvinceId}
            />

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
                onClick={()=>setSelectedArmyId(group.id)}
                title={label}
                aria-label={`View army group: ${label}`}
                style={{left:`calc(${p.x}% + ${Math.min(overlaps,4)*15}px)`,top:`calc(${p.y}% - ${Math.min(overlaps,4)*9}px)`}}
                className="group/army absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-base leading-none shadow-md transition-transform group-hover/army:scale-110 ${factionColor} ${selectedArmyId===group.id?"ring-2 ring-yellow-300 ring-offset-1 ring-offset-slate-950":""}`} aria-hidden="true">{rumor?"?":"⚑"}</span>
                <span className={`pointer-events-none max-w-24 truncate rounded bg-slate-950/85 px-1.5 py-0.5 text-center text-[9px] font-semibold leading-tight text-slate-100 shadow-sm md:max-w-32 md:text-[10px] ${selectedArmyId===group.id?"text-yellow-200":""}`}>{label}</span>
              </button>;
            })}
            {showLocations &&
              mapLocations.map((location) => {
                const isSelected = selectedId === location.id;

                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => setSelectedId(location.id)}
                    style={{
                      left: `${location.x}%`,
                      top: `${location.y}%`,
                    }}
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                    title={location.name}
                  >
                    {isSelected && (
                      <span className="absolute -inset-3 animate-ping rounded-full bg-yellow-500/40" />
                    )}

                    <span
                      className={`relative flex h-7 w-7 items-center justify-center rounded-full border text-xs shadow-lg md:h-8 md:w-8 md:text-sm ${
                        isSelected
                          ? "border-yellow-300 bg-yellow-500 text-slate-950"
                          : "border-slate-300 bg-slate-950/80 text-slate-100 hover:border-yellow-400"
                      }`}
                    >
                      {getLocationIcon(location.type)}
                    </span>

                    <span
                      className={`absolute left-1/2 top-8 hidden -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-1 text-xs md:block ${
                        isSelected
                          ? "border-yellow-600/40 bg-slate-950 text-yellow-300"
                          : "border-slate-700 bg-slate-950/80 text-slate-300"
                      }`}
                    >
                      {location.name}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {showArmies&&selectedArmy&&<div className="rounded-2xl border border-yellow-600/40 bg-slate-900 p-5"><div className="flex justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-yellow-500">Army Group</p><h3 className="mt-2 text-xl font-bold">{selectedArmy.name}</h3></div><button type="button" onClick={()=>setSelectedArmyId(null)} aria-label="Close army group details" className="text-slate-400">✕</button></div><div className="mt-3 text-sm text-slate-300">{selectedArmy.visibility==="rumored"&&!isDm?"Scouts report military activity in this province. Strength and exact location remain unknown.":<><p>Faction: {state.factions.find(f=>f.id===selectedArmy.faction_key)?.name??selectedArmy.faction_key}</p><p>Commander: {selectedArmy.commander||"Unknown"}</p><p>Strength: {selectedArmy.strength??"Unknown"} PZ</p><p>Orders: {selectedArmy.orders||"Unknown"}</p><p>Condition: {selectedArmy.condition||"Unknown"}</p><p className="mt-2 whitespace-pre-wrap">{selectedArmy.composition}</p>{isDm&&selectedArmy.gm_notes&&<p className="mt-2 border-t border-slate-700 pt-2 text-yellow-200">GM notes: {selectedArmy.gm_notes}</p>}</>}</div></div>}
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                Selected Location
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                {selectedLocation.name}
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-400">
                  {selectedLocation.type}
                </span>

                <span
                  className={`rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide ${getOwnerClass(
                    selectedLocation.owner
                  )}`}
                >
                  {selectedLocation.owner}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-400">
                {selectedLocation.description}
              </p>
            </div>

            {selectedProvince ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                  Selected Province
                </p>

                <h2 className="mt-3 text-3xl font-bold">
                  {selectedProvince.name}
                </h2>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-yellow-600/40 bg-yellow-500/10 px-3 py-1 text-xs uppercase tracking-wide text-yellow-300">
                    Province {selectedProvince.number}
                  </span>

                  <span
                    className={`rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide ${getOwnerClass(
                      selectedProvinceControlLabel
                    )}`}
                  >
                    {selectedProvinceControlLabel}
                  </span>

                  <span
                    className={`rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide ${getStatusClass(
                      selectedProvince.status
                    )}`}
                  >
                    {selectedProvince.status}
                  </span>

                  <span
                    className={`rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide ${getThreatClass(
                      selectedProvince.threatLevel
                    )}`}
                  >
                    threat: {selectedProvince.threatLevel}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-400">
                  {selectedProvince.description}
                </p>
              </div>
            ) : null}
          </div>

          <FactionInfluence
            factions={state.factions}
            provinceControl={state.provinceControl}
            selectedFactionId={selectedFactionId}
            onSelectFaction={setSelectedFactionId}
          />
        </section>
      </div>
    </section>
  );
}
