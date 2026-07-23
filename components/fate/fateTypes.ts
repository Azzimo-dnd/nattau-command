export type FateRole = "dm" | "player";

export type FateProfile = {
  id: string;
  display_name: string;
  role: FateRole;
};

export type FateCycle = {
  id: string;
  cycle_number: number;
  title: string;
  is_active: boolean;
  started_at: string;
  closed_at: string | null;
  started_by: string | null;
};

export type FateCardDefinition = {
  id: number;
  arcana_number: number;
  roman_numeral: string;
  slug: string;
  name: string;
  short_meaning: string;
  upright_reward_title: string;
  upright_reward_description: string;
  reversed_reward_title: string;
  reversed_reward_description: string;
  mock_symbol: string;
  mock_theme: string;
  is_active: boolean;
  is_ready: boolean;
};

export type FateDraw = {
  id: string;
  cycle_id: string;
  player_id: string;
  card_id: number;
  is_reversed: boolean;
  selected_slot: number;
  card_slug_snapshot: string;
  card_name_snapshot: string;
  arcana_number_snapshot: number;
  roman_numeral_snapshot: string;
  short_meaning_snapshot: string;
  mock_symbol_snapshot: string;
  mock_theme_snapshot: string;
  reward_title_snapshot: string;
  reward_description_snapshot: string;
  drawn_at: string;
};

export type FateDrawView = FateDraw & {
  cycle_number: number;
  cycle_title: string;
};

export type FateAdminDraw = FateDrawView & {
  player_name: string;
};

export type FateOffer = {
  offer_id: string;
  cycle_id: string;
  expires_at: string;
};

export type FateClaimResult = {
  draw_id: string;
  cycle_id: string;
  card_id: number;
  is_reversed: boolean;
  selected_slot: number;
  card_slug: string;
  card_name: string;
  arcana_number: number;
  roman_numeral: string;
  short_meaning: string;
  mock_symbol: string;
  mock_theme: string;
  reward_title: string;
  reward_description: string;
  drawn_at: string;
};
