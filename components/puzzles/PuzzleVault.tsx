"use client";

import Link from "next/link";
import { PUZZLE_TYPE_LABELS, type PuzzleTheme } from "@/lib/puzzles/puzzleTypes";
import { usePuzzleVault } from "./usePuzzleVault";

type Props = {
  campaignId: string;
  campaignSlug: string;
  role: "dm" | "player";
  theme?: PuzzleTheme;
};

function puzzleHref(campaignSlug: string, puzzleId: string) {
  return campaignSlug === "barovia"
    ? `/campaigns/barovia/puzzles/${puzzleId}`
    : `/puzzles/${puzzleId}`;
}

function pressureText(moveLimit: number | null, attemptLimit: number | null, timeLimit: number | null) {
  const pressure: string[] = [];
  if (moveLimit != null) pressure.push(`${moveLimit} moves`);
  if (attemptLimit != null) pressure.push(`${attemptLimit} attempts`);
  if (timeLimit != null) {
    const minutes = Math.floor(timeLimit / 60);
    const seconds = timeLimit % 60;
    pressure.push(minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")} timer` : `${seconds}s timer`);
  }
  return pressure.length > 0 ? pressure.join(" · ") : "No pressure limit";
}

export function PuzzleVault({ campaignId, campaignSlug, role, theme = "nattau" }: Props) {
  const { puzzles, runs, loading, error } = usePuzzleVault({ campaignId });
  const barovia = theme === "barovia";
  const workshopHref = campaignSlug === "barovia" ? "/campaigns/barovia/gm/puzzles" : "/gm/puzzles";

  return (
    <main className={`min-h-screen px-4 py-7 sm:px-6 lg:py-10 ${barovia ? "bg-[#0b070a] text-[#eadfe3]" : ""}`}>
      <div className="mx-auto max-w-6xl">
        <header className={`overflow-hidden rounded-[32px] border p-6 sm:p-8 ${barovia ? "border-[#4b2935] bg-[radial-gradient(circle_at_top_left,#391723_0%,#140c11_55%,#0a0709_100%)]" : "border-slate-800 bg-[radial-gradient(circle_at_top_left,#263249_0%,#111925_55%,#090e16_100%)]"}`}>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className={`text-xs font-black uppercase tracking-[0.34em] ${barovia ? "text-[#9e5368]" : "text-yellow-500"}`}>Interactive enigmas</p>
              <h1 className={`mt-3 text-4xl font-black sm:text-5xl ${barovia ? "font-serif text-[#efdde2]" : "text-slate-50"}`}>Puzzle Vault</h1>
              <p className={`mt-4 max-w-2xl text-sm leading-6 sm:text-base ${barovia ? "text-[#bba8ae]" : "text-slate-400"}`}>
                Ancient seals, impossible locks and hostile mechanisms. When one awakens, one player may take control while everyone else watches the same state live.
              </p>
            </div>
            {role === "dm" ? (
              <Link href={workshopHref} className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 font-black ${barovia ? "bg-[#74243a] text-[#f6e4e8]" : "bg-yellow-500 text-slate-950"}`}>
                Open Puzzle Workshop
              </Link>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
        ) : null}

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-56 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />)}
          </div>
        ) : puzzles.length === 0 ? (
          <div className={`mt-6 rounded-[30px] border p-10 text-center ${barovia ? "border-[#3f2730] bg-[#120c10]" : "border-slate-800 bg-slate-900/65"}`}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-black/20 text-3xl">◇</div>
            <h2 className="mt-5 text-2xl font-black">No active enigmas</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Nothing in the campaign currently demands a solution. Hidden drafts remain invisible until the Game Master chooses to reveal them.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {puzzles.map((puzzle) => {
              const run = puzzle.current_run_id ? runs[puzzle.current_run_id] : undefined;
              const status = run?.status ?? puzzle.status;
              const terminal = status === "solved" || status === "failed";
              return (
                <Link
                  key={puzzle.id}
                  href={puzzleHref(campaignSlug, puzzle.id)}
                  className={`group flex min-h-[250px] flex-col rounded-[28px] border p-5 transition hover:-translate-y-0.5 ${puzzle.is_test_visible ? "border-violet-500/35 bg-violet-950/15 hover:border-violet-400/50" : barovia ? "border-[#412832] bg-[#120c10] hover:border-[#704052]" : "border-slate-800 bg-slate-900/75 hover:border-yellow-600/40"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-[0.24em] ${barovia ? "text-[#9c6372]" : "text-yellow-500"}`}>{PUZZLE_TYPE_LABELS[puzzle.puzzle_type]}</span>
                      {puzzle.is_test_visible ? (
                        <span className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-violet-200">
                          Test only
                        </span>
                      ) : null}
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${status === "solved" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : status === "failed" ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : barovia ? "border-[#633445] bg-[#5b1c2e]/20 text-[#d9aeb9]" : "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"}`}>{status}</span>
                  </div>
                  <h2 className={`mt-4 text-2xl font-black ${barovia ? "font-serif text-[#ead7dc]" : "text-slate-100"}`}>{puzzle.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{puzzle.description || "An unexplained mechanism awaits."}</p>

                  {puzzle.is_test_visible ? (
                    <p className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-[11px] font-semibold leading-4 text-violet-200/90">
                      Test run · visible only to the GM and campaign test accounts.
                    </p>
                  ) : null}

                  <div className="mt-auto pt-5">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-800 bg-black/15 px-2.5 py-1">{puzzle.difficulty_label}</span>
                      <span className="rounded-full border border-slate-800 bg-black/15 px-2.5 py-1">{pressureText(puzzle.move_limit, puzzle.attempt_limit, puzzle.time_limit_seconds)}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
                      <div className="min-w-0">
                        {run?.controller_name && run.status === "active" ? (
                          <p className="truncate text-xs font-semibold text-cyan-300">● {run.controller_name} is solving</p>
                        ) : run?.status === "solved" ? (
                          <p className="truncate text-xs font-semibold text-emerald-300">
                            ✓ Solved{run.solved_by_name ? ` by ${run.solved_by_name}` : ""} · {run.move_count} {run.move_count === 1 ? "move" : "moves"}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-600">{terminal ? "Final state available" : "Ready for a solver"}</p>
                        )}
                      </div>
                      <span className={`text-sm font-black transition group-hover:translate-x-1 ${puzzle.is_test_visible ? "text-violet-300" : barovia ? "text-[#d8adb8]" : "text-yellow-300"}`}>{terminal ? "View" : "Enter"} →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
