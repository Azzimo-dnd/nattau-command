"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MiniatureViewer, type MiniatureModelInfo } from "@/components/miniatures/MiniatureViewer";
import { createWebGlbFromStl } from "@/components/miniatures/miniatureModelFiles";
import { createClient } from "@/lib/supabase/client";
import type { VttEnemyModel } from "./vttTypes";

type Props = { campaignId: string };
type Candidate = { file: File; info: MiniatureModelInfo };
const BUCKET = "vtt-enemy-models";
const MAX_BYTES = 50 * 1024 * 1024;

function formatBytes(value: number | null) {
  if (value == null) return "—";
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function VttEnemyStudio({ campaignId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [models, setModels] = useState<VttEnemyModel[]>([]);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("vtt_enemy_models")
      .select("id,campaign_id,name,storage_path,web_storage_path,original_name,file_size_bytes,web_file_size_bytes,triangle_count,width_mm,depth_mm,height_mm,created_at")
      .eq("campaign_id", campaignId)
      .order("name");
    if (queryError) throw queryError;
    setModels((data ?? []) as VttEnemyModel[]);
  }, [campaignId, supabase]);

  useEffect(() => {
    let alive = true;
    refresh().catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Could not load enemy library."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refresh]);

  const onLocalFileLoaded = useCallback((file: File, info: MiniatureModelInfo) => {
    setCandidate({ file, info });
    setName(file.name.replace(/\.stl$/i, ""));
    setMessage(null);
    setError(null);
  }, []);

  const upload = async () => {
    if (!candidate || uploading || !name.trim()) return;
    if (candidate.file.size > MAX_BYTES) {
      setError("Enemy STL exceeds the 50 MB limit.");
      return;
    }
    setUploading(true); setError(null); setMessage(null);
    const stem = crypto.randomUUID();
    const sourcePath = `${campaignId}/${stem}.stl`;
    const webPath = `${campaignId}/${stem}.web.glb`;
    let sourceUploaded = false;
    let webUploaded = false;
    try {
      setProgress("Uploading private source STL…");
      const { error: sourceError } = await supabase.storage.from(BUCKET).upload(sourcePath, candidate.file, {
        contentType: candidate.file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });
      if (sourceError) throw sourceError;
      sourceUploaded = true;

      setProgress("Generating indexed web GLB…");
      const web = await createWebGlbFromStl(candidate.file);
      const { error: webError } = await supabase.storage.from(BUCKET).upload(webPath, web.blob, {
        contentType: "model/gltf-binary",
        cacheControl: "86400",
        upsert: false,
      });
      if (webError) throw webError;
      webUploaded = true;

      setProgress("Registering enemy miniature…");
      const { error: registerError } = await supabase.rpc("register_vtt_enemy_model", {
        p_campaign_id: campaignId,
        p_name: name.trim(),
        p_storage_path: sourcePath,
        p_web_storage_path: webPath,
        p_original_name: candidate.file.name,
        p_file_size_bytes: candidate.file.size,
        p_web_file_size_bytes: web.blob.size,
        p_triangle_count: candidate.info.triangles,
        p_width_mm: candidate.info.width,
        p_depth_mm: candidate.info.depth,
        p_height_mm: candidate.info.height,
      });
      if (registerError) throw registerError;

      await refresh();
      setMessage(`${name.trim()} added to the private enemy library. Web GLB: ${formatBytes(web.blob.size)}.`);
      setCandidate(null);
      setName("");
    } catch (cause) {
      if (webUploaded) await supabase.storage.from(BUCKET).remove([webPath]);
      if (sourceUploaded) await supabase.storage.from(BUCKET).remove([sourcePath]);
      setError(cause instanceof Error ? cause.message : "Could not add the enemy miniature.");
    } finally {
      setProgress(null);
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <MiniatureViewer
        sourceFile={candidate?.file ?? null}
        allowFilePicker
        emptyTitle="Choose an enemy STL"
        emptyCopy="This GM-only library is private. The STL becomes the source/print model and an indexed GLB is generated for the VTT."
        onLocalFileLoaded={onLocalFileLoaded}
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">Pending enemy</p>
          <label className="mt-4 block text-xs font-bold text-slate-500">Enemy name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Lizardfolk Warrior" className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-bold text-slate-100 outline-none focus:border-rose-400/50" />
          </label>
          {candidate ? <p className="mt-3 text-xs text-slate-500">{candidate.file.name} · {formatBytes(candidate.file.size)} · {candidate.info.triangles.toLocaleString()} triangles · {candidate.info.height.toFixed(1)} mm high</p> : null}
          <button type="button" disabled={!candidate || !name.trim() || uploading} onClick={() => void upload()} className="mt-5 min-h-12 w-full rounded-xl bg-rose-400 px-5 text-sm font-black text-slate-950 disabled:opacity-30 sm:w-auto">{uploading ? "Preparing enemy…" : "Upload STL + generate GLB"}</button>
          {progress ? <p className="mt-3 text-xs font-semibold text-cyan-200">{progress}</p> : null}
        </div>
        <div className="rounded-[26px] border border-fuchsia-400/20 bg-fuchsia-400/5 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">No spoilers</p>
          <p className="mt-3 text-xs leading-5 text-fuchsia-100/80">Enemy model metadata, source files and paint library are GM-only. Players only receive an enemy asset after a token is explicitly revealed on the VTT.</p>
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">Enemy library</p><h2 className="mt-2 text-2xl font-black">Private VTT miniatures</h2></div><span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-500">{models.length}</span></div>
        {loading ? <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-950/60" /> : models.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-slate-700 p-7 text-center text-sm text-slate-500">Upload the first monster STL above.</p> : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {models.map((model) => (
              <div key={model.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-black text-slate-100">{model.name}</h3><p className="mt-1 truncate text-[11px] text-slate-600">{model.original_name}</p></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-200">GLB</span></div>
                <p className="mt-3 text-[11px] text-slate-500">STL {formatBytes(model.file_size_bytes)} · Web {formatBytes(model.web_file_size_bytes)} · {model.triangle_count?.toLocaleString() ?? "?"} triangles</p>
                <div className="mt-4 flex gap-2"><Link href={`/gm/vtt/enemies/paint?model=${encodeURIComponent(model.id)}`} className="inline-flex min-h-9 items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 text-[11px] font-black text-fuchsia-100">Paint</Link><Link href="/vtt" className="inline-flex min-h-9 items-center rounded-xl border border-cyan-400/25 px-3 text-[11px] font-bold text-cyan-200">Open VTT</Link></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {message ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
