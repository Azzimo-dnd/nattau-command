import assert from "node:assert/strict";
import test from "node:test";
import {
  baseStatsForClass,
  deriveDaggerheartStats,
  type DaggerheartEffect,
  type DaggerheartEffectCharacter,
} from "../lib/daggerheart/effects";
import {
  actionAvailable,
  resetDaggerheartActionUses,
  resolveDaggerheartAction,
  type DaggerheartActionCharacter,
  type DaggerheartActionSource,
} from "../lib/daggerheart/actions";

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
