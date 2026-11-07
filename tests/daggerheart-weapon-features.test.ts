import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DaggerheartCombatPanel } from "../components/daggerheart/DaggerheartCombatPanel";
import { baseStatsForClass } from "../lib/daggerheart/effects";
import {
  compendiumEffectiveRulesText,
  type DaggerheartCompendiumEntry,
} from "../lib/daggerheart/compendium";
import { weaponRulesText } from "../lib/daggerheart/combat";

type PanelProps = ComponentProps<typeof DaggerheartCombatPanel>;

const stats: PanelProps["stats"] = {
  ...baseStatsForClass(null, 1),
  agility: 0,
  strength: 0,
  finesse: 2,
  instinct: 0,
  presence: 1,
  knowledge: 0,
  armor_slots_max: 0,
  proficiency: 2,
};

function renderWeapons(weapons: PanelProps["weapons"]) {
  return renderToStaticMarkup(createElement(DaggerheartCombatPanel, {
    weapons,
    stats,
    level: 1,
    onRollAttack: () => {},
    onRollDamage: () => {},
  }));
}

function weapon(overrides: Partial<PanelProps["weapons"][number]> = {}) {
  return {
    name: "Training Rapier",
    category: "weapon_primary",
    equipped: true,
    rules_text: "Quick: Example rule from the linked weapon entry.",
    metadata: { trait: "Presence", range: "Melee", damage: "d8phy", burden: "One-Handed" },
    ...overrides,
  };
}

test("equipped primary and secondary weapons expose their own features beside the rolls", () => {
  const html = renderWeapons([
    weapon(),
    weapon({
      name: "Training Dagger",
      category: "weapon_secondary",
      rules_text: "Paired: Example secondary rule with its own range condition.",
    }),
  ]);
  const articles = html.match(/<article\b[\s\S]*?<\/article>/g) ?? [];
  assert.equal(articles.length, 2);
  assert.match(articles[0], /Quick: /);
  assert.doesNotMatch(articles[0], /Paired: /);
  assert.match(articles[1], /Paired: /);
  assert.doesNotMatch(articles[1], /Quick: /);
  for (const article of articles) {
    assert.match(article, /Weapon feature/);
    assert.doesNotMatch(article, /<details|<summary/);
  }
  assert.match(articles[0], /Roll Training Rapier attack using Presence \+1/);
  assert.match(articles[0], /Roll Training Rapier damage: 2d8 physical/);
});

test("current compendium rules replace original rules and preserve tier-specific values", () => {
  const entry = {
    rules_text: "Paired: Original example bonus +2.",
    errata: { rules_text: "Paired: Current example bonus +5." },
  } as DaggerheartCompendiumEntry;
  const html = renderWeapons([weapon({
    rules_text: compendiumEffectiveRulesText(entry),
    details: entry.rules_text,
  })]);
  assert.match(html, /Current example bonus \+5/);
  assert.doesNotMatch(html, /Original example bonus \+2/);
  assert.equal(compendiumEffectiveRulesText({ ...entry, errata: { summary: "Clarity only" } }), entry.rules_text);
});

test("legacy snapshots show their feature without repeating weapon statistics", () => {
  const html = renderWeapons([weapon({
    rules_text: undefined,
    details: "trait: Presence · range: Melee · damage: d8phy · burden: One-Handed · Quick: Saved example rule.",
  })]);
  assert.match(html, /Quick: /);
  assert.match(html, /Saved example rule/);
  assert.doesNotMatch(html, /trait: Presence|range: Melee|damage: d8phy|burden:/);
  assert.equal(weaponRulesText({
    details: "Original source: Quick: Old example.\n\nOfficial errata/current (v2): trait: Presence · Quick: Current example.",
  }), "Quick: Current example.");
});

test("absent features do not create blank cards or resurrect outdated text", () => {
  for (const rules_text of ["", " ", "—", "–", "-"]) {
    const html = renderWeapons([weapon({ rules_text, details: "Quick: Outdated example." })]);
    assert.doesNotMatch(html, /Weapon feature|Outdated example/);
    assert.match(html, /Roll Training Rapier damage/);
  }
  assert.equal(weaponRulesText({ details: "trait: Presence · range: Melee · damage: d8phy · burden: One-Handed" }), "");
});

test("stored weapons never show up as active feature sources", () => {
  const html = renderWeapons([
    weapon({ equipped: false }),
    weapon({ name: "Active Dagger", category: "weapon_secondary", rules_text: "Paired: Active example." }),
  ]);
  assert.doesNotMatch(html, /Training Rapier|Quick: /);
  assert.match(html, /Active Dagger|Paired: /);
  assert.doesNotMatch(renderWeapons([weapon({ equipped: false })]), /Weapon feature|Quick: /);
});

test("custom multiline weapon text is preserved and rendered safely", () => {
  const rules_text = "A custom rule without a feature heading.\nKeep this second line.\n<script>example</script>";
  const html = renderWeapons([weapon({ rules_text: undefined, details: rules_text })]);
  assert.match(html, /A custom rule without a feature heading\.\nKeep this second line/);
  assert.match(html, /&lt;script&gt;example&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
