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
  "damage_proficiency_bonus",
  "primary_damage_proficiency_bonus",
  "hope_max",
  "hp_max",
  "stress_max",
  "armor_score",
  "major_threshold",
  "severe_threshold",
  "domain_loadout_max",
  "consumable_clear_bonus",
] as const;

export type DaggerheartEffectStat = (typeof daggerheartEffectStats)[number];

export type DaggerheartEffectCondition =
  | { type: "wearing_armor" }
  | { type: "not_wearing_armor" }
  | { type: "armor_fully_marked" }
  | { type: "domain_count"; domain: string; minimum: number }
  | { type: "stress_full" }
  | { type: "stress_empty" }
  | { type: "stress_marked" };

export type DaggerheartEffect = {
  id: string;
  label: string;
  stat: DaggerheartEffectStat;
  operation: "add" | "set" | "minimum";
  value?: number;
  value_from?:
    | "agility"
    | "strength"
    | "finesse"
    | "instinct"
    | "presence"
    | "knowledge"
    | "proficiency"
    | "spellcast_trait"
    | "tier"
    | "level"
    | "armor_score"
    | "available_armor_slots"
    | "stress_marked"
    | "half_agility_rounded_up"
    | "active_effect_value";
  value_by_tier?: Partial<Record<1 | 2 | 3 | 4, number>>;
  include_level?: boolean;
  feature?: string;
  bundle_id?: string;
  choice_group?: string;
  choice_limit?: number;
  scope: "equipped" | "loadout" | "owned";
  mode: "passive" | "toggle";
  condition?: DaggerheartEffectCondition;
  description?: string;
  duration?: string;
};

export type DaggerheartBaseStats = {
  evasion: number;
  proficiency: number;
  damage_proficiency_bonus: number;
  primary_damage_proficiency_bonus: number;
  hope_max: number;
  hp_max: number;
  stress_max: number;
  armor_score: number;
  major_threshold: number;
  severe_threshold: number;
  domain_loadout_max: number;
  consumable_clear_bonus: number;
};

export type DaggerheartManualStatModifiers = Partial<
  Record<DaggerheartEffectStat, number>
>;

export type DaggerheartEffectState = {
  active_effect_ids?: string[];
  active_effect_values?: Record<string, number>;
  action_uses?: Record<string, number>;
  action_resets?: Record<string, "scene" | "rest" | "long_rest" | "session">;
  effect_resets?: Record<string, "scene" | "rest" | "long_rest" | "session">;
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

export type DaggerheartIntrinsicSource = {
  id: string;
  name: string;
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
  intrinsic_sources?: DaggerheartIntrinsicSource[];
  stress_current: number;
  stress_max: number;
  evasion: number;
  proficiency: number;
  hope_max: number;
  hp_max: number;
  armor_score: number;
  armor_slots_current: number;
  armor_slots_max: number;
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
  operation: DaggerheartEffect["operation"];
  result_value: number;
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
  bundle_id?: string;
  choice_group?: string;
  choice_limit?: number;
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
    damage_proficiency_bonus: 0,
    primary_damage_proficiency_bonus: 0,
    hope_max: 6,
    hp_max: option?.startingHitPoints ?? 0,
    stress_max: 6,
    armor_score: 0,
    major_threshold: 0,
    severe_threshold: 0,
    domain_loadout_max: 5,
    consumable_clear_bonus: 0,
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

type RuntimeSource = {
  id: string;
  name: string;
  active: boolean;
  owned: boolean;
  effects: DaggerheartEffect[];
  tier?: number;
};

export function daggerheartSourceId(
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
      id: daggerheartSourceId(item, kind),
      name: item.name,
      active: item.equipped ?? defaultEquipped,
      owned: true,
      effects: item.effects ?? [],
      tier: item.tier ?? (numberValue(item.metadata?.tier, 0) || undefined),
    };
  });
}

function cardSources(character: DaggerheartEffectCharacter): RuntimeSource[] {
  return character.domain_cards.map((card) => ({
    id: daggerheartSourceId(card, "card"),
    name: card.name,
    active: card.state === "loadout",
    owned: true,
    effects: card.effects ?? [],
  }));
}

function intrinsicSources(
  character: DaggerheartEffectCharacter,
  hasActiveWeapon: boolean
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

  if (character.class_key === "brawler" && !hasActiveWeapon) {
    add("Brawler", "brawler-unarmed-evasion", "Unarmored Defense", "evasion", 1);
  }

  if (!character.intrinsic_sources) {
    if (character.class_key === "guardian" && character.subclass_key === "vengeance") {
      add("Vengeance", "vengeance-stress", "At Ease", "stress_max", 1);
    }
    if (character.class_key === "wizard" && character.subclass_key === "school-war") {
      add("School of War", "school-war-hp", "Battlemage", "hp_max", 1);
    }
    if (character.class_key === "guardian" && character.subclass_key === "stalwart") {
      add("Stalwart", "stalwart-major", "Unwavering", "major_threshold", 1);
      add("Stalwart", "stalwart-severe", "Unwavering", "severe_threshold", 1);
    }
    if (character.class_key === "brawler" && character.subclass_key === "juggernaut") {
      add("Juggernaut", "juggernaut-severe", "Rugged", "severe_threshold", 3);
    }

    const heritageHas = (ancestry: string, feature: string) => {
      if (character.heritage_state?.mixed) {
        return [
          character.heritage_state.feature_one,
          character.heritage_state.feature_two,
        ].some((item) => item?.ancestry === ancestry && item?.name === feature);
      }
      return character.ancestry_key === ancestry;
    };

    if (heritageHas("Giant", "Endurance")) {
      add("Giant", "giant-endurance", "Endurance", "hp_max", 1);
    }
    if (heritageHas("Human", "High Stamina")) {
      add("Human", "human-stamina", "High Stamina", "stress_max", 1);
    }
    if (heritageHas("Simiah", "Nimble")) {
      add("Simiah", "simiah-nimble", "Nimble", "evasion", 1);
    }
    if (heritageHas("Earthkin", "Stoneskin")) {
      add("Earthkin", "earthkin-armor", "Stoneskin", "armor_score", 1);
      add("Earthkin", "earthkin-major", "Stoneskin", "major_threshold", 1);
      add("Earthkin", "earthkin-severe", "Stoneskin", "severe_threshold", 1);
    }
    if (heritageHas("Galapa", "Shell")) {
      add("Galapa", "galapa-major", "Shell", "major_threshold", undefined, "proficiency");
      add("Galapa", "galapa-severe", "Shell", "severe_threshold", undefined, "proficiency");
    }
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
  if (condition.type === "not_wearing_armor") return !wearingArmor;
  if (condition.type === "armor_fully_marked") {
    return (
      wearingArmor &&
      stats.armor_score > 0 &&
      character.armor_slots_current >= stats.armor_score
    );
  }
  if (condition.type === "stress_full") {
    return stats.stress_max > 0 && character.stress_current >= stats.stress_max;
  }
  if (condition.type === "stress_empty") {
    return character.stress_current <= 0;
  }
  if (condition.type === "stress_marked") {
    return character.stress_current > 0;
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

function characterTier(level: number) {
  if (level <= 1) return 1 as const;
  if (level <= 4) return 2 as const;
  if (level <= 7) return 3 as const;
  return 4 as const;
}

function resolveEffectValue(
  effect: DaggerheartEffect,
  source: RuntimeSource,
  stats: DaggerheartDerivedStats,
  spellcastTrait: string | null,
  character: DaggerheartEffectCharacter,
  key: string
) {
  let total = typeof effect.value === "number" ? effect.value : 0;
  const tier: 1 | 2 | 3 | 4 =
    source.tier === 1 || source.tier === 2 || source.tier === 3 || source.tier === 4
      ? source.tier
      : characterTier(character.level);
  if (effect.value_by_tier?.[tier] !== undefined) {
    total += effect.value_by_tier[tier] ?? 0;
  }
  if (effect.include_level) total += character.level;

  const from = effect.value_from;
  if (from && ["agility", "strength", "finesse", "instinct", "presence", "knowledge"].includes(from)) {
    total += numberValue(stats[from as keyof DaggerheartDerivedStats], 0);
  } else if (from === "proficiency") total += stats.proficiency;
  else if (from === "spellcast_trait") {
    total += spellcastTrait
      ? numberValue(stats[spellcastTrait as keyof DaggerheartDerivedStats], 0)
      : 0;
  } else if (from === "tier") total += tier;
  else if (from === "level") total += character.level;
  else if (from === "armor_score") total += stats.armor_score;
  else if (from === "stress_marked") total += Math.max(0, character.stress_current);
  else if (from === "available_armor_slots") {
    total += Math.max(0, stats.armor_score - character.armor_slots_current);
  } else if (from === "half_agility_rounded_up") {
    total += Math.ceil(stats.agility / 2);
  } else if (from === "active_effect_value") {
    total += character.effect_state?.active_effect_values?.[key] ?? 0;
  }
  return total;
}

function applyContribution(
  stats: DaggerheartDerivedStats,
  breakdown: DaggerheartEffectResult["breakdown"],
  effect: DaggerheartEffect,
  value: number,
  source: string,
  key: string
) {
  const previous = numberValue(stats[effect.stat], 0);
  let next = previous;
  if (effect.operation === "set") next = value;
  else if (effect.operation === "minimum") next = Math.max(previous, value);
  else next = previous + value;

  stats[effect.stat] = next;
  const row: DaggerheartEffectContribution = {
    stat: effect.stat,
    value: next - previous,
    source,
    label: effect.label,
    effect_key: key,
    temporary: effect.mode === "toggle",
    operation: effect.operation,
    result_value: next,
  };
  breakdown[effect.stat] = [...(breakdown[effect.stat] ?? []), row];
}

function applyManualModifier(
  stats: DaggerheartDerivedStats,
  breakdown: DaggerheartEffectResult["breakdown"],
  character: DaggerheartEffectCharacter,
  stat: DaggerheartEffectStat
) {
  const modifier = numberValue(character.manual_stat_modifiers?.[stat], 0);
  if (modifier === 0) return;
  applyContribution(
    stats,
    breakdown,
    {
      id: `manual-${stat}`,
      label: "Manual modifier",
      stat,
      operation: "add",
      scope: "owned",
      mode: "passive",
    },
    modifier,
    "GM / Homebrew",
    `manual:${stat}`
  );
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
    damage_proficiency_bonus: numberValue(base.damage_proficiency_bonus, 0),
    primary_damage_proficiency_bonus: numberValue(
      base.primary_damage_proficiency_bonus,
      0
    ),
    hope_max: numberValue(base.hope_max, fallback.hope_max),
    hp_max: numberValue(base.hp_max, fallback.hp_max),
    stress_max: numberValue(base.stress_max, fallback.stress_max),
    armor_score: numberValue(base.armor_score),
    major_threshold: numberValue(base.major_threshold),
    severe_threshold: numberValue(base.severe_threshold),
    domain_loadout_max: numberValue(base.domain_loadout_max, 5),
    consumable_clear_bonus: numberValue(base.consumable_clear_bonus, 0),
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
  } else {
    // Core unarmored thresholds: level / 2 × level before other modifiers.
    // Bare Bones and other explicit "set" effects can replace these later.
    stats.major_threshold =
      stats.major_threshold > 0 ? stats.major_threshold : character.level;
    stats.severe_threshold =
      stats.severe_threshold > 0 ? stats.severe_threshold : character.level * 2;
  }

  stats.armor_slots_max = Math.max(0, stats.armor_score);

  const breakdown: DaggerheartEffectResult["breakdown"] = {};
  const gear = gearSources(character);
  const cards = cardSources(character);
  const hasActiveWeapon = character.weapons.some(
    (item) =>
      ["weapon_primary", "weapon_secondary"].includes(item.category ?? "") &&
      item.equipped !== false
  );
  const externalIntrinsic: RuntimeSource[] = (character.intrinsic_sources ?? []).map((source) => ({
    id: source.id,
    name: source.name,
    active: true,
    owned: true,
    effects: source.effects ?? [],
  }));
  const sources = [
    ...intrinsicSources(character, hasActiveWeapon),
    ...externalIntrinsic,
    ...gear,
    ...cards,
  ];
  const activeIds = new Set(character.effect_state?.active_effect_ids ?? []);
  const wearingArmor = Boolean(equippedArmor);
  const spellcastTrait = spellcastTraitKey(character);

  const operationOrder: Record<DaggerheartEffect["operation"], number> = {
    set: 0,
    minimum: 1,
    add: 2,
  };
  const candidateEffects = sources
    .flatMap((source) => source.effects.map((effect) => ({ source, effect })))
    .sort((a, b) => operationOrder[a.effect.operation] - operationOrder[b.effect.operation]);

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
    const key = effectKey(source, effect);
    const value = resolveEffectValue(effect, source, stats, spellcastTrait, character, key);
    applyContribution(stats, breakdown, effect, value, source.name, key);
  }

  for (const stat of traitKeys) {
    applyManualModifier(stats, breakdown, character, stat);
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
    const key = effectKey(source, effect);
    const value = resolveEffectValue(effect, source, stats, spellcastTrait, character, key);
    applyContribution(stats, breakdown, effect, value, source.name, key);
  }

  for (const stat of resourceMaxStats) {
    applyManualModifier(stats, breakdown, character, stat);
  }
  stats.hope_max = Math.max(0, Math.min(6, stats.hope_max));
  stats.hp_max = Math.max(0, Math.min(12, stats.hp_max));
  stats.stress_max = Math.max(0, Math.min(12, stats.stress_max));

  // Pass 3: proficiency, because later formulas can depend on it.
  for (const { source, effect } of candidateEffects) {
    if (effect.stat !== "proficiency" || !shouldApply(source, effect)) continue;
    const key = effectKey(source, effect);
    const value = resolveEffectValue(effect, source, stats, spellcastTrait, character, key);
    applyContribution(stats, breakdown, effect, value, source.name, key);
  }

  applyManualModifier(stats, breakdown, character, "proficiency");
  stats.proficiency = Math.max(0, Math.min(6, stats.proficiency));

  // Pass 4: Armor Score must settle before effects that scale from it
  // or inspect whether every Armor Slot is marked.
  for (const { source, effect } of candidateEffects) {
    if (effect.stat !== "armor_score" || !shouldApply(source, effect)) continue;
    const key = effectKey(source, effect);
    const value = resolveEffectValue(effect, source, stats, spellcastTrait, character, key);
    applyContribution(stats, breakdown, effect, value, source.name, key);
  }
  applyManualModifier(stats, breakdown, character, "armor_score");
  stats.armor_score = Math.max(0, Math.min(12, stats.armor_score));
  stats.armor_slots_max = stats.armor_score;

  // Pass 5: remaining derived sheet stats.
  for (const { source, effect } of candidateEffects) {
    if (
      traitKeys.includes(effect.stat as (typeof traitKeys)[number]) ||
      resourceMaxStats.has(effect.stat) ||
      effect.stat === "proficiency" ||
      effect.stat === "armor_score" ||
      !shouldApply(source, effect)
    ) {
      continue;
    }
    const key = effectKey(source, effect);
    const value = resolveEffectValue(effect, source, stats, spellcastTrait, character, key);
    applyContribution(stats, breakdown, effect, value, source.name, key);
  }

  const alreadyApplied = new Set<DaggerheartEffectStat>([
    ...traitKeys,
    ...resourceMaxStats,
    "proficiency",
    "armor_score",
  ]);
  for (const stat of daggerheartEffectStats) {
    if (!alreadyApplied.has(stat)) {
      applyManualModifier(stats, breakdown, character, stat);
    }
  }

  stats.hope_max = Math.max(0, Math.min(6, stats.hope_max));
  stats.hp_max = Math.max(0, Math.min(12, stats.hp_max));
  stats.stress_max = Math.max(0, Math.min(12, stats.stress_max));
  stats.proficiency = Math.max(0, Math.min(6, stats.proficiency));
  stats.armor_score = Math.max(0, Math.min(12, stats.armor_score));
  stats.armor_slots_max = stats.armor_score;

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
      value: resolveEffectValue(
        effect,
        source,
        stats,
        spellcastTrait,
        character,
        effectKey(source, effect)
      ),
      active: activeIds.has(effectKey(source, effect)),
      bundle_id: effect.bundle_id,
      choice_group: effect.choice_group,
      choice_limit: effect.choice_limit,
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
    domain_loadout_max: result.stats.domain_loadout_max,
  };
}
