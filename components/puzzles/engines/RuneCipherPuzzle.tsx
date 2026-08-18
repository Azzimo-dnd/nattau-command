"use client";

import { useMemo, useState } from "react";
import type { CampaignPuzzleRow, CampaignPuzzleRunRow, JsonRecord } from "@/lib/puzzles/puzzleTypes";
import { getNattauRuneDefinition } from "@/lib/puzzles/nattauRunes";

function RuneBadge({
  rune,
  className = "",
  compact = false,
}: {
  rune: string | undefined;
  className?: string;
  compact?: boolean;
}) {
  if (!rune) {
    return (
      <span className={`flex h-full w-full items-center justify-center rounded-2xl border border-yellow-700/25 bg-black/10 text-2xl text-yellow-100/30 ${className}`}>
        ·
      </span>
    );
  }

  const definition = getNattauRuneDefinition(rune);
  if (!definition) {
    return (
      <span className={`flex h-full w-full items-center justify-center text-3xl font-black text-yellow-100 ${className}`}>
        {rune}
      </span>
    );
  }

  return (
    <span className={`flex h-full w-full flex-col items-center justify-center ${className}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-yellow-400/20 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.16),rgba(120,53,15,0.08)_60%,transparent_80%)] sm:h-12 sm:w-12">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8 text-yellow-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.22)] sm:h-9 sm:w-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {definition.paths.map((path) => (
            <path key={path} d={path} />
          ))}
        </svg>
      </span>
      {!compact ? (
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-200/70 sm:text-[11px]">
          {definition.label}
        </span>
      ) : null}
    </span>
  );
}

export function RuneCipherPuzzle({
  puzzle,
  run,
  disabled,
  onAction,
}: {
  puzzle: CampaignPuzzleRow;
  run: CampaignPuzzleRunRow;
  disabled: boolean;
  onAction: (action: JsonRecord) => Promise<unknown>;
}) {
  const runes = Array.isArray(puzzle.public_config.runes)
    ? puzzle.public_config.runes.filter((value): value is string => typeof value === "string")
    : [];
  const length = Number(puzzle.public_config.code_length ?? 4);
  const allowRepeats = puzzle.public_config.allow_repeats !== false;
  const [guess, setGuess] = useState<string[]>([]);
  const guesses = useMemo(() => {
    const raw = run.state.guesses;
    return Array.isArray(raw) ? (raw as Array<{ guess?: string[]; exact?: number; misplaced?: number }>) : [];
  }, [run.state.guesses]);

  const addRune = (rune: string) => {
    if (disabled || guess.length >= length) return;
    setGuess((current) => [...current, rune]);
  };

  const submit = async () => {
    if (guess.length !== length || disabled) return;
    const result = await onAction({ type: "cipher_guess", guess });
    if (result) setGuess([]);
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-[linear-gradient(180deg,rgba(24,16,6,0.96),rgba(8,9,13,0.94))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-500/90">Current inscription</p>
            <p className="mt-1 text-sm text-yellow-100/55">Arrange the island glyphs in the forgotten order of Nattau.</p>
          </div>
          <div className="hidden rounded-full border border-yellow-500/20 bg-yellow-500/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-200/70 sm:block">
            Seal of the Forgotten Tongue
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${length}, minmax(0,1fr))` }}>
          {Array.from({ length }, (_, index) => {
            const filled = index < guess.length;
            return (
              <button
                key={index}
                type="button"
                disabled={disabled || !filled}
                onClick={() => filled && setGuess((current) => current.filter((_, i) => i !== index))}
                className={`flex aspect-square min-h-20 items-center justify-center rounded-2xl border p-2 transition disabled:opacity-100 ${
                  filled
                    ? "border-yellow-400/30 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),rgba(120,53,15,0.05)_58%,rgba(0,0,0,0.2))]"
                    : "border-yellow-800/25 bg-black/15"
                }`}
              >
                <RuneBadge rune={guess[index]} compact className="h-full w-full" />
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-4">
          {runes.map((rune) => (
            <button
              key={rune}
              type="button"
              disabled={disabled || guess.length >= length || (!allowRepeats && guess.includes(rune))}
              onClick={() => addRune(rune)}
              className="min-h-24 rounded-2xl border border-slate-700/70 bg-[linear-gradient(180deg,rgba(11,15,24,0.92),rgba(5,9,14,0.98))] p-2 text-slate-100 transition hover:border-yellow-500/70 hover:bg-[linear-gradient(180deg,rgba(46,29,10,0.8),rgba(12,9,12,0.98))] disabled:opacity-40"
            >
              <RuneBadge rune={rune} className="h-full w-full" />
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" disabled={disabled || guess.length === 0} onClick={() => setGuess([])} className="min-h-11 flex-1 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 disabled:opacity-40">Clear</button>
          <button type="button" disabled={disabled || guess.length !== length} onClick={() => void submit()} className="min-h-11 flex-[2] rounded-xl bg-yellow-500 px-4 font-black text-slate-950 disabled:opacity-40">Test the runes</button>
        </div>
      </div>

      {guesses.length > 0 && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Previous attempts</p>
          <div className="mt-3 space-y-2">
            {[...guesses].reverse().map((entry, index) => (
              <div key={`${index}-${entry.guess?.join("")}`} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-flow-col auto-cols-max gap-2">
                  {(entry.guess ?? []).map((rune, runeIndex) => (
                    <div key={`${index}-${runeIndex}-${rune}`} className="flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-600/15 bg-yellow-500/5 p-1.5">
                      <RuneBadge rune={rune} compact className="h-full w-full" />
                    </div>
                  ))}
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  <strong className="text-emerald-300">{entry.exact ?? 0} exact</strong>
                  <span className="mx-2">·</span>
                  <strong className="text-yellow-300">{entry.misplaced ?? 0} misplaced</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
