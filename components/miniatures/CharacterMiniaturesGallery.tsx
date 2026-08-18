"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MiniatureViewer } from "./MiniatureViewer";

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

type Props = {
  campaignId: string;
  preferredPlayerId?: string | null;
};

const BUCKET = "character-miniatures";

function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CharacterMiniaturesGallery({ campaignId, preferredPlayerId = null }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingModel, setLoadingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => roster.find((row) => row.player_id === selectedId) ?? null,
    [roster, selectedId],
  );

  const downloadCurrent = useCallback(async (row: RosterRow) => {
    if (!row.storage_path || !row.original_name) {
      setSourceFile(null);
      return;
    }
    setLoadingModel(true);
    const { data, error: downloadError } = await supabase.storage.from(BUCKET).download(row.storage_path);
    setLoadingModel(false);
    if (downloadError) throw downloadError;
    setSourceFile(new File([data], row.original_name, { type: data.type || "application/octet-stream" }));
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void supabase.rpc("list_campaign_miniature_roster", { p_campaign_id: campaignId })
      .then(({ data, error: rpcError }) => {
        if (rpcError) throw rpcError;
        if (cancelled) return;
        const rows = (data ?? []) as RosterRow[];
        setRoster(rows);
        const preferred = preferredPlayerId && rows.some((row) => row.player_id === preferredPlayerId)
          ? preferredPlayerId
          : null;
        setSelectedId(preferred ?? rows.find((row) => row.miniature_id)?.player_id ?? rows[0]?.player_id ?? null);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load character miniatures.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [campaignId, preferredPlayerId, supabase]);

  useEffect(() => {
    let cancelled = false;
    setSourceFile(null);
    setError(null);
    const row = roster.find((entry) => entry.player_id === selectedId);
    if (!row) return () => { cancelled = true; };
    void downloadCurrent(row).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not download this miniature.");
    });
    return () => { cancelled = true; };
  }, [downloadCurrent, roster, selectedId]);

  if (loading) {
    return <div className="h-[620px] animate-pulse rounded-[30px] border border-slate-800 bg-slate-900/55" />;
  }

  if (roster.length === 0) {
    return <div className="rounded-[30px] border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-500">No active player characters are available.</div>;
  }

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
                <div className="min-w-0">
                  <p className={`truncate text-base font-black ${active ? "text-yellow-100" : "text-slate-200"}`}>{row.display_name}</p>
                  <p className="mt-1 truncate text-[11px] text-slate-600">{row.original_name ?? "No miniature yet"}</p>
                </div>
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
                <p className="mt-2 text-sm text-slate-500">
                  {selected.miniature_id
                    ? `${selected.original_name} · ${formatBytes(selected.file_size_bytes)} · ${selected.triangle_count?.toLocaleString() ?? "?"} triangles`
                    : "The Game Master has not assigned a miniature to this character yet."}
                </p>
              </div>
              {loadingModel ? <span className="text-xs font-semibold text-cyan-300">Loading private model…</span> : null}
            </div>
          </section>

          <MiniatureViewer
            sourceFile={sourceFile}
            allowFilePicker={false}
            emptyTitle={`No miniature for ${selected.display_name}`}
            emptyCopy="When the Game Master assigns a current STL, it will appear here automatically."
          />
        </>
      ) : null}

      {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
