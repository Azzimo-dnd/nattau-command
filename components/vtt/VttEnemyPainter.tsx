"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MiniaturePainter } from "@/components/miniatures/MiniaturePainter";
import {
  parseMiniaturePaintDocument,
  serializeMiniaturePaintDocument,
  type MiniaturePaintDocument,
} from "@/components/miniatures/miniaturePaintData";
import { createClient } from "@/lib/supabase/client";
import type { VttEnemyModel, VttEnemyPaintJob } from "./vttTypes";

type Props = { campaignId: string; initialModelId?: string | null };
const MODEL_BUCKET = "vtt-enemy-models";
const PAINT_BUCKET = "vtt-enemy-paints";
const MAX_PAINT_BYTES = 8 * 1024 * 1024;

export function VttEnemyPainter({ campaignId, initialModelId = null }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [models, setModels] = useState<VttEnemyModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialModelId);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<VttEnemyPaintJob[]>([]);
  const [loadedDocument, setLoadedDocument] = useState<MiniaturePaintDocument | null>(null);
  const [loadedName, setLoadedName] = useState<string | null>("Original / unpainted");
  const [loadKey, setLoadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = models.find((model) => model.id === selectedId) ?? null;

  const refreshModels = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("vtt_enemy_models")
      .select("id,campaign_id,name,storage_path,web_storage_path,original_name,file_size_bytes,web_file_size_bytes,triangle_count,width_mm,depth_mm,height_mm,created_at")
      .eq("campaign_id", campaignId)
      .order("name");
    if (queryError) throw queryError;
    const rows = (data ?? []) as VttEnemyModel[];
    setModels(rows);
    setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : initialModelId && rows.some((row) => row.id === initialModelId) ? initialModelId : rows[0]?.id ?? null);
  }, [campaignId, initialModelId, supabase]);

  const refreshJobs = useCallback(async (modelId: string) => {
    const { data, error: queryError } = await supabase
      .from("vtt_enemy_paint_jobs")
      .select("id,enemy_model_id,storage_path,name,schema_version,file_size_bytes,is_default,created_at")
      .eq("enemy_model_id", modelId)
      .order("created_at", { ascending: false });
    if (queryError) throw queryError;
    const rows = (data ?? []) as VttEnemyPaintJob[];
    setJobs(rows);
    return rows;
  }, [supabase]);

  const downloadPaint = useCallback(async (job: VttEnemyPaintJob) => {
    const { data, error: downloadError } = await supabase.storage.from(PAINT_BUCKET).download(job.storage_path);
    if (downloadError) throw downloadError;
    return parseMiniaturePaintDocument(JSON.parse(await data.text()) as unknown);
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    refreshModels().catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Could not load enemy models."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refreshModels]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setSourceFile(null); setJobs([]); setLoadedDocument(null); setLoadedName("Original / unpainted"); setError(null); setMessage(null);
      if (!selected) return;
      try {
        const modelPath = selected.web_storage_path ?? selected.storage_path;
        const modelName = selected.web_storage_path ? selected.original_name.replace(/\.stl$/i, ".web.glb") : selected.original_name;
        const [modelResult, paintRows] = await Promise.all([
          supabase.storage.from(MODEL_BUCKET).download(modelPath),
          refreshJobs(selected.id),
        ]);
        if (modelResult.error) throw modelResult.error;
        if (!alive) return;
        setSourceFile(new File([modelResult.data], modelName, { type: modelResult.data.type || "application/octet-stream" }));
        const defaultJob = paintRows.find((job) => job.is_default) ?? null;
        if (defaultJob) {
          const document = await downloadPaint(defaultJob);
          if (!alive) return;
          setLoadedDocument(document); setLoadedName(defaultJob.name); setLoadKey((value) => value + 1);
        }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Could not prepare enemy painter.");
      }
    };
    void load();
    return () => { alive = false; };
  }, [downloadPaint, refreshJobs, selected, supabase]);

  const loadJob = async (job: VttEnemyPaintJob | null) => {
    setError(null); setMessage(null);
    if (!job) {
      setLoadedDocument(null); setLoadedName("Original / unpainted"); setLoadKey((value) => value + 1); return;
    }
    setBusyJob(job.id);
    try {
      const document = await downloadPaint(job);
      setLoadedDocument(document); setLoadedName(job.name); setLoadKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load paint job.");
    } finally { setBusyJob(null); }
  };

  const savePaint = async (document: MiniaturePaintDocument, name: string, makeDefault: boolean) => {
    if (!selected || saving) return;
    setSaving(true); setError(null); setMessage(null);
    const blob = new Blob([serializeMiniaturePaintDocument(document)], { type: "application/json" });
    if (blob.size > MAX_PAINT_BYTES) {
      setSaving(false); setError("Enemy paint document exceeds the 8 MB limit."); return;
    }
    const path = `${campaignId}/${selected.id}/${crypto.randomUUID()}.json`;
    const { error: uploadError } = await supabase.storage.from(PAINT_BUCKET).upload(path, blob, { contentType: "application/json", cacheControl: "3600", upsert: false });
    if (uploadError) { setSaving(false); setError(uploadError.message); return; }
    const { error: registerError } = await supabase.rpc("register_vtt_enemy_paint_job", {
      p_enemy_model_id: selected.id,
      p_storage_path: path,
      p_name: name,
      p_file_size_bytes: blob.size,
      p_schema_version: 1,
      p_make_default: makeDefault,
    });
    if (registerError) {
      await supabase.storage.from(PAINT_BUCKET).remove([path]);
      setSaving(false); setError(registerError.message); return;
    }
    try {
      await refreshJobs(selected.id);
      setLoadedDocument(document); setLoadedName(name); setLoadKey((value) => value + 1);
      setMessage(makeDefault ? `“${name}” saved as ${selected.name}'s default VTT paint.` : `“${name}” saved as a private enemy paint variant.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paint was saved but the list could not be refreshed.");
    } finally { setSaving(false); }
  };

  const setDefault = async (job: VttEnemyPaintJob) => {
    if (busyJob) return;
    setBusyJob(job.id); setError(null);
    const { error: rpcError } = await supabase.rpc("set_vtt_enemy_paint_default", { p_paint_job_id: job.id });
    if (rpcError) setError(rpcError.message);
    else if (selected) {
      await refreshJobs(selected.id).catch(() => undefined);
      setMessage(`“${job.name}” is now the default paint players will see after reveal.`);
    }
    setBusyJob(null);
  };

  if (loading) return <div className="h-[680px] animate-pulse rounded-[30px] border border-slate-800 bg-slate-900/50" />;
  if (models.length === 0) return <div className="rounded-[30px] border border-slate-800 bg-slate-900/65 p-10 text-center text-slate-500">Upload an enemy STL in the Enemy Studio first.</div>;

  return (
    <div className="space-y-5">
      <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Private monster paint</p><h2 className="mt-2 text-2xl font-black">{selected?.name ?? "Enemy"}</h2><p className="mt-2 text-xs leading-5 text-slate-500">Only the GM can browse or edit this library. Players receive only the default paint of a revealed enemy token.</p></div><label className="text-xs font-bold text-slate-500">Enemy<select value={selectedId ?? ""} onChange={(event) => setSelectedId(event.target.value || null)} className="mt-2 min-h-11 w-full min-w-[240px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-bold text-slate-100"><option value="">Choose enemy</option>{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label></div>
      </section>

      {selected ? (
        <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Saved paints</p><span className="text-xs font-bold text-slate-600">{jobs.length}</span></div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2"><button type="button" onClick={() => void loadJob(null)} className="min-w-[180px] rounded-xl border border-slate-700 px-3 py-3 text-left text-xs font-bold text-slate-300">Original / unpainted</button>{jobs.map((job) => <div key={job.id} className="min-w-[220px] rounded-xl border border-slate-800 bg-slate-950/40 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-black text-slate-100">{job.name}</p><p className="mt-1 text-[10px] text-slate-600">GM-only paint</p></div>{job.is_default ? <span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[9px] font-black uppercase text-yellow-300">Default</span> : null}</div><div className="mt-3 flex gap-2"><button type="button" disabled={Boolean(busyJob)} onClick={() => void loadJob(job)} className="rounded-lg border border-fuchsia-400/25 px-3 py-1.5 text-[10px] font-bold text-fuchsia-200">{busyJob === job.id ? "Loading…" : "Load"}</button>{!job.is_default ? <button type="button" disabled={Boolean(busyJob)} onClick={() => void setDefault(job)} className="rounded-lg border border-yellow-400/25 px-3 py-1.5 text-[10px] font-bold text-yellow-200">Set default</button> : null}</div></div>)}</div>
        </section>
      ) : null}

      <MiniaturePainter sourceFile={sourceFile} loadedPaintDocument={loadedDocument} paintLoadKey={loadKey} loadedSkinName={loadedName} canSave={Boolean(selected)} canMakeDefault saveActionLabel="Save enemy paint" saveHelperText="Enemy paint jobs stay private. Marking one default only affects what players see after this enemy token is revealed." saving={saving} onSavePaintJob={savePaint} />

      {message ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
