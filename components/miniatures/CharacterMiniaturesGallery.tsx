"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MiniatureSkinViewer } from "./MiniatureSkinViewer";
import { parseMiniaturePaintDocument, type MiniaturePaintDocument } from "./miniaturePaintData";

type RosterRow = {
  player_id: string;
  display_name: string;
  miniature_id: string | null;
  storage_path: string | null;
  original_name: string | null;
  file_size_bytes: number | null;
  triangle_count: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  miniature_created_at: string | null;
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
  is_guest_contribution: boolean;
  can_replace: boolean;
};

type Props = {
  campaignId: string;
  currentUserId: string;
  isDm: boolean;
  preferredPlayerId?: string | null;
};

const MINIATURE_BUCKET = "character-miniatures";
const PAINT_BUCKET = "character-miniature-paints";

function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CharacterMiniaturesGallery({ campaignId, currentUserId, isDm, preferredPlayerId = null }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [skins, setSkins] = useState<PaintJobRow[]>([]);
  const [selectedSkinId, setSelectedSkinId] = useState<string | null>(null);
  const [skinDocument, setSkinDocument] = useState<MiniaturePaintDocument | null>(null);
  const [skinName, setSkinName] = useState<string | null>("Original / unpainted");
  const [loading, setLoading] = useState(true);
  const [loadingModel, setLoadingModel] = useState(false);
  const [loadingSkin, setLoadingSkin] = useState(false);
  const [busySkinId, setBusySkinId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => roster.find((row) => row.player_id === selectedId) ?? null,
    [roster, selectedId],
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

  const downloadSkin = useCallback(async (skin: PaintJobRow) => {
    const { data, error: downloadError } = await supabase.storage.from(PAINT_BUCKET).download(skin.storage_path);
    if (downloadError) throw downloadError;
    return parseMiniaturePaintDocument(JSON.parse(await data.text()) as unknown);
  }, [supabase]);

  const chooseSkin = useCallback(async (skin: PaintJobRow | null) => {
    setError(null);
    setMessage(null);
    if (!skin) {
      setSelectedSkinId(null);
      setSkinDocument(null);
      setSkinName("Original / unpainted");
      return;
    }

    setLoadingSkin(true);
    setBusySkinId(skin.id);
    try {
      const document = await downloadSkin(skin);
      setSelectedSkinId(skin.id);
      setSkinDocument(document);
      setSkinName(skin.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this skin.");
    } finally {
      setLoadingSkin(false);
      setBusySkinId(null);
    }
  }, [downloadSkin]);

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

        const rows = (data ?? []) as RosterRow[];
        setRoster(rows);
        const preferred = preferredPlayerId && rows.some((row) => row.player_id === preferredPlayerId)
          ? preferredPlayerId
          : null;
        setSelectedId(preferred ?? rows.find((row) => row.miniature_id)?.player_id ?? rows[0]?.player_id ?? null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load character miniatures.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadRoster();
    return () => { cancelled = true; };
  }, [campaignId, preferredPlayerId, supabase]);

  useEffect(() => {
    let cancelled = false;
    const loadSelected = async () => {
      setSourceFile(null);
      setSkins([]);
      setSelectedSkinId(null);
      setSkinDocument(null);
      setSkinName("Original / unpainted");
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
          const document = await downloadSkin(defaultSkin);
          if (cancelled) return;
          setSelectedSkinId(defaultSkin.id);
          setSkinDocument(document);
          setSkinName(defaultSkin.name);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load this miniature and its skins.");
      } finally {
        if (!cancelled) setLoadingModel(false);
      }
    };
    void loadSelected();
    return () => { cancelled = true; };
  }, [downloadSkin, refreshSkins, selected, supabase]);

  const setDefault = async (skin: PaintJobRow | null) => {
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
      setMessage(skin ? `“${skin.name}” is now the default skin.` : "Original / unpainted is now the default skin.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Default changed, but the skin list could not be refreshed.");
    } finally {
      setBusySkinId(null);
    }
  };

  if (loading) return <div className="h-[620px] animate-pulse rounded-[30px] border border-slate-800 bg-slate-900/55" />;
  if (roster.length === 0) return <div className="rounded-[30px] border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-500">No active player characters are available.</div>;

  const hasDefault = skins.some((skin) => skin.is_default);
  const canSetDefault = Boolean(selected && (isDm || selected.player_id === currentUserId));
  const canPaintSelected = Boolean(selected?.miniature_id);
  const paintHref = selected
    ? isDm ? "/gm/miniatures/paint" : `/characters/paint?character=${encodeURIComponent(selected.player_id)}`
    : isDm ? "/gm/miniatures/paint" : "/characters/paint";

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {roster.map((row) => {
          const active = row.player_id === selectedId;
          return (
            <button
              key={row.player_id}
              type="button"
              onClick={() => setSelectedId(row.player_id)}
              className={`rounded-2xl border p-4 text-left transition ${active ? "border-yellow-500/50 bg-yellow-500/10" : "border-slate-800 bg-slate-900/65 hover:border-slate-700"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className={`truncate text-base font-black ${active ? "text-yellow-100" : "text-slate-200"}`}>{row.display_name}</p><p className="mt-1 truncate text-[11px] text-slate-600">{row.original_name ?? "No miniature yet"}</p></div>
                <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${row.miniature_id ? "bg-emerald-400" : "bg-slate-700"}`} />
              </div>
            </button>
          );
        })}
      </section>

      {selected ? (
        <>
          <section className="rounded-[26px] border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-yellow-500">Current miniature</p>
                <h2 className="mt-2 text-2xl font-black text-slate-100">{selected.display_name}</h2>
                <p className="mt-2 text-sm text-slate-500">{selected.miniature_id ? `${selected.original_name} · ${formatBytes(selected.file_size_bytes)} · ${selected.triangle_count?.toLocaleString() ?? "?"} triangles` : "The Game Master has not assigned a miniature to this character yet."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {loadingModel || loadingSkin ? <span className="self-center text-xs font-semibold text-cyan-300">Loading private model…</span> : null}
                {canPaintSelected ? (
                  <Link href={paintHref} className="inline-flex min-h-10 items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 text-xs font-black text-fuchsia-100">
                    {isDm ? "Paint miniature" : selected.player_id === currentUserId ? "Paint my miniature" : `Paint ${selected.display_name}`}
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          {selected.miniature_id ? (
            <section className="rounded-[26px] border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Skins</p><p className="mt-1 text-xs text-slate-500">Everyone can preview skins. Players may contribute one skin to someone else&apos;s miniature; only the owner or GM chooses the default.</p></div>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-500">{skins.length} saved</span>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                <div className={`min-w-[210px] rounded-2xl border p-3 ${selectedSkinId === null ? "border-cyan-400/40 bg-cyan-400/5" : "border-slate-800 bg-black/10"}`}>
                  <div className="flex items-start justify-between gap-2"><div><p className="font-black text-slate-200">Original / unpainted</p><p className="mt-1 text-[11px] text-slate-600">Base STL</p></div>{!hasDefault ? <span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[9px] font-black uppercase text-yellow-300">Default</span> : null}</div>
                  <div className="mt-3 flex gap-2"><button type="button" disabled={loadingSkin} onClick={() => void chooseSkin(null)} className="rounded-lg border border-cyan-400/25 px-3 py-1.5 text-[11px] font-bold text-cyan-200">Preview</button>{canSetDefault && hasDefault ? <button type="button" disabled={busySkinId !== null} onClick={() => void setDefault(null)} className="rounded-lg border border-yellow-400/25 px-3 py-1.5 text-[11px] font-bold text-yellow-200">Set default</button> : null}</div>
                </div>
                {skins.map((skin) => (
                  <div key={skin.id} className={`min-w-[230px] rounded-2xl border p-3 ${selectedSkinId === skin.id ? "border-fuchsia-400/40 bg-fuchsia-400/5" : "border-slate-800 bg-black/10"}`}>
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-black text-slate-200">{skin.name}</p><p className="mt-1 truncate text-[11px] text-slate-600">by {skin.creator_display_name}</p>{skin.is_mine && skin.is_guest_contribution ? <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-300">Your community skin</p> : null}</div>{skin.is_default ? <span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[9px] font-black uppercase text-yellow-300">Default</span> : null}</div>
                    <div className="mt-3 flex gap-2"><button type="button" disabled={loadingSkin} onClick={() => void chooseSkin(skin)} className="rounded-lg border border-fuchsia-400/25 px-3 py-1.5 text-[11px] font-bold text-fuchsia-200">{busySkinId === skin.id && loadingSkin ? "Loading…" : "Preview"}</button>{canSetDefault && !skin.is_default ? <button type="button" disabled={busySkinId !== null} onClick={() => void setDefault(skin)} className="rounded-lg border border-yellow-400/25 px-3 py-1.5 text-[11px] font-bold text-yellow-200">Set default</button> : null}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <MiniatureSkinViewer sourceFile={sourceFile} paintDocument={skinDocument} skinName={skinName} />
        </>
      ) : null}

      {message ? <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
