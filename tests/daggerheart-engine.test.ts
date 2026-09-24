import assert from "node:assert/strict";
import test from "node:test";
import {
  baseStatsForClass,
  clearDaggerheartSourceEffects,
  deriveDaggerheartStats,
  prepareDaggerheartDomainCardsForRuntime,
  type DaggerheartEffect,
  type DaggerheartEffectCharacter,
  type DaggerheartEffectDomainCard,
} from "../lib/daggerheart/effects";
import {
  actionAvailable,
  collectDaggerheartActions,
  normalizeDaggerheartSpecialResources,
  resetDaggerheartActionUses,
  resolveDaggerheartAction,
  type DaggerheartActionCharacter,
  type DaggerheartActionSource,
} from "../lib/daggerheart/actions";
import { subclassCompendiumSlug, daggerheartClasses } from "../lib/daggerheart/catalog";
import { effectiveDamage } from "../lib/daggerheart/combat";
import { compendiumDefinitionRevision } from "../lib/daggerheart/compendium";

function effectCharacter(
  overrides: Partial<DaggerheartEffectCharacter> = {}
): DaggerheartEffectCharacter {
  return {
    level: 1,
    class_key: null,
    subclass_key: null,
    ancestry_key: null,
    traits: {
      agility: 0,
      strength: 0,
      finesse: 0,
      instinct: 0,
      presence: 0,
      knowledge: 0,
    },
    base_stats: baseStatsForClass(null, 1),
    manual_stat_modifiers: {},
    effect_state: { active_effect_ids: [], active_effect_values: {}, action_uses: {} },
    weapons: [],
    armor: [],
    inventory: [],
    domain_cards: [],
    intrinsic_sources: [],
    stress_current: 0,
    stress_max: 6,
    evasion: 10,
    proficiency: 1,
    hope_max: 6,
    hp_max: 0,
    armor_score: 0,
    armor_slots_current: 0,
    armor_slots_max: 0,
    major_threshold: 0,
    severe_threshold: 0,
    ...overrides,
  };
}

function actionCharacter(
  overrides: Partial<DaggerheartActionCharacter> = {}
): DaggerheartActionCharacter {
  return {
    weapons: [],
    armor: [],
    inventory: [],
    domain_cards: [],
    intrinsic_sources: [],
    special_resources: [],
    consumable_clear_bonus: 0,
    hope_current: 2,
    hope_max: 6,
    hp_current: 0,
    hp_max: 6,
    stress_current: 0,
    stress_max: 6,
    armor_slots_current: 0,
    armor_slots_max: 3,
    effect_state: { active_effect_ids: [], active_effect_values: {}, action_uses: {} },
    ...overrides,
  };
}

test("Bare Bones replaces unarmored base values and scales by tier + level", () => {
  const effects: DaggerheartEffect[] = [
    {
      id: "bare-bones-armor",
      label: "Bare Bones",
      stat: "armor_score",
      operation: "set",
      value: 3,
      value_from: "strength",
      scope: "loadout",
      mode: "passive",
      condition: { type: "not_wearing_armor" },
    },
    {
      id: "bare-bones-major",
      label: "Bare Bones",
      stat: "major_threshold",
      operation: "set",
      value_by_tier: { 1: 9, 2: 11, 3: 13, 4: 15 },
      include_level: true,
      scope: "loadout",
      mode: "passive",
      condition: { type: "not_wearing_armor" },
    },
    {
      id: "bare-bones-severe",
      label: "Bare Bones",
      stat: "severe_threshold",
      operation: "set",
      value_by_tier: { 1: 19, 2: 24, 3: 31, 4: 38 },
      include_level: true,
      scope: "loadout",
      mode: "passive",
      condition: { type: "not_wearing_armor" },
    },
  ];

  const result = deriveDaggerheartStats(
    effectCharacter({
      traits: {
        agility: 0,
        strength: 2,
        finesse: 0,
        instinct: 0,
        presence: 0,
        knowledge: 0,
      },
      domain_cards: [
        {
          name: "Bare Bones",
          domain: "Valor",
          state: "loadout",
          effects,
        },
      ],
    })
  );

  assert.equal(result.stats.armor_score, 5);
  assert.equal(result.stats.major_threshold, 10);
  assert.equal(result.stats.severe_threshold, 20);
  assert.equal(result.stats.armor_slots_max, 5);
});

test("Rune-Forged Exosuit changes thresholds and reduces domain loadout capacity", () => {
  const result = deriveDaggerheartStats(
    effectCharacter({
      level: 5,
      base_stats: {
        ...baseStatsForClass(null, 1),
        domain_loadout_max: 5,
      },
      armor: [
        {
          name: "Rune-Forged Exosuit",
          category: "armor",
          tier: 3,
          equipped: true,
          metadata: { base_score: 4, base_major: 10, base_severe: 20 },
          effects: [
            {
              id: "attuned-major",
              label: "Attuned",
              stat: "major_threshold",
              operation: "add",
              value_from: "tier",
              scope: "equipped",
              mode: "passive",
            },
            {
              id: "attuned-severe",
              label: "Attuned",
              stat: "severe_threshold",
              operation: "add",
              value_from: "tier",
              scope: "equipped",
              mode: "passive",
            },
            {
              id: "attuned-loadout",
              label: "Attuned",
              stat: "domain_loadout_max",
              operation: "add",
              value: -1,
              scope: "equipped",
              mode: "passive",
            },
          ],
        },
      ],
    })
  );

  assert.equal(result.stats.armor_score, 4);
  assert.equal(result.stats.major_threshold, 18);
  assert.equal(result.stats.severe_threshold, 28);
  assert.equal(result.stats.domain_loadout_max, 4);
});

test("Armor-dependent effects use the final structured Armor Score regardless of source order", () => {
  const result = deriveDaggerheartStats(
    effectCharacter({
      effect_state: {
        active_effect_ids: ["vambrace:deflecting-evasion"],
      },
      weapons: [
        {
          slug: "vambrace",
          name: "Eldritch Vambrace",
          category: "weapon_secondary",
          equipped: true,
          effects: [
            {
              id: "deflecting-evasion",
              label: "Deflecting",
              stat: "evasion",
              operation: "add",
              value_from: "armor_score",
              scope: "equipped",
              mode: "toggle",
            },
          ],
        },
      ],
      armor: [
        {
          slug: "finery",
          name: "Granminster's Finery",
          category: "armor",
          equipped: true,
          metadata: { base_score: 3, base_major: 10, base_severe: 20 },
          effects: [
            {
              id: "magnificent-armor",
              label: "Magnificent",
              stat: "armor_score",
              operation: "add",
              value: 2,
              scope: "equipped",
              mode: "passive",
            },
          ],
        },
      ],
    })
  );

  assert.equal(result.stats.armor_score, 5);
  assert.equal(result.stats.evasion, 15);
  assert.equal(result.stats.armor_slots_max, 5);
});

test("Vitality bundled thresholds behave as one active choice", () => {
  const sourceId = "vitality";
  const result = deriveDaggerheartStats(
    effectCharacter({
      base_stats: {
        ...baseStatsForClass(null, 1),
        hp_max: 5,
        stress_max: 6,
        major_threshold: 10,
        severe_threshold: 20,
      },
      effect_state: {
        active_effect_ids: [
          `${sourceId}:vitality-hp`,
          `${sourceId}:vitality-major`,
          `${sourceId}:vitality-severe`,
        ],
      },
      domain_cards: [
        {
          slug: "vitality",
          name: "Vitality",
          domain: "Valor",
          state: "vault",
          effects: [
            {
              id: "vitality-hp",
              label: "Vitality · Hit Point slot",
              stat: "hp_max",
              operation: "add",
              value: 1,
              scope: "owned",
              mode: "toggle",
              bundle_id: "vitality-hp",
              choice_group: "vitality",
              choice_limit: 2,
            },
            {
              id: "vitality-major",
              label: "Vitality · Damage thresholds",
              stat: "major_threshold",
              operation: "add",
              value: 2,
              scope: "owned",
              mode: "toggle",
              bundle_id: "vitality-thresholds",
              choice_group: "vitality",
              choice_limit: 2,
            },
            {
              id: "vitality-severe",
              label: "Vitality · Damage thresholds",
              stat: "severe_threshold",
              operation: "add",
              value: 2,
              scope: "owned",
              mode: "toggle",
              bundle_id: "vitality-thresholds",
              choice_group: "vitality",
              choice_limit: 2,
            },
          ],
        },
      ],
    })
  );

  assert.equal(result.stats.hp_max, 6);
  assert.equal(result.stats.major_threshold, 12);
  assert.equal(result.stats.severe_threshold, 22);
  assert.equal(result.toggles.filter((item) => item.bundle_id === "vitality-thresholds").length, 2);
});

test("Favor-backed quick actions spend the named special resource", () => {
  const source: DaggerheartActionSource = {
    source_key: "intrinsic:subclass:pact-endless",
    source_name: "Pact of the Endless",
    collection: "intrinsic",
    index: 0,
    active: true,
    quantity: null,
    effects: [],
    action_key: "intrinsic:subclass:pact-endless:action:mantle",
    action: {
      id: "mantle",
      label: "Patron's Mantle",
      scope: "owned",
      cost: {
        special_resource: { name: "Favor", amount: 1 },
      },
    },
  };

  const character = actionCharacter({
    special_resources: [
      { name: "Favor", current: 3, max: 0, notes: "Patron Die d6" },
    ],
  });

  assert.equal(actionAvailable(character, source).ok, true);
  const resolution = resolveDaggerheartAction(character, source);
  assert.equal(resolution.ok, true);
  assert.equal(resolution.patch?.special_resources?.[0]?.current, 2);

  const empty = actionCharacter({
    special_resources: [
      { name: "Favor", current: 0, max: 0, notes: "" },
    ],
  });
  assert.equal(actionAvailable(empty, source).ok, false);
});

test("Hedge consumable recovery bonus increases HP/Stress clearing", () => {
  const source: DaggerheartActionSource = {
    source_key: "inventory:minor-health",
    source_name: "Minor Health Potion",
    collection: "inventory",
    index: 0,
    active: true,
    quantity: 1,
    effects: [],
    action_key: "inventory:minor-health:action:drink",
    action: {
      id: "drink",
      label: "Drink Minor Health Potion",
      scope: "owned",
      results: [{ type: "clear", resource: "hp", amount: 1 }],
      consume_quantity: 1,
    },
  };

  const resolution = resolveDaggerheartAction(
    actionCharacter({
      hp_current: 4,
      hp_max: 6,
      consumable_clear_bonus: 1,
    }),
    source
  );

  assert.equal(resolution.ok, true);
  assert.equal(resolution.patch?.hp_current, 2);
  assert.equal(resolution.consume_quantity, 1);
});

test("Beastform disables spell-card actions but keeps ability-card actions", () => {
  const character = actionCharacter({
    beastform_active: true,
    domain_cards: [
      {
        slug: "spell-card",
        name: "Spell Card",
        domain: "Sage",
        state: "loadout",
        metadata: { card_type: "spell" },
        actions: [
          { id: "cast", label: "Cast", scope: "loadout" },
        ],
      },
      {
        slug: "ability-card",
        name: "Ability Card",
        domain: "Bone",
        state: "loadout",
        metadata: { card_type: "ability" },
        actions: [
          { id: "use", label: "Use ability", scope: "loadout" },
        ],
      },
    ],
  });

  const actions = collectDaggerheartActions(character);
  assert.equal(
    actions.find((source) => source.source_name === "Spell Card")?.active,
    false
  );
  assert.equal(
    actions.find((source) => source.source_name === "Ability Card")?.active,
    true
  );
});

test("clearing a class-option source removes stale temporary effects without resetting action uses", () => {
  const state = {
    active_effect_ids: [
      "class-option:stance-1:honed",
      "class-option:stance-1:vigilant",
      "card:other:keep",
    ],
    active_effect_values: {
      "class-option:stance-1:vigilant": 4,
      "card:other:keep": 2,
    },
    action_uses: {
      "class-option:stance-1:action:honed": 1,
      "card:other:action": 1,
    },
    action_resets: {
      "class-option:stance-1:action:honed": "scene" as const,
      "card:other:action": "rest" as const,
    },
    effect_resets: {
      "class-option:stance-1:honed": "scene" as const,
      "class-option:stance-1:vigilant": "scene" as const,
      "card:other:keep": "rest" as const,
    },
  };

  const cleared = clearDaggerheartSourceEffects(
    state,
    "class-option:stance-1"
  );

  assert.deepEqual(cleared.active_effect_ids, ["card:other:keep"]);
  assert.deepEqual(cleared.active_effect_values, { "card:other:keep": 2 });
  assert.deepEqual(cleared.effect_resets, { "card:other:keep": "rest" });
  assert.equal(
    cleared.action_uses?.["class-option:stance-1:action:honed"],
    1
  );
  assert.equal(
    cleared.action_resets?.["class-option:stance-1:action:honed"],
    "scene"
  );
});

test("scene reset clears temporary effects even when the action has no use limit", () => {
  const source: DaggerheartActionSource = {
    source_key: "card:i-see-it-coming",
    source_name: "I See It Coming",
    collection: "domain_cards",
    index: 0,
    active: true,
    quantity: null,
    effects: [
      {
        id: "incoming-evasion",
        label: "I See It Coming",
        stat: "evasion",
        operation: "add",
        value: 3,
        scope: "loadout",
        mode: "toggle",
      },
    ],
    action_key: "card:i-see-it-coming:action:incoming-evasion",
    action: {
      id: "incoming-evasion",
      label: "I See It Coming",
      scope: "loadout",
      activate_effect_id: "incoming-evasion",
      clear_effect_on: "scene",
    },
  };

  const state = {
    active_effect_ids: ["card:i-see-it-coming:incoming-evasion"],
    active_effect_values: {
      "card:i-see-it-coming:incoming-evasion": 3,
    },
    action_uses: {},
  };

  const reset = resetDaggerheartActionUses(state, "scene", [source]);
  assert.deepEqual(reset.active_effect_ids, []);
  assert.deepEqual(reset.active_effect_values, {});
});


test("all 26 subclasses resolve to a canonical compendium slug", () => {
  const subclasses = daggerheartClasses.flatMap((item) => item.subclasses);
  assert.equal(subclasses.length, 26);
  assert.equal(new Set(subclasses.map((item) => item.key)).size, 26);
  assert.equal(new Set(subclasses.map((item) => item.compendiumSlug)).size, 26);
  for (const subclass of subclasses) {
    assert.equal(subclassCompendiumSlug(subclass.key), subclass.compendiumSlug);
    assert.ok(subclass.compendiumSlug.length > 0);
  }
  assert.equal(subclassCompendiumSlug("school-war"), "school-of-war");
  assert.equal(subclassCompendiumSlug("pact-endless"), "pact-of-the-endless");
});

test("unarmored thresholds use level and twice level", () => {
  for (const [level, major, severe] of [
    [1, 1, 2],
    [5, 5, 10],
    [10, 10, 20],
  ] as const) {
    const result = deriveDaggerheartStats(
      effectCharacter({
        level,
        base_stats: { ...baseStatsForClass(null, 1), major_threshold: 0, severe_threshold: 0 },
      })
    );
    assert.equal(result.stats.major_threshold, major);
    assert.equal(result.stats.severe_threshold, severe);
  }
});

test("manual Proficiency is applied before Shell consumes it", () => {
  const shellEffects: DaggerheartEffect[] = [
    {
      id: "shell-major",
      label: "Shell",
      stat: "major_threshold",
      operation: "add",
      value_from: "proficiency",
      scope: "owned",
      mode: "passive",
    },
    {
      id: "shell-severe",
      label: "Shell",
      stat: "severe_threshold",
      operation: "add",
      value_from: "proficiency",
      scope: "owned",
      mode: "passive",
    },
  ];
  const result = deriveDaggerheartStats(
    effectCharacter({
      level: 1,
      base_stats: {
        ...baseStatsForClass(null, 1),
        major_threshold: 6,
        severe_threshold: 12,
      },
      manual_stat_modifiers: { proficiency: 1 },
      intrinsic_sources: [{ id: "galapa", name: "Galapa", effects: shellEffects }],
    })
  );
  assert.equal(result.stats.proficiency, 2);
  assert.equal(result.stats.major_threshold, 8);
  assert.equal(result.stats.severe_threshold, 14);
});

test("damage-only Proficiency bonus does not affect defensive formulas", () => {
  const result = deriveDaggerheartStats(
    effectCharacter({
      level: 1,
      base_stats: {
        ...baseStatsForClass(null, 1),
        major_threshold: 6,
        severe_threshold: 12,
      },
      intrinsic_sources: [
        {
          id: "galapa",
          name: "Galapa",
          effects: [
            {
              id: "shell-major",
              label: "Shell",
              stat: "major_threshold",
              operation: "add",
              value_from: "proficiency",
              scope: "owned",
              mode: "passive",
            },
            {
              id: "shell-severe",
              label: "Shell",
              stat: "severe_threshold",
              operation: "add",
              value_from: "proficiency",
              scope: "owned",
              mode: "passive",
            },
            {
              id: "damage-only",
              label: "Damage only",
              stat: "damage_proficiency_bonus",
              operation: "add",
              value: 1,
              scope: "owned",
              mode: "passive",
            },
          ],
        },
      ],
    })
  );
  assert.equal(result.stats.proficiency, 1);
  assert.equal(result.stats.damage_proficiency_bonus, 1);
  assert.equal(result.stats.major_threshold, 7);
  assert.equal(result.stats.severe_threshold, 13);
});

test("session reset does not refresh long-rest uses or clear scene effects", () => {
  const state = {
    active_effect_ids: ["source:scene-effect"],
    active_effect_values: { "source:scene-effect": 2 },
    action_uses: {
      "source:action:long": 1,
      "source:action:session": 1,
    },
    action_resets: {
      "source:action:long": "long_rest" as const,
      "source:action:session": "session" as const,
    },
    effect_resets: {
      "source:scene-effect": "scene" as const,
    },
  };
  const reset = resetDaggerheartActionUses(state, "session", []);
  assert.equal(reset.action_uses?.["source:action:long"], 1);
  assert.equal(reset.action_uses?.["source:action:session"], undefined);
  assert.deepEqual(reset.active_effect_ids, ["source:scene-effect"]);
});

test("persisted reset policies clear effects even when the source is currently hidden", () => {
  const state = {
    active_effect_ids: ["hidden:temporary"],
    active_effect_values: { "hidden:temporary": 4 },
    action_uses: { "hidden:action": 1 },
    action_resets: { "hidden:action": "scene" as const },
    effect_resets: { "hidden:temporary": "scene" as const },
  };
  const reset = resetDaggerheartActionUses(state, "scene", []);
  assert.deepEqual(reset.active_effect_ids, []);
  assert.deepEqual(reset.active_effect_values, {});
  assert.equal(reset.action_uses?.["hidden:action"], undefined);
});

test("domain-count action conditions follow the current Loadout", () => {
  const source: DaggerheartActionSource = {
    source_key: "bone-touched",
    source_name: "Bone-Touched",
    collection: "domain_cards",
    index: 0,
    active: true,
    quantity: null,
    effects: [],
    action_key: "bone-touched:action:denial",
    action: {
      id: "denial",
      label: "Bone-Touched",
      scope: "loadout",
      condition: { type: "domain_count", domain: "Bone", minimum: 4 },
    },
  };
  const three = actionCharacter({
    domain_cards: Array.from({ length: 3 }, (_, index) => ({
      slug: `bone-${index}`,
      name: `Bone ${index}`,
      domain: "Bone",
      state: "loadout" as const,
    })),
  });
  assert.equal(actionAvailable(three, source).ok, false);

  const four = actionCharacter({
    domain_cards: Array.from({ length: 4 }, (_, index) => ({
      slug: `bone-${index}`,
      name: `Bone ${index}`,
      domain: "Bone",
      state: "loadout" as const,
    })),
  });
  assert.equal(actionAvailable(four, source).ok, true);
});

test("compendium snapshots prefer explicit errata revision and otherwise keep updated-at traceability", () => {
  const base = {
    id: "entry",
    source_key: "core" as const,
    category: "domain_card" as const,
    slug: "sample",
    name: "Sample",
    parent_slug: null,
    domain: "Blade",
    level: 1,
    tier: null,
    summary: "",
    rules_text: "",
    metadata: {},
    effects: [],
    actions: [],
    errata: {},
    source_page_start: null,
    source_page_end: null,
    sort_order: 0,
    updated_at: "2026-09-24T10:00:00Z",
  };

  assert.equal(
    compendiumDefinitionRevision(base),
    "2026-09-24T10:00:00Z"
  );
  assert.equal(
    compendiumDefinitionRevision({
      ...base,
      errata: { revision: "Core Errata 2026-09" },
    }),
    "Core Errata 2026-09"
  );
});

test("invalid Domain Loadout runtime deduplicates cards and suspends loadout-scoped sources", () => {
  const cards: DaggerheartEffectDomainCard[] = [
    {
      compendium_id: "fortified",
      name: "Fortified Armor",
      domain: "Valor",
      state: "loadout" as const,
      effects: [],
    },
    {
      compendium_id: "fortified",
      name: "Fortified Armor",
      domain: "Valor",
      state: "loadout" as const,
      effects: [],
    },
    {
      compendium_id: "bone",
      name: "Bone Card",
      domain: "Bone",
      state: "loadout" as const,
      effects: [],
    },
  ];

  const prepared = prepareDaggerheartDomainCardsForRuntime(cards, 2);
  assert.equal(prepared.loadoutCount, 3);
  assert.equal(prepared.exceedsLoadout, true);
  assert.deepEqual(prepared.duplicateCompendiumIds, ["fortified"]);
  assert.equal(prepared.cards.length, 2);
  assert.ok(prepared.cards.every((card) => card.state === "vault"));
});

test("Favor and Focus are clamped to the rules maximum while custom resources remain configurable", () => {
  const normalized = normalizeDaggerheartSpecialResources([
    { name: "Favor", current: 99, max: 99, notes: "" },
    { name: "focus", current: -4, max: 2, notes: "" },
    { name: "Momentum", current: 9, max: 10, notes: "" },
  ]);

  assert.deepEqual(
    normalized.map(({ name, current, max }) => ({ name, current, max })),
    [
      { name: "Favor", current: 6, max: 6 },
      { name: "focus", current: 0, max: 6 },
      { name: "Momentum", current: 9, max: 10 },
    ]
  );
});

test("Brawler unarmed Evasion bonus is disabled by a secondary active weapon", () => {
  const unarmed = deriveDaggerheartStats(
    effectCharacter({ class_key: "brawler" })
  );
  assert.equal(unarmed.stats.evasion, 11);

  const armed = deriveDaggerheartStats(
    effectCharacter({
      class_key: "brawler",
      weapons: [
        {
          name: "Secondary",
          category: "weapon_secondary",
          equipped: true,
        },
      ],
    })
  );
  assert.equal(armed.stats.evasion, 10);
});

test("derived rule bounds cap Armor, HP, Stress, Hope and Proficiency", () => {
  const result = deriveDaggerheartStats(
    effectCharacter({
      base_stats: {
        ...baseStatsForClass(null, 1),
        hp_max: 20,
        stress_max: 20,
        hope_max: 20,
        armor_score: 20,
        proficiency: 20,
      },
    })
  );
  assert.equal(result.stats.hp_max, 12);
  assert.equal(result.stats.stress_max, 12);
  assert.equal(result.stats.hope_max, 6);
  assert.equal(result.stats.armor_score, 12);
  assert.equal(result.stats.proficiency, 6);
});

test("damage parser scales mixed types, NBSP and multi-die Brawler profiles", () => {
  assert.equal(effectiveDamage("d8phy/mag", 3), "3d8 physical/magic");
  assert.equal(effectiveDamage("d12+10\u00a0phy", 4), "4d12+10 physical");
  assert.equal(effectiveDamage("d8+d6 phy", 2), "2d8+2d6 physical");
});


test("stress-full conditions use the already adjusted Stress maximum exactly once", () => {
  const result = deriveDaggerheartStats(
    effectCharacter({
      stress_current: 7,
      manual_stat_modifiers: { stress_max: 1 },
      intrinsic_sources: [
        {
          id: "stress-check",
          name: "Stress Check",
          effects: [
            {
              id: "full-stress-evasion",
              label: "Full Stress",
              stat: "evasion",
              operation: "add",
              value: 2,
              scope: "owned",
              mode: "passive",
              condition: { type: "stress_full" },
            },
          ],
        },
      ],
    })
  );

  assert.equal(result.stats.stress_max, 7);
  assert.equal(result.stats.evasion, 12);
});
