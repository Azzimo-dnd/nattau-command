"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PUZZLE_TYPE_LABELS,
  type CampaignPuzzleRow,
  type PuzzleTheme,
} from "@/lib/puzzles/puzzleTypes";
import { usePuzzleVault } from "./usePuzzleVault";

type Props = {
  campaignId: string;
  campaignSlug: string;
  theme?: PuzzleTheme;
};

function roomHref(slug: string, id: string) {
  return slug === "barovia" ? `/campaigns/barovia/puzzles/${id}` : `/puzzles/${id}`;
}

export function PuzzleTesterPanel({
  campaignId,
  campaignSlug,
  theme = "nattau",
}: Props) {
  const barovia = theme === "barovia";
  const vault = usePuzzleVault({ campaignId });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const puzzles = useMemo(
    () => vault.puzzles.filter((puzzle) => puzzle.status !== "archived"),
    [vault.puzzles],
  );
  const testerVisibleCount = useMemo(
    () => puzzles.filter((puzzle) => puzzle.is_test_visible).length,
    [puzzles],
  );

  const runRpc = async (
    puzzle: CampaignPuzzleRow,
    rpc: string,
    args: Record<string, unknown>,
    success: string,
  ) => {
    setBusyId(puzzle.id);
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

  const startForTesters = async (puzzle: CampaignPuzzleRow) => {
    if (
      puzzle.is_visible &&
      !window.confirm(
        `“${puzzle.title}” is currently visible to normal players. Starting a tester run will create a fresh run and switch its audience to GM + test accounts only. Continue?`,
      )
    ) {
      return;
    }

    await runRpc(
      puzzle,
      "start_campaign_puzzle_for_testers",
      { p_puzzle_id: puzzle.id },
      `Started ${puzzle.title} for GM + test accounts only.`,
    );
  };

  const endTesterAccess = async (puzzle: CampaignPuzzleRow) => {
    await runRpc(
      puzzle,
      "set_campaign_puzzle_test_visibility",
      { p_puzzle_id: puzzle.id, p_visible: false },
      `Tester access ended for ${puzzle.title}. The current run remains available to the GM only.`,
    );
  };

  return (
    <section className={`px-4 pt-7 sm:px-6 ${barovia ? "bg-[#0b070a] text-[#eadfe3]" : ""}`}>
      <div className="mx-auto max-w-7xl">
        <details
          open
          className={`overflow-hidden rounded-[26px] border ${
            barovia
              ? "border-[#5b3140] bg-[#160d12]"
              : "border-violet-500/25 bg-[linear-gradient(135deg,rgba(76,29,149,0.16),rgba(15,23,42,0.8))]"
          }`}
        >
          <summary className="cursor-pointer list-none px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-xs font-black uppercase tracking-[0.24em] ${barovia ? "text-[#b56b82]" : "text-violet-300"}`}>
                    Tester lane
                  </p>
                  {testerVisibleCount > 0 ? (
                    <span className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-violet-200">
                      {testerVisibleCount} testers only
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1 text-xl font-black text-slate-100">
                  GM + test-account puzzle access
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-500">Click to collapse</span>
            </div>
            <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-400">
              Start a real live run that can be read and controlled only by the GM and active campaign members flagged as test accounts. Normal players cannot see the puzzle card, open the room, read its run/move data or join its private realtime channel.
            </p>
          </summary>

          <div className="border-t border-slate-800/80 px-5 py-4 sm:px-6">
            {vault.loading ? (
              <div className="h-20 animate-pulse rounded-2xl border border-slate-800 bg-black/10" />
            ) : puzzles.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">
                No non-archived puzzles are available for testing yet.
              </p>
            ) : (
              <div className="grid gap-2">
                {puzzles.map((puzzle) => {
                  const busy = busyId === puzzle.id;
                  const run = puzzle.current_run_id
                    ? vault.runs[puzzle.current_run_id]
                    : undefined;
                  const audience = puzzle.is_test_visible
                    ? "testers"
                    : puzzle.is_visible
                      ? "public"
                      : "gm";

                  return (
                    <div
                      key={puzzle.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/45 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            {PUZZLE_TYPE_LABELS[puzzle.puzzle_type]} · {puzzle.difficulty_label}
                          </span>
                          {audience === "testers" ? (
                            <span className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-violet-200">
                              Testers only
                            </span>
                          ) : audience === "public" ? (
                            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300">
                              Public
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                              GM only
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm font-black text-slate-200">
                          {puzzle.title}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          {run?.status ?? puzzle.status}
                          {run?.controller_name ? ` · controlled by ${run.controller_name}` : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Link
                          href={roomHref(campaignSlug, puzzle.id)}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-700 px-3 text-[11px] font-bold text-slate-400"
                        >
                          Open room
                        </Link>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void startForTesters(puzzle)}
                          className="min-h-9 rounded-xl border border-violet-400/35 bg-violet-500/15 px-3 text-[11px] font-black text-violet-200 disabled:opacity-35"
                        >
                          {puzzle.is_test_visible ? "Restart tester run" : "Start for testers"}
                        </button>
                        {puzzle.is_test_visible ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void endTesterAccess(puzzle)}
                            className="min-h-9 rounded-xl border border-slate-700 px-3 text-[11px] font-bold text-slate-400 disabled:opacity-35"
                          >
                            End tester access
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {error || vault.error ? (
              <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                {error ?? vault.error}
              </p>
            ) : null}
            {message ? (
              <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
                {message}
              </p>
            ) : null}
          </div>
        </details>
      </div>
    </section>
  );
}
