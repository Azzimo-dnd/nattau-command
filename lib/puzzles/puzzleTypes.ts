export type PuzzleType =
  | "rune_cipher"
  | "sliding_lock"
  | "shattered_sigil"
  | "arcane_circuit"
  | "rune_sequence";

export type PuzzleLifecycleStatus =
  | "draft"
  | "active"
  | "solved"
  | "failed"
  | "archived";

export type PuzzleRunStatus =
  | "active"
  | "solved"
  | "failed"
  | "superseded";

export type PuzzleTheme = "nattau" | "barovia";

export type JsonRecord = Record<string, unknown>;

export type CampaignPuzzleRow = {
  id: string;
  campaign_id: string;
  title: string;
  description: string;
  puzzle_type: PuzzleType;
  difficulty_label: string;
  public_config: JsonRecord;
  move_limit: number | null;
  attempt_limit: number | null;
  time_limit_seconds: number | null;
  failure_message: string | null;
  is_visible: boolean;
  status: PuzzleLifecycleStatus;
  current_run_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CampaignPuzzleRunRow = {
  id: string;
  puzzle_id: string;
  campaign_id: string;
  status: PuzzleRunStatus;
  state: JsonRecord;
  move_count: number;
  attempt_count: number;
  started_at: string;
  deadline_at: string | null;
  solved_at: string | null;
  failed_at: string | null;
  solved_by_user_id: string | null;
  solved_by_name: string | null;
  controller_user_id: string | null;
  controller_name: string | null;
  control_expires_at: string | null;
  version: number;
  updated_at: string;
};

export type CampaignPuzzleMoveRow = {
  id: number;
  run_id: string;
  puzzle_id: string;
  campaign_id: string;
  actor_id: string;
  move_number: number;
  action: JsonRecord;
  created_at: string;
};

export type PuzzlePresence = {
  userId: string;
  name: string;
  role: "dm" | "player";
  onlineAt: string;
};

export type PuzzlePreset = {
  title: string;
  description: string;
  difficultyLabel: string;
  moveLimit: number | null;
  attemptLimit: number | null;
  timeLimitSeconds: number | null;
  failureMessage: string;
  publicConfig: JsonRecord;
  secretConfig: JsonRecord;
};

export const PUZZLE_TYPE_LABELS: Record<PuzzleType, string> = {
  rune_cipher: "Rune Cipher",
  sliding_lock: "Sliding Lock",
  shattered_sigil: "Shattered Sigil",
  arcane_circuit: "Arcane Circuit",
  rune_sequence: "Rune Sequence",
};
