"use client";

import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
} from "@/lib/puzzles/puzzleTypes";
import { RuneCipherPuzzle } from "./engines/RuneCipherPuzzle";
import { SlidingLockPuzzle } from "./engines/SlidingLockPuzzle";
import { ShatteredSigilPuzzle } from "./engines/ShatteredSigilPuzzle";
import { ArcaneCircuitPuzzle } from "./engines/ArcaneCircuitPuzzle";
import { RuneSequencePuzzle } from "./engines/RuneSequencePuzzle";

type Props = {
  puzzle: CampaignPuzzleRow;
  run: CampaignPuzzleRunRow;
  disabled: boolean;
  onAction: (action: JsonRecord) => Promise<unknown>;
  onRevealSequence: () => Promise<string[] | null>;
};

export function PuzzleEngine({
  puzzle,
  run,
  disabled,
  onAction,
  onRevealSequence,
}: Props) {
  switch (puzzle.puzzle_type) {
    case "rune_cipher":
      return (
        <RuneCipherPuzzle
          puzzle={puzzle}
          run={run}
          disabled={disabled}
          onAction={onAction}
        />
      );
    case "sliding_lock":
      return (
        <SlidingLockPuzzle
          puzzle={puzzle}
          run={run}
          disabled={disabled}
          onAction={onAction}
        />
      );
    case "shattered_sigil":
      return (
        <ShatteredSigilPuzzle
          puzzle={puzzle}
          run={run}
          disabled={disabled}
          onAction={onAction}
        />
      );
    case "arcane_circuit":
      return (
        <ArcaneCircuitPuzzle
          puzzle={puzzle}
          run={run}
          disabled={disabled}
          onAction={onAction}
        />
      );
    case "rune_sequence":
      return (
        <RuneSequencePuzzle
          puzzle={puzzle}
          run={run}
          disabled={disabled}
          onAction={onAction}
          onReveal={onRevealSequence}
        />
      );
    default:
      return (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
          This puzzle type is not supported by this client.
        </div>
      );
  }
}
