import { classOption } from "@/lib/daggerheart/catalog";

export const daggerheartEffectStats = [
  "agility",
  "strength",
  "finesse",
  "instinct",
  "presence",
  "knowledge",
  "evasion",
  "proficiency",
  "hope_max",
  "hp_max",
  "stress_max",
  "armor_score",
  "major_threshold",
  "severe_threshold",
] as const;

export type DaggerheartEffectStat = (typeof daggerheartEffectStats)[number];

export type DaggerheartEffectCondition =
  | { type: "wearing_armor" }
  | { type: "domain_count"; domain: string; minimum: number }
  | { type: "stress_full" };

export type DaggerheartEffect = {
  id: string;
  label: string;
  stat: DaggerheartEffectStat;
  operation: "add";
  value?: number;
  value_from?: "proficiency" | "presence" | "spellcast_trait" | "tier";
  scope: "equipped" | "loadout" | "owned";
  mode: "passive" | "toggle";
  condition?: DaggerheartEffectCondition;
  description?: string;
  duration?: string;
};

export type DaggerheartBaseStats = {
  evasion: number;
  proficiency: number;
  hope_max: number;
  hp_max: number;
  stress_max: number;
  armor_score: number;
  major_threshold: number;
  severe_threshold: number;
};

export type DaggerheartManualStatModifiers = Partial<
  Record<DaggerheartEffectStat, number>
>;

export type DaggerheartEffectState = {
  active_effect_ids?: string[];
};

export type DaggerheartEffectGearItem = {
  instance_id?: string;
  compendium_id?: string;
  slug?: string;
  name: string;
  category?: string;
  tier?: number | null;
  metadata?: Record<string, unknown>;
  effects?: DaggerheartEffect[];
  equipped?: boolean;
};

export type DaggerheartEffectDomainCard = {
  compendium_id?: string;
  slug?: string;
  name: string;
  domain: string;
  state: "loadout" | "vault";
  effects?: DaggerheartEffect[];
};

type HeritageFeature = { ancestry?: string; name?: string } | null | undefined;

export type DaggerheartEffectCharacter = {
  level: number;
  class_key: string | null;
  subclass_key: string | null;
  ancestry_key: string | null;
  heritage_state?: {
    mixed?: boolean;
    feature_one?: HeritageFeature;
    feature_two?: HeritageFeature;
  };
  traits: Record<string, number>;
  base_stats?: Partial<DaggerheartBaseStats>;
  manual_stat_modifiers?: DaggerheartManualStatModifiers;
  effect_state?: DaggerheartEffectState;
  weapons: DaggerheartEffectGearItem[];
  armor: DaggerheartEffectGearItem[];
  inventory: DaggerheartEffectGearItem[];
  domain_cards: DaggerheartEffectDomainCard[];
  stress_current: number;
  stress_max: number;
  evasion: number;
  proficiency: number;
  hope_max: number;
  hp_max: number;
  armor_score: number;
  major_threshold: number;
  severe_threshold: number;
};

export type DaggerheartEffectContribution = {
  stat: DaggerheartEffectStat;
  value: number;
  source: string;
  label: string;
  effect_key: string;
  temporary: boolean;
};

export type DaggerheartToggleEffect = {
  key: string;
  source: string;
  label: string;
  description?: string;
  duration?: string;
  stat: DaggerheartEffectStat;
  value: number;
  active: boolean;
};

export type DaggerheartDerivedStats = DaggerheartBaseStats &
  Record<"agility" | "strength" | "finesse" | "instinct" | "presence" | "knowledge", number> & {
    armor_slots_max: number;
  };

export type DaggerheartEffectResult = {
  stats: DaggerheartDerivedStats;
  breakdown: Partial<Record<DaggerheartEffectStat, DaggerheartEffectContribution[]>>;
  toggles: DaggerheartToggleEffect[];
  equippedArmor: DaggerheartEffectGearItem | null;
};

const traitKeys = [
  "agility",
  "strength",
  "finesse",
  "instinct",
  "presence",
  "knowledge",
] as const;

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function baseStatsForClass(
  classKey: string | null,
  proficiency = 1
): DaggerheartBaseStats {
  const option = classOption(classKey);
  return {
    evasion: option?.startingEvasion ?? 10,
    proficiency,
    hope_max: 6,
    hp_max: option?.startingHitPoints ?? 0,
    stress_max: 6,
    armor_score: 0,
    major_threshold: 0,
    severe_threshold: 0,
  };
}

export function spellcastTraitKey(
  character: Pick<DaggerheartEffectCharacter, "class_key" | "subclass_key">
) {
  switch (character.class_key) {
    case "bard":
      return "presence";
    case "druid":
      return "instinct";
    case "ranger":
      return "agility";
    case "rogue":
      return "finesse";
    case "seraph":
      return "strength";
    case "sorcerer":
      return "instinct";
    case "wizard":
      return "knowledge";
    case "assassin":
      return character.subclass_key === "poisoners-guild"
        ? "knowledge"
        : "agility";
    case "warlock":
      return "presence";
    case "witch":
      return character.subclass_key === "moon" ? "instinct" : "knowledge";
    default:
      return null;
  }
}

function hasAncestryFeature(
  character: DaggerheartEffectCharacter,
  ancestry: string,
  feature: string
) {
  if (character.heritage_state?.mixed) {
    return [
      character.heritage_state.feature_one,
      character.heritage_state.feature_two,
    ].some(
      (item) => item?.ancestry === ancestry && item?.name === feature
    );
  }
  return character.ancestry_key === ancestry;
}

type RuntimeSource = {
  id: string;
  name: string;
  active: boolean;
  owned: boolean;
  effects: DaggerheartEffect[];
  tier?: number;
};

function sourceId(
  item: DaggerheartEffectGearItem | DaggerheartEffectDomainCard,
  prefix: string
) {
  return (
    ("instance_id" in item ? item.instance_id : undefined) ||
    item.compendium_id ||
    item.slug ||
    `${prefix}:${item.name}`
  );
}

function gearSources(character: DaggerheartEffectCharacter): RuntimeSource[] {
  const gear = [
    ...character.weapons.map((item) => ({ item, kind: "weapon" })),
    ...character.armor.map((item) => ({ item, kind: "armor" })),
    ...character.inventory.map((item) => ({ item, kind: "inventory" })),
  ];

  return gear.map(({ item, kind }) => {
    const defaultEquipped = kind === "armor" || kind === "weapon";
    return {
      id: sourceId(item, kind),
      name: item.name,
      active: item.equipped ?? defaultEquipped,
      owned: true,
      effects: item.effects ?? [],
      tier: item.tier ?? numberValue(item.metadata?.tier, 0) || undefined,
    };
  });
}

function cardSources(character: DaggerheartEffectCharacter): RuntimeSource[] {
  return character.domain_cards.map((card) => ({
    id: sourceId(card, "card"),
    name: card.name,
    active: card.state === "loadout",
    owned: true,
    effects: card.effects ?? [],
  }));
}

function intrinsicSources(
  character: DaggerheartEffectCharacter,
  hasEquippedPrimary: boolean
): RuntimeSource[] {
  const effects: Array<{
    source: string;
    effect: DaggerheartEffect;
  }> = [];

  const add = (
    source: string,
    id: string,
    label: string,
    stat: DaggerheartEffectStat,
    value?: number,
    value_from?: DaggerheartEffect["value_from"]
  ) => {
    effects.push({
      source,
      effect: {
        id,
        label,
        stat,
        operation: "add",
        value,
        value_from,
        scope: "owned",
        mode: "passive",
      },
    });
  };

  if (character.class_key === "brawler" && !hasEquippedPrimary) {
    add("Brawler", "brawler-unarmed-evasion", "Unarmored Defense", "evasion", 1);
  }

  if (
    character.class_key === "guardian" &&
    character.subclass_key === "vengeance"
  ) {
    add("Vengeance", "vengeance-stress", "At Ease", "stress_max", 1);
  }

  if (
    character.class_key === "wizard" &&
    character.subclass_key === "school-war"
  ) {
    add("School of War", "school-war-hp", "Battlemage", "hp_max", 1);
  }

  if (
    character.class_key === "guardian" &&
    character.subclass_key === "stalwart"
  ) {
    add("Stalwart", "stalwart-major", "Unwavering", "major_threshold", 1);
    add("Stalwart", "stalwart-severe", "Unwavering", "severe_threshold", 1);
  }

  if (
    character.class_key === "brawler" &&
    character.subclass_key === "juggernaut"
  ) {
    add("Juggernaut", "juggernaut-severe", "Heavy Hitter", "severe_threshold", 3);
  }

  if (hasAncestryFeature(character, "Giant", "Endurance")) {
    add("Giant", "giant-endurance", "Endurance", "hp_max", 1);
  }
  if (hasAncestryFeature(character, "Human", "High Stamina")) {
    add("Human", "human-stamina", "High Stamina", "stress_max", 1);
  }
  if (hasAncestryFeature(character, "Simiah", "Nimble")) {
    add("Simiah", "simiah-nimble", "Nimble", "evasion", 1);
  }
  if (hasAncestryFeature(character, "Earthkin", "Stoneskin")) {
    add("Earthkin", "earthkin-armor", "Stoneskin", "armor_score", 1);
    add("Earthkin", "earthkin-major", "Stoneskin", "major_threshold", 1);
    add("Earthkin", "earthkin-severe", "Stoneskin", "severe_threshold", 1);
  }
  if (hasAncestryFeature(character, "Galapa", "Shell")) {
    add("Galapa", "galapa-major", "Shell", "major_threshold", undefined, "proficiency");
    add("Galapa", "galapa-severe", "Shell", "severe_threshold", undefined, "proficiency");
  }

  const grouped = new Map<string, DaggerheartEffect[]>();
  for (const item of effects) {
    grouped.set(item.source, [...(grouped.get(item.source) ?? []), item.effect]);
  }

  return [...grouped.entries()].map(([name, sourceEffects]) => ({
    id: `intrinsic:${name.toLowerCase().replaceAll(" ", "-")}`,
    name,
    active: true,
    owned: true,
    effects: sourceEffects,
  }));
}

function sourceScopeActive(source: RuntimeSource, effect: DaggerheartEffect) {
  if (effect.scope === "owned") return source.owned;
  return source.active;
}

function conditionActive(
  effect: DaggerheartEffect,
  character: DaggerheartEffectCharacter,
  wearingArmor: boolean,
  stats: DaggerheartDerivedStats
) {
  const condition = effect.condition;
  if (!condition) return true;
  if (condition.type === "wearing_armor") return wearingArmor;
  if (condition.type === "stress_full") {
    const manualStress = numberValue(
      character.manual_stat_modifiers?.stress_max,
      0
    );
    const effectiveStressMax = Math.max(0, stats.stress_max + manualStress);
    return (
      effectiveStressMax > 0 &&
      character.stress_current >= effectiveStressMax
    );
  }
  if (condition.type === "domain_count") {
    const count = character.domain_cards.filter(
      (card) => card.state === "loadout" && card.domain === condition.domain
    ).length;
    return count >= condition.minimum;
  }
  return true;
}

function effectKey(source: RuntimeSource, effect: DaggerheartEffect) {
  return `${source.id}:${effect.id}`;
}

function resolveEffectValue(
  effect: DaggerheartEffect,
  source: RuntimeSource,
  stats: DaggerheartDerivedStats,
  spellcastTrait: string | null
) {
  if (typeof effect.value === "number") return effect.value;
  if (effect.value_from === "proficiency") return stats.proficiency;
  if (effect.value_from === "presence") return stats.presence;
  if (effect.value_from === "spellcast_trait") {
    return spellcastTrait ? numberValue(stats[spellcastTrait as keyof DaggerheartDerivedStats], 0) : 0;
  }
  if (effect.value_from === "tier") return source.tier ?? 0;
  return 0;
}

function applyContribution(
  stats: DaggerheartDerivedStats,
  breakdown: DaggerheartEffectResult["breakdown"],
  stat: DaggerheartEffectStat,
  value: number,
  source: string,
  label: string,
  key: string,
  temporary: boolean
) {
  stats[stat] = numberValue(stats[stat], 0) + value;
  const row: DaggerheartEffectContribution = {
    stat,
    value,
    source,
    label,
    effect_key: key,
    temporary,
  };
  breakdown[stat] = [...(breakdown[stat] ?? []), row];
}

export function deriveDaggerheartStats(
  character: DaggerheartEffectCharacter
): DaggerheartEffectResult {
  const fallback = baseStatsForClass(character.class_key, character.proficiency);
  const base = {
    ...fallback,
    ...(character.base_stats ?? {}),
  };

  const stats = {
    agility: numberValue(character.traits.agility),
    strength: numberValue(character.traits.strength),
    finesse: numberValue(character.traits.finesse),
    instinct: numberValue(character.traits.instinct),
    presence: numberValue(character.traits.presence),
    knowledge: numberValue(character.traits.knowledge),
    evasion: numberValue(base.evasion, fallback.evasion),
    proficiency: numberValue(base.proficiency, fallback.proficiency),
    hope_max: numberValue(base.hope_max, fallback.hope_max),
    hp_max: numberValue(base.hp_max, fallback.hp_max),
    stress_max: numberValue(base.stress_max, fallback.stress_max),
    armor_score: numberValue(base.armor_score),
    major_threshold: numberValue(base.major_threshold),
    severe_threshold: numberValue(base.severe_threshold),
    armor_slots_max: 0,
  } satisfies DaggerheartDerivedStats;

  const equippedArmor =
    character.armor.find((item) => item.equipped !== false) ?? null;

  if (equippedArmor) {
    const metadata = equippedArmor.metadata ?? {};
    stats.armor_score = numberValue(metadata.base_score, stats.armor_score);
    const major = numberValue(metadata.base_major);
    const severe = numberValue(metadata.base_severe);
    stats.major_threshold = major > 0 ? major + character.level : stats.major_threshold;
    stats.severe_threshold = severe > 0 ? severe + character.level : stats.severe_threshold;
  }

  const breakdown: DaggerheartEffectResult["breakdown"] = {};
  const gear = gearSources(character);
  const cards = cardSources(character);
  const hasEquippedPrimary = character.weapons.some(
    (item) => item.category === "weapon_primary" && item.equipped !== false
  );
  const sources = [
    ...intrinsicSources(character, hasEquippedPrimary),
    ...gear,
    ...cards,
  ];
  const activeIds = new Set(character.effect_state?.active_effect_ids ?? []);
  const wearingArmor = Boolean(equippedArmor);
  const spellcastTrait = spellcastTraitKey(character);

  const candidateEffects = sources.flatMap((source) =>
    source.effects.map((effect) => ({ source, effect }))
  );

  const shouldApply = (source: RuntimeSource, effect: DaggerheartEffect) => {
    if (!sourceScopeActive(source, effect)) return false;
    if (!conditionActive(effect, character, wearingArmor, stats)) return false;
    if (effect.mode === "toggle" && !activeIds.has(effectKey(source, effect))) {
      return false;
    }
    return true;
  };

  // Pass 1: traits. This lets gear-modified traits feed later formulas.
  for (const { source, effect } of candidateEffects) {
    if (!traitKeys.includes(effect.stat as (typeof traitKeys)[number])) continue;
    if (!shouldApply(source, effect)) continue;
    const value = resolveEffectValue(effect, source, stats, spellcastTrait);
    applyContribution(
      stats,
      breakdown,
      effect.stat,
      value,
      source.name,
      effect.label,
      effectKey(source, effect),
      effect.mode === "toggle"
    );
  }

  // Pass 2: resource maxima. Conditional effects such as "all Stress
  // slots marked" must evaluate against the already modified maximum.
  const resourceMaxStats = new Set<DaggerheartEffectStat>([
    "hp_max",
    "stress_max",
    "hope_max",
  ]);
  for (const { source, effect } of candidateEffects) {
    if (!resourceMaxStats.has(effect.stat) || !shouldApply(source, effect)) {
      continue;
    }
    const value = resolveEffectValue(effect, source, stats, spellcastTrait);
    applyContribution(
      stats,
      breakdown,
      effect.stat,
      value,
      source.name,
      effect.label,
      effectKey(source, effect),
      effect.mode === "toggle"
    );
  }

  // Pass 3: proficiency, because later formulas can depend on it.
  for (const { source, effect } of candidateEffects) {
    if (effect.stat !== "proficiency" || !shouldApply(source, effect)) continue;
    const value = resolveEffectValue(effect, source, stats, spellcastTrait);
    applyContribution(
      stats,
      breakdown,
      effect.stat,
      value,
      source.name,
      effect.label,
      effectKey(source, effect),
      effect.mode === "toggle"
    );
  }

  // Pass 4: remaining derived sheet stats.
  for (const { source, effect } of candidateEffects) {
    if (
      traitKeys.includes(effect.stat as (typeof traitKeys)[number]) ||
      resourceMaxStats.has(effect.stat) ||
      effect.stat === "proficiency" ||
      !shouldApply(source, effect)
    ) {
      continue;
    }
    const value = resolveEffectValue(effect, source, stats, spellcastTrait);
    applyContribution(
      stats,
      breakdown,
      effect.stat,
      value,
      source.name,
      effect.label,
      effectKey(source, effect),
      effect.mode === "toggle"
    );
  }

  for (const stat of daggerheartEffectStats) {
    const modifier = numberValue(character.manual_stat_modifiers?.[stat], 0);
    if (modifier !== 0) {
      applyContribution(
        stats,
        breakdown,
        stat,
        modifier,
        "GM / Homebrew",
        "Manual modifier",
        `manual:${stat}`,
        false
      );
    }
  }

  stats.armor_slots_max = Math.max(0, stats.armor_score);

  const toggles = candidateEffects
    .filter(({ source, effect }) => {
      if (effect.mode !== "toggle") return false;
      return (
        sourceScopeActive(source, effect) &&
        conditionActive(effect, character, wearingArmor, stats)
      );
    })
    .map(({ source, effect }) => ({
      key: effectKey(source, effect),
      source: source.name,
      label: effect.label,
      description: effect.description,
      duration: effect.duration,
      stat: effect.stat,
      value: resolveEffectValue(effect, source, stats, spellcastTrait),
      active: activeIds.has(effectKey(source, effect)),
    }));

  return {
    stats,
    breakdown,
    toggles,
    equippedArmor,
  };
}

export function effectiveSnapshot(result: DaggerheartEffectResult) {
  return {
    evasion: result.stats.evasion,
    proficiency: result.stats.proficiency,
    hope_max: result.stats.hope_max,
    hp_max: result.stats.hp_max,
    stress_max: result.stats.stress_max,
    armor_score: result.stats.armor_score,
    armor_slots_max: result.stats.armor_slots_max,
    major_threshold: result.stats.major_threshold,
    severe_threshold: result.stats.severe_threshold,
  };
}
