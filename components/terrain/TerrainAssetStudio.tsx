"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TerrainAssetRow, TerrainCategory, TerrainPreset, TerrainRecipe } from "@/lib/terrain/terrainTypes";
import { TERRAIN_CATEGORIES, TERRAIN_PRESETS } from "@/lib/terrain/terrainTypes";
import { generateTerrainFile, validateTerrainFile, type TerrainModelMetrics } from "@/lib/terrain/terrainModels";
import { TerrainAssetViewer } from "./TerrainAssetViewer";
import { useTerrainAssets } from "./useTerrainAssets";

type Selection = { kind: "preset"; id: string } | { kind: "saved"; id: string } | { kind: "upload" };
type ReferenceMode = "none" | "dummy" | "pippo";

function prettyCategory(category: TerrainCategory) {
  return category[0].toUpperCase() + category.slice(1);
}
function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = file.name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function fmtSize(bytes: number) { return bytes >= 1024*1024 ? (bytes/(1024*1024)).toFixed(2) + " MB" : Math.round(bytes/1024) + " KB"; }
function fmtUnits(value: number) { return value.toFixed(2) + " squares"; }
type NumericParameter = { key: string; label: string; min: number; max: number; step: number };
function recipeParameters(recipe: TerrainRecipe): NumericParameter[] {
  const field = (key: string, label: string, min: number, max: number, step = 0.05) => ({key,label,min,max,step});
  switch (recipe.kind) {
    case "crate": return [field("width","Width",0.2,10),field("depth","Depth",0.2,10),field("height","Height",0.2,10),field("wear","Wear",0,1,0.05)];
    case "barrel": return [field("radius","Radius",0.12,5),field("height","Height",0.2,10),field("hoops","Iron hoops",1,6,1),field("wear","Wear",0,1,0.05)];
    case "fence": return [field("length","Length",0.3,20),field("height","Height",0.2,10),field("posts","Posts",2,30,1),field("wear","Wear",0,1,0.05)];
    case "barricade": return [field("width","Width",0.5,20),field("height","Height",0.3,10),field("clutter","Boards",2,50,1)];
    case "planks": return [field("width","Width",0.5,20),field("depth","Depth",0.5,20),field("beams","Broken beams",1,60,1),field("damage","Damage",0,1,0.05)];
    case "hull": return [field("width","Width",0.5,20),field("height","Height",0.4,10),field("damage","Damage",0,1,0.05)];
  }
}

export function TerrainAssetStudio({ campaignId, campaignSlug }: { campaignId: string; campaignSlug: string }) {
  const library = useTerrainAssets(campaignId);
  const [selection, setSelection] = useState<Selection>({ kind: "preset", id: TERRAIN_PRESETS[0].id });
  const [recipe, setRecipe] = useState<TerrainRecipe>(TERRAIN_PRESETS[0].recipe);
  const [file, setFile] = useState<File | null>(null);
  const [savedFile, setSavedFile] = useState<{ id: string; file: File } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>("dummy");
  const [visualScale, setVisualScale] = useState(1);
  const [metrics, setMetrics] = useState<TerrainModelMetrics | null>(null);
  const [name, setName] = useState(TERRAIN_PRESETS[0].name);
  const [category, setCategory] = useState<TerrainCategory>("cargo");
  const [exporting, setExporting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedPreset = selection.kind === "preset" ? TERRAIN_PRESETS.find((item) => item.id === selection.id) ?? null : null;
  const selectedSaved = selection.kind === "saved" ? library.assets.find((item) => item.id === selection.id) ?? null : null;
  const selectedFile = selection.kind === "upload" ? file : selection.kind === "saved" && savedFile?.id === selection.id ? savedFile.file : null;
  const activeRecipe = selectedPreset ? recipe : null;

  const selectPreset = (preset: TerrainPreset) => {
    setSelection({kind: "preset", id: preset.id}); setRecipe(preset.recipe);
    setName(preset.name); setCategory(preset.category); setLocalError(null); setMetrics(null); setVisualScale(1);
  };
  const selectSaved = (item: TerrainAssetRow) => {
    setSelection({kind:"saved",id:item.id}); setName(item.name); setCategory(item.category);
    setLocalError(null); setMetrics(null); setVisualScale(item.default_scale);
  };
  const pickFile = (incoming: File | null) => {
    if (!incoming) return;
    try {
      validateTerrainFile(incoming);
      setFile(incoming); setName(incoming.name.replace(/\.glb$/i,"")); setCategory("cargo");
      setSelection({kind:"upload"}); setVisualScale(1); setLocalError(null); setMetrics(null);
    } catch (cause) { setLocalError(cause instanceof Error ? cause.message : "Invalid GLB."); }
  };

  const assetId = selectedSaved?.id ?? null;
  const assetPath = selectedSaved?.storage_path ?? null;
  const { downloadAsset } = library;
  useEffect(() => {
    let alive = true;
    if (!assetId || !assetPath || !selectedSaved) { setFileLoading(false); return; }
    setFileLoading(true); setFileError(null);
    void downloadAsset(selectedSaved).then((downloaded) => {
      if (alive) setSavedFile({id:assetId,file:downloaded});
    }).catch((cause) => {
      if (alive) setFileError(cause instanceof Error ? cause.message : "Model download failed.");
    }).finally(() => { if (alive) setFileLoading(false); });
    return () => { alive = false; };
    // Key by the stable asset ID/path, not the reconstructed selectedSaved object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, assetPath, downloadAsset]);

  const visiblePresets = useMemo(() => TERRAIN_PRESETS.filter((item) =>
    (categoryFilter === "all" || item.category === categoryFilter) &&
    (item.name + " " + item.description).toLowerCase().includes(search.toLowerCase())
  ), [categoryFilter, search]);
  const visibleSaved = useMemo(() => library.assets.filter((item) =>
    (categoryFilter === "all" || item.category === categoryFilter) &&
    item.name.toLowerCase().includes(search.toLowerCase())
  ), [categoryFilter, library.assets, search]);

  const exportGlb = async () => {
    setLocalError(null);
    if (!activeRecipe) { if (selectedFile) downloadFile(selectedFile); return; }
    setExporting(true);
    try {
      const { file: result } = await generateTerrainFile(activeRecipe, selectedPreset?.id ?? "terrain");
      downloadFile(result);
    } catch (cause) { setLocalError(cause instanceof Error ? cause.message : "GLB export failed."); }
    finally { setExporting(false); }
  };
  const save = () => {
    if (activeRecipe) void library.saveGenerated(activeRecipe, name, category, visualScale);
    else if (selection.kind === "upload" && selectedFile) void library.saveUpload(selectedFile, name, category, visualScale);
  };
  const regenerate = () => {
    if (!activeRecipe) return;
    setRecipe({ ...activeRecipe, seed: (activeRecipe.seed + 1) >>> 0 });
  };
  const changeStatus = (status: TerrainAssetRow["status"]) => {
    if (selectedSaved) void library.updateAsset(selectedSaved, {status});
  };
  const updateSaved = () => {
    if (selectedSaved) void library.updateAsset(selectedSaved, {name:name.trim(),category});
  };
  const removeSaved = () => {
    if (selectedSaved && window.confirm("Permanently delete terrain asset " + selectedSaved.name + "?")) {
      void library.removeAsset(selectedSaved);
      setSelection({kind:"preset",id:TERRAIN_PRESETS[0].id});
      setRecipe(TERRAIN_PRESETS[0].recipe);
      setName(TERRAIN_PRESETS[0].name);
      setCategory(TERRAIN_PRESETS[0].category);
    }
  };

  const selectedStatus = selectedSaved?.status ?? "local preset";
  const controlsDisabled = library.busy || exporting;
  const persistenceAvailable = library.backendReady && !library.loading;
  const currentFile = selectedFile;
  const hasPreview = Boolean(activeRecipe || currentFile);

  return <section className="space-y-5 text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/20 bg-slate-950/65 px-5 py-4">
      <div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Terrain Asset Studio · Alpha</p>
        <p className="mt-1 text-sm text-slate-300">UC Battlefield starter · {campaignSlug} · Models only, no scene placement yet</p></div>
      <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">{TERRAIN_PRESETS.length} procedural presets · {library.assets.length} saved</div>
    </div>
    {!persistenceAvailable && !library.loading && <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
      Preview mode: the terrain database is not migrated yet. You can view, regenerate and download all eight GLBs; saving to Supabase is disabled.
    </p>}
    {library.error && <p role="alert" className="rounded-xl border border-amber-400/20 px-4 py-2 text-xs text-amber-200">{library.error}</p>}
    {library.message && <p role="status" className="rounded-xl border border-emerald-400/20 px-4 py-2 text-sm text-emerald-200">{library.message}</p>}
    {localError && <p role="alert" className="rounded-xl border border-rose-400/30 px-4 py-2 text-sm text-rose-200">{localError}</p>}

    <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_290px]">
      <aside className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <div><h3 className="text-sm font-black">Terrain Library</h3>
          <p className="mt-1 text-xs text-slate-400">Select a model to inspect its geometry.</p></div>
        <input aria-label="Search terrain" placeholder="Search props…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"/>
        <select aria-label="Filter category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
          <option value="all">All categories</option>
          {TERRAIN_CATEGORIES.map((value) => <option key={value} value={value}>{prettyCategory(value)}</option>)}
        </select>
        <div className="max-h-[600px] space-y-2 overflow-auto pr-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Procedural UC presets</p>
          {visiblePresets.map((preset) => <button key={preset.id} type="button" onClick={() => selectPreset(preset)}
            className={`w-full rounded-xl border px-3 py-3 text-left transition ${selection.kind === "preset" && selection.id === preset.id ? "border-cyan-400 bg-cyan-400/10" : "border-slate-800 bg-slate-950/60 hover:border-slate-600"}`}>
            <span className="block text-xs font-bold text-slate-100">{preset.name}</span>
            <span className="mt-1 block text-[10px] capitalize text-slate-400">{preset.category} · generated</span>
          </button>)}
          {!visiblePresets.length && <p className="text-xs text-slate-500">No presets found.</p>}
          <p className="pt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Saved library</p>
          {visibleSaved.map((asset) => <button key={asset.id} type="button" onClick={() => selectSaved(asset)}
            className={`w-full rounded-xl border px-3 py-3 text-left transition ${assetId === asset.id ? "border-cyan-400 bg-cyan-400/10" : "border-slate-800 bg-slate-950/60 hover:border-slate-600"}`}>
            <span className="block truncate text-xs font-bold text-slate-100">{asset.name}</span>
            <span className="mt-1 block text-[10px] capitalize text-slate-400">{asset.category} · {asset.status}</span>
          </button>)}
          {library.loading && <p className="text-xs text-slate-500">Checking saved assets…</p>}
          {!visibleSaved.length && !library.loading && <p className="text-xs text-slate-500">No saved assets yet.</p>}
        </div>
        <label className="block cursor-pointer rounded-xl border border-dashed border-cyan-500/50 bg-cyan-400/5 px-4 py-3 text-center text-xs font-bold text-cyan-200 hover:border-cyan-300">
          + Preview your own GLB
          <input type="file" accept=".glb,model/gltf-binary" className="sr-only" onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }}/>
        </label>
      </aside>

      <div className="min-w-0 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/65 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-base font-bold">{selectedPreset?.name ?? selectedSaved?.name ?? file?.name ?? "Terrain preview"}</h3>
            <p className="mt-1 text-xs text-slate-400">{selectedPreset?.description ?? "Three-dimensional asset preview at VTT grid scale."}</p></div>
          <span className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">{selectedStatus}</span>
        </div>
        {fileLoading && <p className="text-xs text-cyan-200">Downloading saved model…</p>}
        {fileError && <p role="alert" className="text-xs text-rose-300">{fileError}</p>}
        <TerrainAssetViewer recipe={activeRecipe} file={currentFile} campaignId={campaignId} scale={visualScale}
          referenceMode={referenceMode} onMetrics={setMetrics}/>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex-1 text-xs text-slate-300">Scale reference
            <select value={referenceMode} onChange={(e) => setReferenceMode(e.target.value as ReferenceMode)}
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              <option value="dummy">Humanoid dummy (1.8 squares)</option><option value="pippo">Pippo / campaign miniature</option><option value="none">None</option>
            </select></label>
          <label className="flex-1 text-xs text-slate-300">Preview scale · {Math.round(visualScale*100)}%
            <input type="range" min="0.1" max="10" step="0.05" value={visualScale} onChange={(e) => setVisualScale(Number(e.target.value))}
              className="mt-4 block w-full accent-cyan-400"/></label>
        </div>
        {metrics && <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-950/80 p-3">Width<br/><strong>{fmtUnits(metrics.width*visualScale)}</strong></div>
          <div className="rounded-lg bg-slate-950/80 p-3">Height<br/><strong>{fmtUnits(metrics.height*visualScale)}</strong></div>
          <div className="rounded-lg bg-slate-950/80 p-3">Depth<br/><strong>{fmtUnits(metrics.depth*visualScale)}</strong></div>
          <div className="rounded-lg bg-slate-950/80 p-3">Triangles<br/><strong>{metrics.triangles.toLocaleString()}</strong></div>
        </div>}
      </div>

      <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <div><h3 className="text-sm font-black">Asset Inspector</h3>
          <p className="mt-1 text-xs text-slate-400">Review before saving to the library.</p></div>
        <label className="block text-xs text-slate-300">Name
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"/></label>
        <label className="block text-xs text-slate-300">Category
          <select value={category} onChange={(e) => setCategory(e.target.value as TerrainCategory)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            {TERRAIN_CATEGORIES.map((value) => <option key={value} value={value}>{prettyCategory(value)}</option>)}
          </select></label>
        {activeRecipe && <div className="space-y-2 rounded-xl border border-slate-700 p-3">
          <p className="text-xs font-bold text-slate-100">Procedural recipe</p>
          <p className="text-xs text-slate-400">Type: {activeRecipe.kind} · deterministic generation</p>
          <label className="block text-xs text-slate-400">Seed
            <input aria-label="Generator seed" type="number" min={0} max={4294967295} step={1} value={recipe.seed}
              onChange={(e) => setRecipe({...recipe,seed:Number(e.target.value)} as TerrainRecipe)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"/></label>
          <div className="grid grid-cols-2 gap-2">
            {recipeParameters(recipe).map((parameter) => <label key={parameter.key} className="block text-[11px] text-slate-400">
              {parameter.label}
              <input type="number" min={parameter.min} max={parameter.max} step={parameter.step}
                value={Number((recipe as unknown as Record<string,unknown>)[parameter.key])}
                onChange={(e) => setRecipe((current) => ({...current,[parameter.key]:Number(e.target.value)} as TerrainRecipe))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"/>
            </label>)}
          </div>
          {"reinforced" in recipe && <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={recipe.reinforced} onChange={(e) => setRecipe({...recipe,reinforced:e.target.checked})}/> Iron reinforcements
          </label>}
          {"broken" in recipe && <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={recipe.broken} onChange={(e) => setRecipe({...recipe,broken:e.target.checked})}/> Broken variant
          </label>}
          <button type="button" onClick={regenerate} className="w-full rounded-lg border border-amber-400/35 px-3 py-2 text-xs font-bold text-amber-200">Generate next variant</button>
        </div>}
        {selectedSaved && <div className="space-y-2 text-xs text-slate-300">
          <p>Status: <strong className="capitalize">{selectedSaved.status}</strong></p>
          <p>Source: {selectedSaved.source_kind} · {fmtSize(selectedSaved.file_size_bytes)}</p>
          <p>Pivot: centered base at floor · mesh count: {selectedSaved.mesh_count}</p>
          <div className="flex gap-2">
            <button disabled={controlsDisabled} onClick={() => changeStatus("approved")} className="flex-1 rounded-lg border border-emerald-500/40 p-2 text-emerald-200 disabled:opacity-50">Approve</button>
            <button disabled={controlsDisabled} onClick={() => changeStatus("archived")} className="flex-1 rounded-lg border border-slate-600 p-2 disabled:opacity-50">Archive</button>
          </div>
          <button disabled={controlsDisabled} onClick={updateSaved} className="w-full rounded-lg border border-cyan-400/40 p-2 text-cyan-100 disabled:opacity-50">Save metadata</button>
          <button disabled={controlsDisabled} onClick={removeSaved} className="w-full rounded-lg border border-rose-400/40 p-2 text-rose-200 disabled:opacity-50">Delete model and metadata</button>
        </div>}
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <button type="button" disabled={!hasPreview || controlsDisabled} onClick={() => void exportGlb()}
            className="w-full rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-3 text-xs font-black text-cyan-100 disabled:opacity-40">
            {exporting ? "Exporting GLB…" : "Download GLB"}
          </button>
          {(activeRecipe || selection.kind === "upload") && <button type="button"
            disabled={!hasPreview || controlsDisabled || !persistenceAvailable || !name.trim()}
            onClick={save} className="w-full rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-3 text-xs font-black text-emerald-100 disabled:opacity-40">
            {library.busy ? "Saving…" : "Save draft to terrain library"}
          </button>}
          <p className="text-xs leading-5 text-slate-500">Export downloads the original GLB geometry; preview scaling is saved as library metadata. Saving a draft does not place anything on a VTT scene.</p>
        </div>
      </aside>
    </div>
  </section>;
}
