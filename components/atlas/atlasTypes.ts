export type AtlasRole = "dm" | "player";

export type AtlasVisibility =
  | "hidden"
  | "rumored"
  | "discovered"
  | "visited";

export type AtlasLocationCategory =
  | "settlement"
  | "castle"
  | "ruin"
  | "landmark"
  | "shrine"
  | "wilderness"
  | "danger"
  | "gate"
  | "custom";

export type AtlasLocation = {
  id: string;
  campaign_id: string;
  slug: string;
  name: string;
  rumor_name: string | null;
  category: AtlasLocationCategory;
  visibility_status: AtlasVisibility;
  x_percent: number;
  y_percent: number;
  player_summary: string;
  rumor_summary: string;
  gm_notes: string;
  icon_key: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AtlasLocationDraft = {
  name: string;
  rumor_name: string;
  category: AtlasLocationCategory;
  visibility_status: AtlasVisibility;
  x_percent: number;
  y_percent: number;
  player_summary: string;
  rumor_summary: string;
  gm_notes: string;
  icon_key: string;
  sort_order: number;
  is_active: boolean;
};

export type AtlasFilter = "all" | AtlasVisibility;

export const atlasCategories: Array<{
  value: AtlasLocationCategory;
  label: string;
  mark: string;
}> = [
  { value: "settlement", label: "Settlement", mark: "⌂" },
  { value: "castle", label: "Castle", mark: "♜" },
  { value: "ruin", label: "Ruins", mark: "✦" },
  { value: "landmark", label: "Landmark", mark: "◆" },
  { value: "shrine", label: "Shrine", mark: "†" },
  { value: "wilderness", label: "Wilderness", mark: "♧" },
  { value: "danger", label: "Danger", mark: "!" },
  { value: "gate", label: "Gate", mark: "↟" },
  { value: "custom", label: "Custom", mark: "●" },
];

export const atlasVisibilityOptions: Array<{
  value: AtlasVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "hidden",
    label: "Hidden",
    description: "Visible only to the Game Master.",
  },
  {
    value: "rumored",
    label: "Rumored",
    description: "Players see a vague marker and rumor text.",
  },
  {
    value: "discovered",
    label: "Discovered",
    description: "Players see the true name and public description.",
  },
  {
    value: "visited",
    label: "Visited",
    description: "Marked as known and already reached by the party.",
  },
];

export function categoryMark(category: AtlasLocationCategory) {
  return atlasCategories.find((item) => item.value === category)?.mark ?? "●";
}

export function categoryLabel(category: AtlasLocationCategory) {
  return atlasCategories.find((item) => item.value === category)?.label ?? "Location";
}

export function visibilityLabel(visibility: AtlasVisibility) {
  return (
    atlasVisibilityOptions.find((item) => item.value === visibility)?.label ??
    visibility
  );
}

export function createDraft(location?: AtlasLocation | null): AtlasLocationDraft {
  return {
    name: location?.name ?? "New location",
    rumor_name: location?.rumor_name ?? "Whisper in the Mists",
    category: location?.category ?? "custom",
    visibility_status: location?.visibility_status ?? "hidden",
    x_percent: Number(location?.x_percent ?? 50),
    y_percent: Number(location?.y_percent ?? 50),
    player_summary: location?.player_summary ?? "",
    rumor_summary: location?.rumor_summary ?? "",
    gm_notes: location?.gm_notes ?? "",
    icon_key: location?.icon_key ?? "",
    sort_order: location?.sort_order ?? 500,
    is_active: location?.is_active ?? true,
  };
}
