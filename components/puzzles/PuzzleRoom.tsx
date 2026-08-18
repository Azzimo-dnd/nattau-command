"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PUZZLE_TYPE_LABELS, type PuzzleTheme } from "@/lib/puzzles/puzzleTypes";
import { PuzzleEngine } from "./PuzzleEngine";
import { usePuzzleRoom } from "./usePuzzleRoom";

type Props = {
  campaignId: string;
  campaignSlug: string;
  puzzleId: string;
  currentUserId: string;
  currentUserName: string;
  role: "dm" | "player";
  theme?: PuzzleTheme;
};

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function statusClasses(status: string, barovia: boolean) {
  if (status === "solved") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "failed") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return barovia
    ? "border-[#8f4054]/40 bg-[#5a1825]/20 text-[#efc7d1]"
    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
}

function previewLabel(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const preview = value as Record<string, unknown>;
  const actor = typeof preview.actor === "string" ? preview.actor : "Someone";
  const action = preview.action;
  if (!action || typeof action !== "object") return `${actor} is interacting with the puzzle…`;
  const type = (action as Record<string, unknown>).type;
  const labels: Record<string, string> = {
    cipher_guess: "tests a rune sequence",
    slide: "moves a lock ward",
    swap: "moves a sigil fragment",
    rotate: "turns an arcane conduit",
    sequence_submit: "repeats the rune echo",
  };
  return `${actor} ${typeof type === "string" ? labels[type] ?? "makes a move" : "makes a move"}…`;
}

export function PuzzleRoom({
  campaignId,
  campaignSlug,
  puzzleId,
  currentUserId,
  currentUserName,
  role,
  theme = "nattau",
}: Props) {
  const barovia = theme === "barovia";
  const [now, setNow] = useState(() => Date.now());
  const room = usePuzzleRoom({
    campaignId,
    puzzleId,
    currentUserId,
    currentUserName,
    role,
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const backHref = campaignSlug === "barovia" ? "/campaigns/barovia/puzzles" : "/puzzles";
  const workshopHref = campaignSlug === "barovia" ? "/campaigns/barovia/gm/puzzles" : "/gm/puzzles";
  const controllerExpired = useMemo(() => {
    if (!room.run?.controller_user_id) return true;
    if (!room.run.control_expires_at) return true;
    return new Date(room.run.control_expires_at).getTime() <= now;
  }, [now, room.run?.control_expires_at, room.run?.controller_user_id]);

  if (room.loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="h-64 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
      </main>
    );
  }

  if (!room.puzzle) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-7 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">Puzzle Vault</p>
          <h1 className="mt-3 text-3xl font-black text-slate-100">The mechanism is gone</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{room.error ?? "This enigma is not available."}</p>
          <Link href={backHref} className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-5 font-semibold text-slate-200">
            Back to the Vault
          </Link>
        </div>
      </main>
    );
  }

  const puzzle = room.puzzle;
  const run = room.run;
  const active = run?.status === "active";
  const mayTakeControl = Boolean(
    active &&
      (!run?.controller_user_id ||
        run.controller_user_id === currentUserId ||
        controllerExpired ||
        role === "dm")
  );
  const deadlineMs = run?.deadline_at ? new Date(run.deadline_at).getTime() - now : null;
  const movesRemaining = puzzle.move_limit == null || !run ? null : Math.max(0, puzzle.move_limit - run.move_count);
  const attemptsRemaining = puzzle.attempt_limit == null || !run ? null : Math.max(0, puzzle.attempt_limit - run.attempt_count);
  const preview = previewLabel(room.lastPreview);

  return (
    <main className={`min-h-screen px-4 py-6 sm:px-6 lg:py-8 ${barovia ? "bg-[#0b070a]" : ""}`}>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={backHref} className={`text-sm font-semibold ${barovia ? "text-[#b9949e] hover:text-[#ead7dc]" : "text-slate-400 hover:text-yellow-300"}`}>
            ← Puzzle Vault
          </Link>
          {role === "dm" ? (
            <Link href={workshopHref} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${barovia ? "border-[#59313e] text-[#d8b8c1]" : "border-slate-700 text-slate-300"}`}>
              Puzzle Workshop
            </Link>
          ) : null}
        </div>

        <header className={`mt-5 overflow-hidden rounded-[30px] border p-5 shadow-2xl sm:p-7 ${barovia ? "border-[#4e2835] bg-[radial-gradient(circle_at_top,#35141f_0%,#130b10_58%,#0b070a_100%)] shadow-black/40" : "border-slate-800 bg-[radial-gradient(circle_at_top,#202a3c_0%,#101722_58%,#080d14_100%)] shadow-black/25"}`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${barovia ? "border-[#663646] bg-black/20 text-[#c68d9d]" : "border-slate-700 bg-slate-950/60 text-slate-400"}`}>
                  {PUZZLE_TYPE_LABELS[puzzle.puzzle_type]}
                </span>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${statusClasses(run?.status ?? puzzle.status, barovia)}`}>
                  {run?.status ?? puzzle.status}
                </span>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${barovia ? "border-[#4b2b35] text-[#9d7c85]" : "border-slate-700 text-slate-500"}`}>
                  {puzzle.difficulty_label}
                </span>
              </div>
              <h1 className={`mt-4 text-3xl font-black sm:text-4xl ${barovia ? "font-serif text-[#ecd9de]" : "text-slate-50"}`}>{puzzle.title}</h1>
              {puzzle.description ? <p className={`mt-3 max-w-2xl text-sm leading-6 sm:text-base ${barovia ? "text-[#bba8ae]" : "text-slate-400"}`}>{puzzle.description}</p> : null}
            </div>

            <div className={`min-w-[250px] rounded-2xl border p-4 ${barovia ? "border-[#4d2a35] bg-black/20" : "border-slate-800 bg-slate-950/45"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-xs font-bold uppercase tracking-[0.22em] ${barovia ? "text-[#8d6470]" : "text-slate-500"}`}>Live room</p>
                <span className={`text-xs font-semibold ${barovia ? "text-[#c59aa6]" : "text-cyan-300"}`}>{room.watchers.length} watching</span>
              </div>
              <div className="mt-3 flex -space-x-2">
                {room.watchers.slice(0, 8).map((watcher) => (
                  <span key={watcher.userId} title={`${watcher.name}${watcher.role === "dm" ? " · GM" : ""}`} className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-black ${barovia ? "border-[#130b10] bg-[#5a2838] text-[#f1d9df]" : "border-slate-950 bg-slate-700 text-slate-100"}`}>
                    {(watcher.name.trim()[0] ?? "?").toUpperCase()}
                  </span>
                ))}
                {room.watchers.length === 0 ? <span className="text-xs text-slate-600">Connecting to Presence…</span> : null}
              </div>
            </div>
          </div>
        </header>

        {run ? (
          <section className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className={`rounded-2xl border px-4 py-3 ${barovia ? "border-[#3e252e] bg-[#130d11]" : "border-slate-800 bg-slate-900/70"}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Moves</p>
              <p className="mt-1 text-xl font-black text-slate-100">
                {run.status === "solved" || run.status === "failed"
                  ? `${run.move_count} ${run.move_count === 1 ? "move" : "moves"} used`
                  : puzzle.move_limit == null
                    ? `${run.move_count} used · ∞`
                    : `${movesRemaining} / ${puzzle.move_limit} left`}
              </p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 ${barovia ? "border-[#3e252e] bg-[#130d11]" : "border-slate-800 bg-slate-900/70"}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Attempts</p>
              <p className="mt-1 text-xl font-black text-slate-100">
                {run.status === "solved" || run.status === "failed"
                  ? `${run.attempt_count} used`
                  : puzzle.attempt_limit == null
                    ? `${run.attempt_count} used · ∞`
                    : `${attemptsRemaining} / ${puzzle.attempt_limit} left`}
              </p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 ${barovia ? "border-[#3e252e] bg-[#130d11]" : "border-slate-800 bg-slate-900/70"}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Time</p>
              <p className={`mt-1 text-xl font-black ${deadlineMs != null && deadlineMs < 60_000 ? "text-rose-300" : "text-slate-100"}`}>{deadlineMs == null ? "No timer" : formatCountdown(deadlineMs)}</p>
            </div>
          </section>
        ) : null}

        {run?.status === "solved" ? (
          <div className="mt-5 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-7 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-300">Puzzle solved</p>
            <h2 className="mt-3 text-3xl font-black text-emerald-100">The mechanism yields.</h2>
            <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-emerald-400/25 bg-black/10 px-4 py-2 text-sm font-bold text-emerald-100">
                {run.solved_by_name ? `Solved by ${run.solved_by_name}` : "Solver unknown"}
              </span>
              <span className="rounded-full border border-emerald-400/25 bg-black/10 px-4 py-2 text-sm font-bold text-emerald-100">
                {run.move_count} {run.move_count === 1 ? "move" : "moves"}
              </span>
              {run.solved_at ? (
                <span className="rounded-full border border-emerald-400/25 bg-black/10 px-4 py-2 text-sm text-emerald-100/75">
                  {new Date(run.solved_at).toLocaleString()}
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-sm text-emerald-100/65">The final state remains visible to everyone until the Game Master removes this puzzle.</p>
          </div>
        ) : run?.status === "failed" ? (
          <div className="mt-5 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-7 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-rose-300">Puzzle failed</p>
            <h2 className="mt-3 text-3xl font-black text-rose-100">The opportunity is lost.</h2>
            {puzzle.failure_message ? <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-rose-100/70">{puzzle.failure_message}</p> : null}
          </div>
        ) : null}

        {run ? (
          <section className={`mt-5 rounded-[30px] border p-4 sm:p-6 ${barovia ? "border-[#452833] bg-[#100a0e]" : "border-slate-800 bg-slate-900/65"}`}>
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-black/15 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {room.hasControl ? (
                  <>
                    <p className="font-bold text-emerald-300">You have control</p>
                    <p className="mt-1 text-xs text-slate-500">Your moves are persisted and mirrored to every spectator.</p>
                  </>
                ) : run.controller_user_id && !controllerExpired ? (
                  <>
                    <p className="font-bold text-cyan-200">{run.controller_name ?? "Another player"} is solving</p>
                    <p className="mt-1 text-xs text-slate-500">Watch the board update live. Control releases automatically if they disconnect.</p>
                  </>
                ) : active ? (
                  <>
                    <p className="font-bold text-yellow-200">The mechanism is unattended</p>
                    <p className="mt-1 text-xs text-slate-500">Take control when you are ready to manipulate it.</p>
                  </>
                ) : (
                  <p className="font-bold text-slate-400">This run is finished.</p>
                )}
                {preview ? <p className="mt-2 text-xs font-semibold text-fuchsia-300/80">● {preview}</p> : null}
              </div>
              <div className="flex gap-2">
                {room.hasControl ? (
                  <button type="button" disabled={room.busy} onClick={() => void room.releaseControl()} className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 disabled:opacity-40">Release control</button>
                ) : active ? (
                  <button type="button" disabled={room.busy || !mayTakeControl} onClick={() => void room.takeControl()} className={`min-h-11 rounded-xl px-5 text-sm font-black disabled:opacity-35 ${barovia ? "bg-[#77263b] text-[#f7e6ea]" : "bg-yellow-500 text-slate-950"}`}>
                    {role === "dm" && run.controller_user_id && !controllerExpired ? "Take over" : "Take control"}
                  </button>
                ) : null}
              </div>
            </div>

            <PuzzleEngine
              puzzle={puzzle}
              run={run}
              disabled={!room.hasControl || room.busy || run.status !== "active"}
              onAction={room.applyAction}
              onRevealSequence={room.revealSequence}
            />
          </section>
        ) : (
          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-7 text-center">
            <p className="text-slate-400">This puzzle has no active run yet.</p>
            {role === "dm" ? <Link href={workshopHref} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-yellow-500 px-5 font-black text-slate-950">Open Puzzle Workshop</Link> : null}
          </div>
        )}

        {room.error ? <p className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{room.error}</p> : null}
      </div>
    </main>
  );
}
