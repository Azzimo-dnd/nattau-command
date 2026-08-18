"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PUZZLE_TYPE_LABELS } from "@/lib/puzzles/puzzleTypes";
import { usePuzzleVault } from "./usePuzzleVault";

type Props = { campaignId: string };

export function PuzzleMaintenancePanel({ campaignId }: Props) {
  const vault = usePuzzleVault({ campaignId });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const archived = useMemo(
    () => vault.puzzles.filter((puzzle) => puzzle.status === "archived").length,
    [vault.puzzles],
  );

  const runRpc = async (
    puzzleId: string,
    rpc: string,
    args: Record<string, unknown>,
    success: string,
  ) => {
    setBusyId(puzzleId);
    setMessage(null);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc(rpc, args);
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setMessage(success);
    await vault.refresh(true);
  };

  return (
    <section className="mx-auto mt-6 max-w-7xl px-4 pb-10 sm:px-6">
      <div className="rounded-[28px] border border-slate-800 bg-slate-900/75 p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-rose-400/80">Maintenance</p>
            <h2 className="mt-2 text-2xl font-black text-slate-100">Puzzle cleanup & archive</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Every puzzle can be permanently deleted, regardless of whether it is a draft, active, solved, failed or archived. Archived puzzles can also be restored as hidden drafts.
            </p>
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400">
            {archived} archived
          </span>
        </div>

        {vault.loading ? (
          <div className="mt-5 h-24 animate-pulse rounded-2xl border border-slate-800 bg-slate-950/35" />
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {vault.puzzles.map((puzzle) => {
              const busy = busyId === puzzle.id;
              return (
                <article key={puzzle.id} className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        {PUZZLE_TYPE_LABELS[puzzle.puzzle_type]}
                      </p>
                      <h3 className="mt-1 truncate font-black text-slate-100">{puzzle.title}</h3>
                    </div>
                    <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-400">
                      {puzzle.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {puzzle.status === "archived" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runRpc(
                            puzzle.id,
                            "restore_campaign_puzzle",
                            { p_puzzle_id: puzzle.id },
                            `Restored ${puzzle.title} as a hidden draft.`,
                          )
                        }
                        className="min-h-11 rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-xs font-black text-emerald-200 disabled:opacity-35"
                      >
                        Restore
                      </button>
                    ) : (
                      <div className="min-h-11 rounded-xl border border-slate-800 px-3 py-2 text-xs text-slate-600">
                        Not archived
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Permanently delete “${puzzle.title}”? This deletes the puzzle, all runs, final state and move history. This cannot be undone.`,
                          )
                        ) {
                          void runRpc(
                            puzzle.id,
                            "delete_campaign_puzzle",
                            { p_puzzle_id: puzzle.id },
                            `Permanently deleted ${puzzle.title}.`,
                          );
                        }
                      }}
                      className="min-h-11 rounded-xl border border-red-600/45 bg-red-500/10 text-xs font-black text-red-200 disabled:opacity-35"
                    >
                      Delete permanently
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {message ? <p className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}
        {(error ?? vault.error) ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error ?? vault.error}</p> : null}
      </div>
    </section>
  );
}
