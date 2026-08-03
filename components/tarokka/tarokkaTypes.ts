import type { AppRole } from "@/components/navigation/navigationTypes";

export type TarokkaRole = AppRole;

export type TarokkaCycle = {
  id: string;
  campaign_id: string;
  cycle_number: number;
  title: string;
  is_active: boolean;
  started_at: string;
  closed_at: string | null;
};

export type TarokkaDraw = {
  id: string;
  campaign_id: string;
  cycle_id: string;
  player_id: string;
  card_id: number | null;
  is_reversed: boolean;
  selected_slot: number;
  card_slug_snapshot: string;
  card_number_snapshot: string;
  card_name_snapshot: string;
  subtitle_snapshot: string;
  meaning_snapshot: string;
  sigil_snapshot: string;
  art_key_snapshot: string;
  effect_title_snapshot: string;
  effect_description_snapshot: string;
  drawn_at: string;
  revealed_at: string | null;
};

export type TarokkaClaimResult = {
  draw_id: string;
  cycle_id: string;
  card_id: number | null;
  is_reversed: boolean;
  selected_slot: number;
  card_slug: string;
  card_number: string;
  card_name: string;
  subtitle: string;
  meaning: string;
  sigil: string;
  art_key: string;
  effect_title: string;
  effect_description: string;
  drawn_at: string;
  revealed_at: string | null;
};

export type TarokkaOffer = {
  offer_id: string;
  cycle_id: string;
  expires_at: string;
};

export type TarokkaProgressRow = {
  player_id: string;
  display_name: string;
  counts_toward_progress: boolean;
  draw_id: string | null;
  drawn_at: string | null;
  revealed_at: string | null;
  card_name: string | null;
  is_reversed: boolean | null;
};

export type TarokkaReading = {
  id: string;
  campaign_id: string;
  cycle_id: string | null;
  title: string;
  status: "draft" | "revealing" | "complete";
  created_by: string | null;
  created_at: string;
  opened_at: string | null;
  completed_at: string | null;
};

export type TarokkaReadingPosition = {
  id: string;
  campaign_id: string;
  reading_id: string;
  position_index: number;
  position_key: string;
  position_label: string;
  position_prompt: string;
  card_id: number | null;
  is_reversed: boolean;
  card_slug_snapshot: string;
  card_number_snapshot: string;
  card_name_snapshot: string;
  subtitle_snapshot: string;
  meaning_snapshot: string;
  sigil_snapshot: string;
  art_key_snapshot: string;
  effect_title_snapshot: string;
  effect_description_snapshot: string;
  revealed_at: string | null;
};

export type TarokkaTab = "omen" | "reading" | "history" | "gm";

export type TarokkaCardView = {
  number: string;
  name: string;
  subtitle: string;
  meaning: string;
  sigil: string;
  artKey: string;
  effectTitle: string;
  effectDescription: string;
  isReversed: boolean;
};

export function drawToCardView(draw: TarokkaDraw): TarokkaCardView {
  return {
    number: draw.card_number_snapshot,
    name: draw.card_name_snapshot,
    subtitle: draw.subtitle_snapshot,
    meaning: draw.meaning_snapshot,
    sigil: draw.sigil_snapshot,
    artKey: draw.art_key_snapshot,
    effectTitle: draw.effect_title_snapshot,
    effectDescription: draw.effect_description_snapshot,
    isReversed: draw.is_reversed,
  };
}

export function positionToCardView(
  position: TarokkaReadingPosition
): TarokkaCardView {
  return {
    number: position.card_number_snapshot,
    name: position.card_name_snapshot,
    subtitle: position.subtitle_snapshot,
    meaning: position.meaning_snapshot,
    sigil: position.sigil_snapshot,
    artKey: position.art_key_snapshot,
    effectTitle: position.effect_title_snapshot,
    effectDescription: position.effect_description_snapshot,
    isReversed: position.is_reversed,
  };
}
