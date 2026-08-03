export type RollVisibility = "campaign" | "private";

export type CampaignDiceRollRow = {
  id: string;
  campaign_id: string;
  user_id: string;
  roller_name: string;
  system_key: string;
  roll_kind: string;
  title: string;
  expression: string | null;
  total: number | null;
  outcome: string | null;
  visibility: RollVisibility;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type NewCampaignDiceRoll = {
  roll_kind: string;
  title: string;
  expression?: string | null;
  total?: number | null;
  outcome?: string | null;
  visibility: RollVisibility;
  details?: Record<string, unknown>;
};

export type DiceAppRole = "dm" | "player";
