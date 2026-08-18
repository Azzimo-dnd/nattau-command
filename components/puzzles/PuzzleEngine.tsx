"use client";

import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
} from "@/lib/puzzles/puzzleTypes";
import { PuzzleFocusFrame } from "./PuzzleFocusFrame";
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
  let engine;

  switch (puzzle.puzzle_type) {
    case "rune_cipher":
      engine = (
        <RuneCipherPuzzle puzzle={puzzle} run={run} disabled={disabled} onAction={onAction} />
      );
      break;
    case "sliding_lock":
      engine = (
        <SlidingLockPuzzle puzzle={puzzle} run={run} disabled={disabled} onAction={onAction} />
      );
      break;
    case "shattered_sigil":
      engine = (
        <ShatteredSigilPuzzle puzzle={puzzle} run={run} disabled={disabled} onAction={onAction} />
      );
      break;
    case "arcane_circuit":
      engine = (
        <ArcaneCircuitPuzzle puzzle={puzzle} run={run} disabled={disabled} onAction={onAction} />
      );
      break;
    case "rune_sequence":
      engine = (
        <RuneSequencePuzzle
          puzzle={puzzle}
          run={run}
          disabled={disabled}
          onAction={onAction}
          onReveal={onRevealSequence}
        />
      );
      break;
    default:
      engine = (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
          This puzzle type is not supported by this client.
        </div>
      );
  }

  const movesLabel =
    run.status === "solved" || run.status === "failed"
      ? `${run.move_count} used`
      : puzzle.move_limit == null
        ? `${run.move_count} used · ∞`
        : `${Math.max(0, puzzle.move_limit - run.move_count)} moves left`;

  return (
    <PuzzleFocusFrame title={puzzle.title} status={run.status} movesLabel={movesLabel}>
      {engine}
    </PuzzleFocusFrame>
  );
}
