export type DaggerheartCompendiumCategory =
  | "class"
  | "subclass"
  | "ancestry"
  | "community"
  | "transformation"
  | "domain_card"
  | "beastform"
  | "martial_stance"
  | "weapon_primary"
  | "weapon_secondary"
  | "armor"
  | "loot_item"
  | "consumable";

export type DaggerheartCompendiumEntry = {
  id: string;
  source_key: "core" | "hope-fear";
  category: DaggerheartCompendiumCategory;
  slug: string;
  name: string;
  parent_slug: string | null;
  domain: string | null;
  level: number | null;
  tier: number | null;
  summary: string;
  rules_text: string;
  metadata: Record<string, unknown>;
  source_page_start: number | null;
  source_page_end: number | null;
  sort_order: number;
};

export const daggerheartCompendiumCategories: {
  key: DaggerheartCompendiumCategory;
  label: string;
}[] = [
  { key: "domain_card", label: "Domain Cards" },
  { key: "class", label: "Classes" },
  { key: "subclass", label: "Subclasses" },
  { key: "ancestry", label: "Ancestries" },
  { key: "community", label: "Communities" },
  { key: "transformation", label: "Transformations" },
  { key: "beastform", label: "Beastforms" },
  { key: "martial_stance", label: "Martial Stances" },
  { key: "weapon_primary", label: "Primary Weapons" },
  { key: "weapon_secondary", label: "Secondary Weapons" },
  { key: "armor", label: "Armor" },
  { key: "loot_item", label: "Loot Items" },
  { key: "consumable", label: "Consumables" },
];

export const metadataLabels: Record<string, string> = {
  card_type: "Type",
  recall_cost: "Recall",
  trait: "Trait",
  trait_bonus: "Trait bonus",
  attack_trait: "Attack",
  range: "Range",
  damage: "Damage",
  damage_type: "Damage type",
  burden: "Burden",
  weapon_kind: "Kind",
  base_major: "Major",
  base_severe: "Severe",
  base_score: "Armor score",
  examples: "Examples",
  advantages: "Advantages",
  roll: "Roll",
};

export function compendiumCategoryLabel(category: string) {
  return (
    daggerheartCompendiumCategories.find((item) => item.key === category)?.label ??
    category.replaceAll("_", " ")
  );
}

export function compendiumSourceLabel(source: string) {
  return source === "hope-fear" ? "Hope & Fear" : "Core Rulebook";
}
