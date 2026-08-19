"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MiniaturePainter } from "./MiniaturePainter";
import {
  parseMiniaturePaintDocument,
  serializeMiniaturePaintDocument,
  type MiniaturePaintDocument,
} from "./miniaturePaintData";

type RosterRow = {
  player_id: string;
  display_name: string;
  miniature_id: string | null;
  storage_path: string | null;
  original_name: string | null;
};

type PaintJobRow = {
  id: string;
  name: string;
  storage_path: string;
  schema_version: number;
  file_size_bytes: number;
  is_default: boolean;
  created_by: string;
  creator_display_name: string;
  created_at: string;
  can_set_default: boolean;
  is_mine: boolean;
};

type Props = {
  campaignId: string;
  initialPlayerId?: string | null;
  lockToPlayer?: boolean;
  canManage?: boolean;
};

const MINIATURE_BUCKET = "character-miniatures";
const PAINT_BUCKET = "character-miniature-paints";
const MAX_PAINT_BYTES = 8 * 1024 * 1024;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MiniaturePainterLab({ campaignId, initialPlayerId = null, lockToPlayer = false, canManage = true }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(initialPlayerId);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [skins, setSkins] = useState<PaintJobRow[]>([]);
  const [loadedPaintDocument, setLoadedPaintDocument] = useState<MiniaturePaintDocument | null>(null);
  const [loadedSkinId, setLoadedSkinId] = useState<string | null>(null);
  const [loadedSkinName, setLoadedSkinName] = useState<string | null>(null);
  const [paintLoadKey, setPaintLoadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingModel, setLoadingModel] = useState(false);
  const [loadingSkin, setLoadingSkin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busySkinId, setBusySkinId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => roster.find((row) => row.player_id === selectedPlayerId) ?? null,
    [roster, selectedPlayerId],
  );

  const refreshSkins = useCallback(async (miniatureId: string) => {
    const { data, error: rpcError } = await supabase.rpc("list_character_miniature_paint_jobs", {
      p_miniature_id: miniatureId,
    });
    if (rpcError) throw rpcError;
    const rows = (data ?? []) as PaintJobRow[];
    setSkins(rows);
    return rows;
  }, [supabase]);

  const downloadSkinDocument = useCallback(async (skin: PaintJobRow) => {
    const { data, error: downloadError } = await supabase.storage.from(PAINT_BUCKET).download(skin.storage_path);
    if (downloadError) throw downloadError;
    const raw = JSON.parse(await data.text()) as unknown;
    return parseMiniaturePaintDocument(raw);
  }, [supabase]);

  const loadSkin = useCallback(async (skin: PaintJobRow | null) => {
    setError(null);
    setMessage(null);
    if (!skin) {
      setLoadedPaintDocument(null);
      setLoadedSkinId(null);
      setLoadedSkinName("Original / unpainted");
      setPaintLoadKey((value) => value + 1);
      return;
    }

    setLoadingSkin(true);
    setBusySkinId(skin.id);
    try {
      const document = await downloadSkinDocument(skin);
      setLoadedPaintDocument(document);
      setLoadedSkinId(skin.id);
      setLoadedSkinName(skin.name);
      setPaintLoadKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this paint skin.");
    } finally {
      setLoadingSkin(false);
      setBusySkinId(null);
    }
  }, [downloadSkinDocument]);

  useEffect(() => {
    let cancelled = false;
    const loadRoster = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc("list_campaign_miniature_roster", {
          p_campaign_id: campaignId,
        });
        if (rpcError) throw rpcError;
        if (cancelled) return;
        const rows = ((data ?? []) as RosterRow[]).filter((row) => row.miniature_id && row.storage_path && row.original_name);
        const visibleRows = lockToPlayer && initialPlayerId
          ? rows.filter((row) => row.player_id === initialPlayerId)
          : rows;
        setRoster(visibleRows);
        setSelectedPlayerId((current) => {
          if (current && visibleRows.some((row) => row.player_id === current)) return current;
          if (initialPlayerId && visibleRows.some((row) => row.player_id === initialPlayerId)) return initialPlayerId;
          const pippo = visibleRows.find((row) => row.display_name.trim().toLowerCase() === "pippo");
          return pippo?.player_id ?? visibleRows[0]?.player_id ?? null;
        });
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load miniature roster.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadRoster();
    return () => { cancelled = true; };
  }, [campaignId, initialPlayerId, lockToPlayer, supabase]);

  useEffect(() => {
    let cancelled = false;
    const loadModelAndSkins = async () => {
      setSourceFile(null);
      setSkins([]);
      setLoadedPaintDocument(null);
      setLoadedSkinId(null);
      setLoadedSkinName(null);
      setPaintLoadKey((value) => value + 1);
      setError(null);
      setMessage(null);
      if (!selected?.storage_path || !selected.original_name || !selected.miniature_id) return;

      setLoadingModel(true);
      try {
        const [modelResult, skinRows] = await Promise.all([
          supabase.storage.from(MINIATURE_BUCKET).download(selected.storage_path),
          refreshSkins(selected.miniature_id),
        ]);
        if (modelResult.error) throw modelResult.error;
        if (cancelled) return;
        setSourceFile(new File([modelResult.data], selected.original_name, {
          type: modelResult.data.type || "application/octet-stream",
        }));

        const defaultSkin = skinRows.find((skin) => skin.is_default) ?? null;
        if (defaultSkin) {
          const document = await downloadSkinDocument(defaultSkin);
          if (cancelled) return;
          setLoadedPaintDocument(document);
          setLoadedSkinId(defaultSkin.id);
          setLoadedSkinName(defaultSkin.name);
          setPaintLoadKey((value) => value + 1);
        } else {
          setLoadedSkinName("Original / unpainted");
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the miniature and its skins.");
      } finally {
        if (!cancelled) setLoadingModel(false);
      }
    };
    void loadModelAndSkins();
    return () => { cancelled = true; };
  }, [downloadSkinDocument, refreshSkins, selected, supabase]);

  const savePaintJob = async (document: MiniaturePaintDocument, name: string, makeDefault: boolean) => {
    if (!selected?.miniature_id || !selectedPlayerId || saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const serialized = serializeMiniaturePaintDocument(document);
    const blob = new Blob([serialized], { type: "application/json" });
    if (blob.size > MAX_PAINT_BYTES) {
      setSaving(false);
      setError("This paint skin is larger than the 8 MB limit.");
      return;
    }

    const storagePath = `${campaignId}/${selectedPlayerId}/${selected.miniature_id}/${crypto.randomUUID()}.json`;
    const { error: uploadError } = await supabase.storage.from(PAINT_BUCKET).upload(storagePath, blob, {
      contentType: "application/json",
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      setSaving(false);
      setError(uploadError.message);
      return;
    }

    const { data: registeredId, error: registerError } = await supabase.rpc("register_character_miniature_paint_job", {
      p_miniature_id: selected.miniature_id,
      p_storage_path: storagePath,
      p_name: name,
      p_file_size_bytes: blob.size,
      p_schema_version: 1,
    });
    if (registerError) {
      await supabase.storage.from(PAINT_BUCKET).remove([storagePath]);
      setSaving(false);
      setError(registerError.message);
      return;
    }

    if (makeDefault && registeredId) {
      const { error: defaultError } = await supabase.rpc("set_character_miniature_paint_default", {
        p_paint_job_id: registeredId,
      });
      if (defaultError) {
        setSaving(false);
        setError(`Skin saved, but default could not be changed: ${defaultError.message}`);
        await refreshSkins(selected.miniature_id);
        return;
      }
    }

    try {
      await refreshSkins(selected.miniature_id);
      setLoadedPaintDocument(document);
      setLoadedSkinId(typeof registeredId === "string" ? registeredId : null);
      setLoadedSkinName(name);
      setPaintLoadKey((value) => value + 1);
      setMessage(makeDefault ? `“${name}” was saved and is now the default skin.` : `“${name}” was saved as a new skin.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Skin was saved, but the list could not be refreshed.");
    } finally {
      setSaving(false);
    }
  };

  const setDefaultSkin = async (skin: PaintJobRow | null) => {
    if (!selected?.miniature_id || busySkinId) return;
    setError(null);
    setMessage(null);
    setBusySkinId(skin?.id ?? "original");
    const result = skin
      ? await supabase.rpc("set_character_miniature_paint_default", { p_paint_job_id: skin.id })
      : await supabase.rpc("clear_character_miniature_paint_default", { p_miniature_id: selected.miniature_id });
    if (result.error) {
      setBusySkinId(null);
      setError(result.error.message);
      return;
    }
    try {
      await refreshSkins(selected.miniature_id);
      setMessage(skin ? `“${skin.name}” is now the default skin.` : "The original unpainted miniature is now the default.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Default changed, but the skin list could not be refreshed.");
    } finally {
      setBusySkinId(null);
    }
  };

  if (loading) return <div className="h-[680px] animate-pulse rounded-[30px] border border-slate-800 bg-slate-900/50" />;

  const hasDefault = skins.some((skin) => skin.is_default);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-800 bg-slate-900/65 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-300">Miniature skin studio</p>
            <h2 className="mt-2 text-2xl font-black text-slate-100">Paint, save and switch skins</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Every saved paint job is a lightweight skin attached to this exact STL version. Loading a skin never changes the source miniature.</p>
          </div>
          {!lockToPlayer ? (
            <label className="min-w-[250px] text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Character<select value={selectedPlayerId ?? ""} disabled={roster.length === 0 || loadingModel} onChange={(event) => setSelectedPlayerId(event.target.value || null)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-bold normal-case tracking-normal text-slate-200 outline-none focus:border-fuchsia-400/60">{roster.length === 0 ? <option value="">No saved miniatures</option> : null}{roster.map((row) => <option key={row.player_id} value={row.player_id}>{row.display_name}</option>)}</select></label>
          ) : selected ? <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/5 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-300">Your character</p><p className="mt-1 font-black text-slate-100">{selected.display_name}</p></div> : null}
        </div>
        {loadingModel ? <p className="mt-3 text-xs font-semibold text-cyan-300">Downloading private STL and skins…</p> : null}
      </section>

      {selected?.miniature_id ? (
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/65 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Available skins</p><h3 className="mt-2 text-xl font-black text-slate-100">{selected.display_name}</h3></div><span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-500">{skins.length} saved</span></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <div className={`rounded-2xl border p-3 ${loadedSkinId === null ? "border-cyan-400/40 bg-cyan-400/5" : "border-slate-800 bg-black/10"}`}><div className="flex items-start justify-between gap-2"><div><p className="font-black text-slate-200">Original / unpainted</p><p className="mt-1 text-[11px] text-slate-600">Source STL with primer material</p></div>{!hasDefault ? <span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[9px] font-black uppercase text-yellow-300">Default</span> : null}</div><div className="mt-3 flex gap-2"><button type="button" disabled={loadingSkin} onClick={() => void loadSkin(null)} className="rounded-lg border border-cyan-400/25 px-3 py-1.5 text-[11px] font-bold text-cyan-200">Load</button>{canManage && hasDefault ? <button type="button" disabled={busySkinId !== null} onClick={() => void setDefaultSkin(null)} className="rounded-lg border border-yellow-400/25 px-3 py-1.5 text-[11px] font-bold text-yellow-200">Set default</button> : null}</div></div>
            {skins.map((skin) => <div key={skin.id} className={`rounded-2xl border p-3 ${loadedSkinId === skin.id ? "border-fuchsia-400/40 bg-fuchsia-400/5" : "border-slate-800 bg-black/10"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-black text-slate-200">{skin.name}</p><p className="mt-1 text-[11px] text-slate-600">by {skin.creator_display_name} · {formatDate(skin.created_at)}</p></div>{skin.is_default ? <span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[9px] font-black uppercase text-yellow-300">Default</span> : null}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={loadingSkin} onClick={() => void loadSkin(skin)} className="rounded-lg border border-fuchsia-400/25 px-3 py-1.5 text-[11px] font-bold text-fuchsia-200">{busySkinId === skin.id && loadingSkin ? "Loading…" : "Load / edit copy"}</button>{canManage && !skin.is_default ? <button type="button" disabled={busySkinId !== null} onClick={() => void setDefaultSkin(skin)} className="rounded-lg border border-yellow-400/25 px-3 py-1.5 text-[11px] font-bold text-yellow-200">Set default</button> : null}</div></div>)}
          </div>
        </section>
      ) : null}

      <MiniaturePainter sourceFile={sourceFile} loadedPaintDocument={loadedPaintDocument} paintLoadKey={paintLoadKey} loadedSkinName={loadedSkinName} canSave={canManage && Boolean(selected?.miniature_id)} saving={saving} onSavePaintJob={savePaintJob} />

      {message ? <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
