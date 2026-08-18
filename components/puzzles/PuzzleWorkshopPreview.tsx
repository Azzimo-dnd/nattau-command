"use client";

import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
  PuzzleType,
} from "@/lib/puzzles/puzzleTypes";
import { RuneCipherPuzzle } from "./engines/RuneCipherPuzzle";
import { SlidingLockPuzzle } from "./engines/SlidingLockPuzzle";
import { ShatteredSigilPuzzle } from "./engines/ShatteredSigilPuzzle";
import { ArcaneCircuitPuzzle } from "./engines/ArcaneCircuitPuzzle";
import { RuneSequencePuzzle } from "./engines/RuneSequencePuzzle";

type Props = {
  type: PuzzleType;
  title: string;
  difficultyLabel: string;
  publicConfig: JsonRecord;
  moveLimit: number | null;
  attemptLimit: number | null;
  timeLimitSeconds: number | null;
};

const PREVIEW_DATE = "2000-01-01T00:00:00.000Z";

function previewState(type: PuzzleType, publicConfig: JsonRecord): JsonRecord {
  switch (type) {
    case "sliding_lock":
      return {
        blocks: Array.isArray(publicConfig.blocks) ? publicConfig.blocks : [],
      };
    case "shattered_sigil":
      return {
        order: Array.isArray(publicConfig.initial_order)
          ? publicConfig.initial_order
          : [],
      };
    case "arcane_circuit":
      return {
        rotations: Array.isArray(publicConfig.initial_rotations)
          ? publicConfig.initial_rotations
          : [],
      };
    case "rune_sequence":
      return {
        level: 1,
        reveals: 0,
        last_feedback: null,
      };
    case "rune_cipher":
    default:
      return { guesses: [] };
  }
}

function makePreviewPuzzle({
  type,
  title,
  difficultyLabel,
  publicConfig,
  moveLimit,
  attemptLimit,
  timeLimitSeconds,
}: Props): CampaignPuzzleRow {
  return {
    id: "workshop-preview-puzzle",
    campaign_id: "workshop-preview-campaign",
    title: title || "Puzzle preview",
    description: "",
    puzzle_type: type,
    difficulty_label: difficultyLabel,
    public_config: publicConfig,
    move_limit: moveLimit,
    attempt_limit: attemptLimit,
    time_limit_seconds: timeLimitSeconds,
    failure_message: null,
    is_visible: false,
    status: "draft",
    current_run_id: "workshop-preview-run",
    sort_order: 0,
    created_at: PREVIEW_DATE,
    updated_at: PREVIEW_DATE,
  };
}

function makePreviewRun(type: PuzzleType, publicConfig: JsonRecord): CampaignPuzzleRunRow {
  return {
    id: "workshop-preview-run",
    puzzle_id: "workshop-preview-puzzle",
    campaign_id: "workshop-preview-campaign",
    status: "active",
    state: previewState(type, publicConfig),
    move_count: 0,
    attempt_count: 0,
    started_at: PREVIEW_DATE,
    deadline_at: null,
    solved_at: null,
    failed_at: null,
    solved_by_user_id: null,
    solved_by_name: null,
    controller_user_id: null,
    controller_name: null,
    control_expires_at: null,
    version: 1,
    updated_at: PREVIEW_DATE,
  };
}

const noAction = async (_action: JsonRecord) => null;
const noReveal = async () => null;

export function PuzzleWorkshopPreview(props: Props) {
  const puzzle = makePreviewPuzzle(props);
  const run = makePreviewRun(props.type, props.publicConfig);

  let engine;
  switch (props.type) {
    case "rune_cipher":
      engine = (
        <RuneCipherPuzzle
          puzzle={puzzle}
          run={run}
          disabled
          onAction={noAction}
        />
      );
      break;
    case "sliding_lock":
      engine = (
        <SlidingLockPuzzle
          puzzle={puzzle}
          run={run}
          disabled
          onAction={noAction}
        />
      );
      break;
    case "shattered_sigil":
      engine = (
        <ShatteredSigilPuzzle
          puzzle={puzzle}
          run={run}
          disabled
          onAction={noAction}
        />
      );
      break;
    case "arcane_circuit":
      engine = (
        <ArcaneCircuitPuzzle
          puzzle={puzzle}
          run={run}
          disabled
          onAction={noAction}
        />
      );
      break;
    case "rune_sequence":
      engine = (
        <RuneSequencePuzzle
          puzzle={puzzle}
          run={run}
          disabled
          onAction={noAction}
          onReveal={noReveal}
        />
      );
      break;
  }

  return (
    <div className="puzzle-workshop-preview pointer-events-none select-none">
      {engine}
      <style jsx global>{`
        .puzzle-workshop-preview button:disabled {
          opacity: 1 !important;
          cursor: default !important;
        }
      `}</style>
    </div>
  );
}
