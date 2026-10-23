"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getCategoryLabel, isSettlementBuilding, settlementAftermath,
  settlementCategories, settlementStatuses, settlementSummaryFields, SIEGE_DATE,
  type BuildingCategory, type BuildingStatus, type SettlementBuilding,
  type SettlementSummary,
} from "./settlementData";

type Props = {
  campaignId: string;
  canEdit: boolean;
  storageReady: boolean;
  initialBuildings: SettlementBuilding[];
  initialSummary: SettlementSummary;
};

const input = "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-yellow-500 focus:outline-none";
const action = "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 transition hover:border-yellow-500 disabled:opacity-50";
const label = "block text-xs font-semibold tracking-wide text-slate-400";
const allCategories: Array<BuildingCategory | "all"> = ["all", ...settlementCategories];
const summaryLabels: Record<(typeof settlementSummaryFields)[number], string> = {
  population: "Population", morale: "Morale", food: "Supplies", defense: "Defenses",
  civilianCasualties: "Civilian losses", galleonCasualties: "Galleon crew lost",
  militaryCasualties: "Soldiers lost", recovery: "Recovery",
};
const columns: Array<{key: keyof SettlementSummary; description: string}> = [
  {key:"population",description:"Post-siege count"},
  {key:"morale",description:"Torsten's speech"},
  {key:"food",description:"Stores partially lost"},
  {key:"defense",description:"Damage still being assessed"},
  {key:"civilianCasualties",description:"Includes seven booby-trap victims"},
  {key:"galleonCasualties",description:"Entire flying galleon crew"},
  {key:"militaryCasualties",description:"KaRolK's army"},
  {key:"recovery",description:"Pippo has pledged support"},
];
function statusColor(status: BuildingStatus) {
  if (status === "destroyed") return "text-red-300 border-red-500/50 bg-red-950/65";
  if (status === "damaged") return "text-orange-300 border-orange-500/50 bg-orange-950/65";
  if (status === "rebuilding") return "text-yellow-300 border-yellow-500/50 bg-yellow-950/65";
  if (status === "planned") return "text-yellow-300 border-yellow-700/50 bg-yellow-950/40";
  if (status === "active") return "text-emerald-300 border-emerald-700/50 bg-emerald-950/40";
  return "text-slate-300 border-slate-700 bg-slate-950/70";
}
function draftForNew(): SettlementBuilding {
  return {
    id: "location-" + Date.now().toString(36), name: "New Location",
    category: "civic", status: "planned", x: 50, y: 50, icon: "📍",
    summary: "Awaiting description.", output: "", notes: [], rebuildProgress: 0, rebuildNote: "",
  };
}
function normalizeNotes(text: string) {
  return text.split("\n").map(line => line.trim()).filter(Boolean).slice(0,15);
}

export function SettlementMap({
  campaignId, canEdit, storageReady, initialBuildings, initialSummary,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [buildings, setBuildings] = useState(initialBuildings);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedId, setSelectedId] = useState(initialBuildings[0]?.id ?? "");
  const [category, setCategory] = useState<BuildingCategory | "all">("all");
  const [showLabels, setShowLabels] = useState(false);
  const [editBuilding, setEditBuilding] = useState(false);
  const [draft, setDraft] = useState<SettlementBuilding>(initialBuildings[0] ?? draftForNew());
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(initialSummary);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const current = buildings.find(b => b.id === selectedId) ?? buildings[0];
  const visible = category === "all" ? buildings : buildings.filter(b => b.category === category);
  function select(building: SettlementBuilding) {
    setSelectedId(building.id);
    setDraft(building);
    setEditBuilding(false);
    setError(""); setNotice("");
  }
  function changeDraft<K extends keyof SettlementBuilding>(field: K, value: SettlementBuilding[K]) {
    setDraft(prev => ({...prev, [field]: value}));
    setNotice(""); setError("");
  }
  function startNew() {
    const newBuilding = draftForNew();
    setDraft(newBuilding);
    setSelectedId(newBuilding.id);
    setEditBuilding(true);
    setError(""); setNotice("");
  }
  async function saveBuilding() {
    if (!canEdit || !storageReady || busy) return;
    if (!isSettlementBuilding(draft)) {
      setError("Check the name, summary, coordinates, notes and progress values."); return;
    }
    setBusy(true); setError(""); setNotice("");
    const payload = {
      campaign_id: campaignId, building_key: draft.id, name: draft.name.trim(),
      category: draft.category, status: draft.status, x: draft.x, y: draft.y,
      icon: draft.icon, summary: draft.summary.trim(), output: draft.output ?? "",
      notes: draft.notes, rebuild_progress: draft.rebuildProgress ?? 0,
      rebuild_note: draft.rebuildNote ?? "",
    };
    try {
      const { data, error: dbError } = await supabase.from("campaign_settlement_buildings")
        .upsert(payload, { onConflict: "campaign_id,building_key" }).select("building_key").single();
      if (dbError) throw dbError;
      if (!data) throw new Error("Save was not confirmed by the server.");
      setBuildings(prev => {
        const index = prev.findIndex(b => b.id === draft.id);
        if (index < 0) return [...prev, draft];
        return prev.map(b => b.id === draft.id ? draft : b);
      });
      setSelectedId(draft.id);
      setEditBuilding(false);
      setNotice("Location saved for Nattau campaign members.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save location.");
    } finally { setBusy(false); }
  }
  async function saveOverview() {
    if (!canEdit || !storageReady || busy) return;
    if (settlementSummaryFields.some(field => !summaryDraft[field].trim() || summaryDraft[field].length > 120)) {
      setError("Each overview field must contain 1–120 characters."); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: dbError } = await supabase.from("campaign_settlement_overview")
        .upsert({
          campaign_id: campaignId, population: summaryDraft.population.trim(),
          morale: summaryDraft.morale.trim(), food: summaryDraft.food.trim(),
          defense: summaryDraft.defense.trim(), civilian_casualties: summaryDraft.civilianCasualties.trim(),
          galleon_casualties: summaryDraft.galleonCasualties.trim(),
          military_casualties: summaryDraft.militaryCasualties.trim(),
          recovery: summaryDraft.recovery.trim(),
        }, { onConflict: "campaign_id" }).select("campaign_id").single();
      if (dbError) throw dbError;
      if (!data) throw new Error("Overview save was not confirmed.");
      setSummary(summaryDraft);
      setEditingSummary(false);
      setNotice("Settlement overview saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save overview.");
    } finally { setBusy(false); }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-red-900/60 bg-gradient-to-r from-red-950/50 to-slate-950/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300">Aftermath · {SIEGE_DATE}</p>
        <h2 className="mt-2 text-2xl font-bold">UĆ survived. The village did not escape unscathed.</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
          Most homes burned, part of the stores were lost and the flying galleon exploded.
          { " " }{settlementAftermath.casualtiesNote}
        </p>
        <p className="mt-2 text-sm text-yellow-200/90">{settlementAftermath.moraleNote}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {columns.map(card => (
          <div key={card.key} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">{summaryLabels[card.key as keyof typeof summaryLabels]}</p>
            <p className="mt-2 text-xl font-extrabold text-yellow-200">{summary[card.key]}</p>
            <p className="mt-1 text-xs text-slate-500">{card.description}</p>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-yellow-200">GM settlement administration</p>
            <button type="button" className={action} disabled={!storageReady || busy} onClick={() => {
              setSummaryDraft(summary); setEditingSummary(value => !value); setError(""); setNotice("");
            }}>{editingSummary ? "Cancel overview edit" : "Edit overview"}</button>
          </div>
          {!storageReady && <p className="mt-2 text-sm text-orange-300" role="status">
            Preview mode: database migration not installed. Current post-siege facts are visible; editing is disabled until the migration is applied.
          </p>}
          {editingSummary && storageReady && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {settlementSummaryFields.map(field => (
                  <label key={field} className={label}>{summaryLabels[field]}
                    <input className={input} maxLength={120} value={summaryDraft[field]}
                      onChange={e => setSummaryDraft(prev => ({...prev, [field]: e.target.value}))}/>
                  </label>
                ))}
              </div>
              <button className={action} type="button" disabled={busy} onClick={() => void saveOverview()}>
                {busy ? "Saving..." : "Save overview"}
              </button>
            </div>
          )}
        </div>
      )}

      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={"rounded-xl border p-3 text-sm " +
          (error ? "border-red-600 text-red-200" : "border-emerald-700 text-emerald-200")}>
          {error || notice}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Locations</h2>
            <button type="button" className={action} onClick={() => setShowLabels(v => !v)}>
              {showLabels ? "Hide labels" : "Show labels"}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {allCategories.map(cat => <button type="button" key={cat}
              className={action + (cat === category ? " border-yellow-400 text-yellow-200" : "")}
              onClick={() => setCategory(cat)}>{cat === "all" ? "All" : getCategoryLabel(cat)}</button>)}
          </div>
          {canEdit && <button type="button" className={action + " mt-4 w-full"}
            disabled={!storageReady || busy} onClick={startNew}>+ Add location</button>}
          <div className="mt-4 max-h-[580px] space-y-2 overflow-y-auto pr-1">
            {visible.map(building => (
              <button type="button" key={building.id}
                onClick={() => select(building)}
                className={"w-full rounded-xl border p-3 text-left " +
                  (building.id === selectedId ? "border-yellow-500 bg-yellow-500/10" : "border-slate-800 bg-slate-950/50")}>
                <div className="flex gap-3">
                  <span className="text-xl">{building.icon}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{building.name}</span>
                    <span className={"mt-1 inline-block rounded border px-2 py-0.5 text-xs uppercase " + statusColor(building.status)}>{building.status}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="mb-2 text-xs uppercase tracking-widest text-slate-400">Historical map · before the siege</p>
            <div className="relative overflow-hidden rounded-lg">
              <Image src="/images/uc-settlement-map.png" alt="Historical map of UĆ before the Imperial siege"
                width={1536} height={1024} className="h-auto w-full" priority/>
              {visible.map(building => (
                <button type="button" key={building.id} title={building.name}
                  onClick={() => select(building)}
                  style={{left: building.x + "%", top: building.y + "%"}}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2">
                  <span className={"flex h-8 w-8 items-center justify-center rounded-full border shadow-lg md:h-9 md:w-9 " +
                    (selectedId === building.id ? "border-yellow-200 bg-yellow-600 text-slate-950" : statusColor(building.status))}>
                    {building.icon}
                  </span>
                  {showLabels && <span className="absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100">
                    {building.name}</span>}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{settlementAftermath.mapNote}</p>
          </div>

          {current && (
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-yellow-500">Selected location</p>
                  <h3 className="mt-2 text-2xl font-bold">{current.name}</h3>
                </div>
                <span className={"rounded border px-3 py-1 text-xs uppercase " + statusColor(current.status)}>{current.status}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{current.summary}</p>
              {current.output && <p className="mt-2 text-xs text-yellow-300">{current.output}</p>}
              <div className="mt-3 space-y-1 text-sm text-slate-400">
                {current.notes.map((note,index) => <p key={index}>• {note}</p>)}
              </div>
              {(["damaged","destroyed","rebuilding"] as BuildingStatus[]).includes(current.status) && (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Reconstruction progress</span><span>{current.rebuildProgress ?? 0}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950">
                    <div className="h-full rounded-full bg-yellow-500" style={{width:(current.rebuildProgress ?? 0) + "%"}}/>
                  </div>
                  {current.rebuildNote && <p className="mt-2 text-sm text-slate-400">{current.rebuildNote}</p>}
                </div>
              )}
              {canEdit && <button type="button" className={action + " mt-5"}
                disabled={!storageReady || busy} onClick={() => {setDraft(current);setEditBuilding(v => !v);}}>
                {editBuilding ? "Cancel editing" : "Edit location"}
              </button>}
            </article>
          )}

          {canEdit && editBuilding && storageReady && (
            <div className="rounded-xl border border-yellow-700/50 bg-slate-900 p-5">
              <h3 className="text-lg font-bold text-yellow-200">GM location editor</h3>
              <p className="mt-1 text-xs text-slate-400">Changes become visible to members of the Nattau campaign when saved.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className={label}>Name<input className={input} maxLength={120} value={draft.name}
                  onChange={e => changeDraft("name",e.target.value)}/></label>
                <label className={label}>Icon<input className={input} maxLength={24} value={draft.icon}
                  onChange={e => changeDraft("icon",e.target.value)}/></label>
                <label className={label}>Category<select className={input} value={draft.category}
                  onChange={e => changeDraft("category",e.target.value as BuildingCategory)}>
                  {settlementCategories.map(cat => <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>)}
                </select></label>
                <label className={label}>Status<select className={input} value={draft.status}
                  onChange={e => changeDraft("status",e.target.value as BuildingStatus)}>
                  {settlementStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                </select></label>
                <label className={label}>Map X (0–100)<input className={input} type="number" min={0} max={100} step="0.1" value={draft.x}
                  onChange={e => changeDraft("x",Number(e.target.value))}/></label>
                <label className={label}>Map Y (0–100)<input className={input} type="number" min={0} max={100} step="0.1" value={draft.y}
                  onChange={e => changeDraft("y",Number(e.target.value))}/></label>
                <label className={label}>Reconstruction (0–100%)<input className={input} type="number" min={0} max={100}
                  value={draft.rebuildProgress ?? 0} onChange={e => changeDraft("rebuildProgress",Number(e.target.value))}/></label>
                <label className={label}>Production / benefit<input className={input} maxLength={500} value={draft.output ?? ""}
                  onChange={e => changeDraft("output",e.target.value)}/></label>
              </div>
              <label className={label + " mt-3"}>Description<textarea className={input} maxLength={2000} rows={3}
                value={draft.summary} onChange={e => changeDraft("summary",e.target.value)}/></label>
              <label className={label + " mt-3"}>Notes (one per line, up to 15)
                <textarea className={input} rows={4} value={draft.notes.join("\n")}
                  onChange={e => changeDraft("notes",normalizeNotes(e.target.value))}/></label>
              <label className={label + " mt-3"}>Reconstruction status / next steps
                <textarea className={input} maxLength={1000} rows={2} value={draft.rebuildNote ?? ""}
                  onChange={e => changeDraft("rebuildNote",e.target.value)}/></label>
              <div className="mt-4 flex gap-2">
                <button type="button" className={action} disabled={busy} onClick={() => void saveBuilding()}>
                  {busy ? "Saving..." : "Save location"}</button>
                <button type="button" className={action} disabled={busy} onClick={() => {setEditBuilding(false);setError("");}}>
                  Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
