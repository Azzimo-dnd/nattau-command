"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MiniaturePainterPrototype } from "./MiniaturePainterPrototype";

type RosterRow = {
  player_id: string;
  display_name: string;
  miniature_id: string | null;
  storage_path: string | null;
  original_name: string | null;
};

type Props = {
  campaignId: string;
};

const BUCKET = "character-miniatures";

export function MiniaturePainterLab({ campaignId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingModel, setLoadingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => roster.find((row) => row.player_id === selectedPlayerId) ?? null,
    [roster, selectedPlayerId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void supabase.rpc("list_campaign_miniature_roster", { p_campaign_id: campaignId })
      .then(({ data, error: rpcError }) => {
        if (rpcError) throw rpcError;
        if (cancelled) return;
        const rows = ((data ?? []) as RosterRow[]).filter((row) => row.miniature_id && row.storage_path && row.original_name);
        setRoster(rows);
        const pippo = rows.find((row) => row.display_name.trim().toLowerCase() === "pippo");
        setSelectedPlayerId(pippo?.player_id ?? rows[0]?.player_id ?? null);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load miniature roster.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [campaignId, supabase]);

  useEffect(() => {
    let cancelled = false;
    setSourceFile(null);
    setError(null);
    if (!selected?.storage_path || !selected.original_name) return () => { cancelled = true; };

    setLoadingModel(true);
    void supabase.storage.from(BUCKET).download(selected.storage_path)
      .then(({ data, error: downloadError }) => {
        if (downloadError) throw downloadError;
        if (cancelled) return;
        setSourceFile(new File([data], selected.original_name ?? "miniature.stl", {
          type: data.type || "application/octet-stream",
        }));
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load current miniature.");
      })
      .finally(() => {
        if (!cancelled) setLoadingModel(false);
      });

    return () => { cancelled = true; };
  }, [selected, supabase]);

  if (loading) {
    return <div className="h-[680px] animate-pulse rounded-[30px] border border-slate-800 bg-slate-900/50" />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-800 bg-slate-900/65 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-300">Paint test subject</p>
            <h2 className="mt-2 text-2xl font-black text-slate-100">Choose one of the saved miniatures</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              The painter downloads the current private STL, analyzes its triangle topology locally and never changes the saved model. Paint is intentionally temporary in this first experiment.
            </p>
          </div>
          <label className="min-w-[250px] text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Character
            <select
              value={selectedPlayerId ?? ""}
              disabled={roster.length === 0 || loadingModel}
              onChange={(event) => setSelectedPlayerId(event.target.value || null)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-bold normal-case tracking-normal text-slate-200 outline-none focus:border-fuchsia-400/60"
            >
              {roster.length === 0 ? <option value="">No saved miniatures</option> : null}
              {roster.map((row) => (
                <option key={row.player_id} value={row.player_id}>{row.display_name}</option>
              ))}
            </select>
          </label>
        </div>
        {loadingModel ? <p className="mt-3 text-xs font-semibold text-cyan-300">Downloading private STL…</p> : null}
      </section>

      <MiniaturePainterPrototype sourceFile={sourceFile} />

      {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
