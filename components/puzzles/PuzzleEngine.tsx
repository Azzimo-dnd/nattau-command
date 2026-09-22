"use client";

import styles from "./PuzzleAtmosphere.module.css";
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

  const effectiveMoveLimit = run.move_limit_override ?? puzzle.move_limit;
  const movesLabel =
    run.status === "solved" || run.status === "failed"
      ? `${run.move_count} used`
      : effectiveMoveLimit == null
        ? `${run.move_count} used · ∞`
        : `${Math.max(0, effectiveMoveLimit - run.move_count)} moves left`;

  return (
    <PuzzleFocusFrame theme={String(puzzle.public_config.campaign_theme ?? "nattau")} title={puzzle.title} status={run.status} movesLabel={movesLabel}>
      <div className={styles.invocation}>
        <p className={styles.seal}>{puzzle.public_config.campaign_theme === "barovia" ? "A relic beyond the Mists" : "An artifact of the expedition"}</p>
        <p className="mt-2">{run.status === "solved" ? String(puzzle.public_config.success_message ?? "The mechanism yields.") : run.status === "failed" ? puzzle.failure_message : puzzle.description}</p>
      </div>
      {engine}
    </PuzzleFocusFrame>
  );
}
