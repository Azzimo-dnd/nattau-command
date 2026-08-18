"use client";

import { useMemo, useState } from "react";
import type { CampaignPuzzleRow, CampaignPuzzleRunRow, JsonRecord } from "@/lib/puzzles/puzzleTypes";

export function RuneSequencePuzzle({ puzzle, run, disabled, onAction, onReveal }: {
  puzzle: CampaignPuzzleRow;
  run: CampaignPuzzleRunRow;
  disabled: boolean;
  onAction: (action: JsonRecord) => Promise<unknown>;
  onReveal: () => Promise<string[] | null>;
}) {
  const runes = Array.isArray(puzzle.public_config.runes) ? puzzle.public_config.runes as string[] : [];
  const level = Number(run.state.level ?? 1);
  const baseLength = Number(puzzle.public_config.base_length ?? 3);
  const maxLevel = Number(puzzle.public_config.max_level ?? 5);
  const needed = baseLength + level - 1;
  const flashMs = Number(puzzle.public_config.flash_ms ?? 650);
  const revealLimit = puzzle.public_config.reveal_limit == null ? null : Number(puzzle.public_config.reveal_limit);
  const revealsUsed = Number(run.state.reveals ?? 0);
  const revealsLeft = revealLimit == null ? null : Math.max(0, revealLimit - revealsUsed);
  const [input, setInput] = useState<string[]>([]);
  const [showing, setShowing] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const feedback = useMemo(() => typeof run.state.last_feedback === "string" ? run.state.last_feedback : null, [run.state.last_feedback]);

  const reveal = async () => {
    if (disabled || showing) return;
    const sequence = await onReveal();
    if (!sequence) return;
    setInput([]);
    setShowing(true);
    for (const rune of sequence) {
      setLit(rune);
      await new Promise((resolve) => window.setTimeout(resolve, flashMs));
      setLit(null);
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(120, Math.floor(flashMs * 0.32))));
    }
    setShowing(false);
  };

  const submit = async () => {
    if (disabled || input.length !== needed) return;
    const result = await onAction({ type: "sequence_submit", sequence: input });
    if (result) setInput([]);
  };

  return (
    <div className="mx-auto max-w-[680px] space-y-4">
      <div className="rounded-[30px] border border-violet-500/25 bg-[radial-gradient(circle_at_center,#2b1740_0%,#0d0713_68%)] p-6 text-center shadow-2xl shadow-violet-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.28em] text-violet-300/70">Echo {level} / {maxLevel}</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/50">Echoes left: {revealsLeft ?? "∞"}</p></div>
        <div className="mt-5 flex min-h-32 items-center justify-center rounded-2xl border border-violet-400/15 bg-black/20">
          <span className={`text-7xl font-black transition ${lit ? "scale-110 text-violet-100 drop-shadow-[0_0_18px_rgba(196,181,253,0.9)]" : "text-violet-950"}`}>{lit ?? "✦"}</span>
        </div>
        <button type="button" disabled={disabled || showing || revealsLeft === 0} onClick={() => void reveal()} className="mt-4 min-h-11 w-full rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 font-bold text-violet-100 disabled:opacity-40">{showing ? "The runes are speaking…" : `Reveal ${needed}-rune sequence`}</button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex min-h-14 flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2">
          {Array.from({ length: needed }, (_, index) => <span key={index} className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 text-2xl text-violet-100">{input[index] ?? "·"}</span>)}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {runes.map((rune) => <button key={rune} type="button" disabled={disabled || showing || input.length >= needed} onClick={() => setInput((current) => [...current, rune])} className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 text-2xl text-slate-100 disabled:opacity-35">{rune}</button>)}
        </div>
        <div className="mt-3 flex gap-2"><button type="button" disabled={disabled || input.length === 0} onClick={() => setInput([])} className="min-h-11 flex-1 rounded-xl border border-slate-700 text-slate-300 disabled:opacity-30">Clear</button><button type="button" disabled={disabled || showing || input.length !== needed} onClick={() => void submit()} className="min-h-11 flex-[2] rounded-xl bg-violet-500 font-black text-white disabled:opacity-35">Repeat the echo</button></div>
        {feedback ? <p className={`mt-3 rounded-xl px-4 py-3 text-sm font-semibold ${feedback === "correct" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{feedback === "correct" ? "The stone accepts the sequence." : "The echo fractures. Try to remember."}</p> : null}
      </div>
    </div>
  );
}
