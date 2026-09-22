"use client";

import { useMemo, useState } from "react";
import { getCampaignRuneDefinition } from "@/lib/puzzles/campaignRunes";
import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
} from "@/lib/puzzles/puzzleTypes";

function RuneMark({ rune, lit }: { rune: string; lit: boolean }) {
  const definition = getCampaignRuneDefinition(rune);

  if (!definition) {
    return (
      <span className={`text-3xl font-black ${lit ? "text-cyan-100" : "text-slate-600"}`}>
        {rune}
      </span>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-9 w-9 sm:h-11 sm:w-11 ${lit ? "text-cyan-100 drop-shadow-[0_0_10px_rgba(103,232,249,0.85)]" : "text-slate-600"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {definition.paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export function RunicResonancePuzzle({
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
  const size = Number(puzzle.public_config.size ?? 4);
  const glyphs = Array.isArray(puzzle.public_config.glyphs)
    ? puzzle.public_config.glyphs.map(String)
    : [];
  const effects = Array.isArray(puzzle.public_config.effects)
    ? puzzle.public_config.effects.map((value) =>
        Array.isArray(value) ? value.map(Number) : [],
      )
    : [];
  const locked = useMemo(
    () =>
      new Set(
        Array.isArray(puzzle.public_config.locked_indices)
          ? puzzle.public_config.locked_indices.map(Number)
          : [],
      ),
    [puzzle.public_config.locked_indices],
  );
  const lit = Array.isArray(run.state.lit)
    ? run.state.lit.map(Boolean)
    : Array.from({ length: size * size }, () => false);
  const [hovered, setHovered] = useState<number | null>(null);
  const affected = useMemo(
    () => new Set(hovered == null ? [] : effects[hovered] ?? []),
    [effects, hovered],
  );
  const litCount = lit.filter(Boolean).length;

  return (
    <div className="mx-auto max-w-[620px]">
      <div className="rounded-[30px] border border-cyan-700/25 bg-[radial-gradient(circle_at_center,rgba(8,47,73,0.28),rgba(4,12,20,0.98)_68%)] p-3 shadow-2xl shadow-cyan-950/40 sm:p-5">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${size},minmax(0,1fr))` }}
        >
          {Array.from({ length: size * size }, (_, index) => {
            const active = lit[index] ?? false;
            const sealed = locked.has(index);
            const preview = affected.has(index);

            return (
              <button
                key={index}
                type="button"
                disabled={disabled || sealed}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                onClick={() =>
                  void onAction({ type: "resonance_press", index })
                }
                aria-label={
                  sealed
                    ? `Sealed resonance rune ${index + 1}`
                    : `Touch resonance rune ${index + 1}`
                }
                className={`relative aspect-square overflow-hidden rounded-2xl border transition duration-150 ${active
                  ? "border-cyan-300/55 bg-cyan-400/12 shadow-[inset_0_0_24px_rgba(34,211,238,0.16),0_0_18px_rgba(34,211,238,0.12)]"
                  : "border-slate-800 bg-slate-950/55"
                } ${preview ? "ring-1 ring-inset ring-fuchsia-300/45" : ""} ${sealed
                  ? "cursor-default"
                  : "hover:border-fuchsia-400/45 active:scale-95"
                }`}
              >
                <span
                  className={`absolute inset-2 rounded-full transition ${active
                    ? "bg-[radial-gradient(circle,rgba(103,232,249,0.14),transparent_65%)]"
                    : ""
                  }`}
                />
                <span className="relative z-10 flex h-full w-full items-center justify-center">
                  <RuneMark
                    rune={glyphs[index] ?? glyphs[index % Math.max(1, glyphs.length)] ?? "✦"}
                    lit={active}
                  />
                </span>
                {sealed ? (
                  <span className="absolute bottom-1.5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-slate-600/40 bg-black/55 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                    sealed
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span>
          {litCount === 0 ? "All runes are silent." : `${litCount} runes still resonate.`}
        </span>
        <span>Touching a rune flips it and its orthogonal neighbours.</span>
        {locked.size > 0 ? (
          <span>Sealed runes cannot be touched, but they still resonate.</span>
        ) : null}
      </div>
    </div>
  );
}
