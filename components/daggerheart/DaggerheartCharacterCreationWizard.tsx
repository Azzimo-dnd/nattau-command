"use client";

import { useEffect, useMemo, useState } from "react";
import {
  classOption,
  daggerheartClasses,
  daggerheartClassCreationGuidance,
  daggerheartAllClassStartingItems,
  daggerheartCommunities,
  daggerheartTraits,
  daggerheartTransformations,
} from "@/lib/daggerheart/catalog";
import {
  DaggerheartCompendiumPicker,
  compendiumEntryDetails,
} from "@/components/daggerheart/DaggerheartCompendiumPicker";
import {
  compendiumEffectiveMetadata,
  type DaggerheartCompendiumEntry,
} from "@/lib/daggerheart/compendium";
import type { DaggerheartAction } from "@/lib/daggerheart/actions";
import {
  baseStatsForClass,
  deriveDaggerheartStats,
  effectiveSnapshot,
  spellcastTraitKey,
  type DaggerheartBaseStats,
  type DaggerheartEffect,
  type DaggerheartEffectState,
  type DaggerheartManualStatModifiers,
} from "@/lib/daggerheart/effects";
import {
  DaggerheartHeritageBuilder,
  type HeritageState,
} from "@/components/daggerheart/DaggerheartHeritageBuilder";

type TraitKey = (typeof daggerheartTraits)[number];
type Traits = Record<TraitKey, number>;
type Experience = { name: string; modifier: number };
type DomainCard = {
  name: string;
  domain: string;
  level: number;
  state: "loadout" | "vault";
  compendium_id?: string;
  slug?: string;
  source_key?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  effects?: DaggerheartEffect[];
  actions?: DaggerheartAction[];
};
type GearItem = {
  instance_id?: string;
  name: string;
  details: string;
  compendium_id?: string;
  category?: string;
  slug?: string;
  source_key?: string;
  tier?: number | null;
  metadata?: Record<string, unknown>;
  effects?: DaggerheartEffect[];
  actions?: DaggerheartAction[];
  equipped?: boolean;
  quantity?: number;
};
type Resource = { name: string; current: number; max: number; notes: string };
type Gold = { handfuls: number; bags: number; chests: number };
type ClassOptionRef = {
  id: string;
  name: string;
  category: "beastform" | "martial_stance";
  tier: number | null;
  details: string;
  metadata?: Record<string, unknown>;
  effects?: DaggerheartEffect[];
  actions?: DaggerheartAction[];
};
type StateBag = {
  notes?: string;
  options?: ClassOptionRef[];
  [key: string]: unknown;
};

export type WizardCharacter = {
  name: string;
  pronouns: string;
  description: string;
  level: number;
  class_key: string | null;
  subclass_key: string | null;
  ancestry_key: string | null;
  community_key: string | null;
  heritage_state: HeritageState;
  transformations: string[];
  traits: Traits;
  evasion: number;
  proficiency: number;
  hope_current: number;
  hope_max: number;
  hp_current: number;
  hp_max: number;
  stress_current: number;
  stress_max: number;
  armor_score: number;
  armor_slots_current: number;
  armor_slots_max: number;
  major_threshold: number;
  severe_threshold: number;
  experiences: Experience[];
  domain_cards: DomainCard[];
  weapons: GearItem[];
  armor: GearItem[];
  inventory: GearItem[];
  gold: Gold;
  background_answers: string[];
  connections: string[];
  special_resources: Resource[];
  class_state: StateBag;
  subclass_state: StateBag;
  base_stats: DaggerheartBaseStats;
  manual_stat_modifiers: DaggerheartManualStatModifiers;
  effect_state: DaggerheartEffectState;
};

type Props = {
  draft: WizardCharacter;
  patch: (value: Partial<WizardCharacter>) => void;
  onFinish: () => void;
  onAdvanced: () => void;
  saving: boolean;
};

const stepNames = [
  "Class",
  "Heritage",
  "Traits",
  "Core Stats",
  "Equipment",
  "Background",
  "Experiences",
  "Domain Cards",
  "Connections",
];

const fieldClass =
  "min-h-11 w-full rounded-xl border border-[#58323f] bg-[#100a0e] px-3 py-2 text-sm text-[#eadfe3] outline-none transition focus:border-[#a34d64] focus:ring-2 focus:ring-[#6e263b]/30";
const buttonClass =
  "min-h-11 rounded-xl border border-[#734052] bg-[#35141f] px-4 text-sm font-bold text-[#ead1d8] transition hover:bg-[#49202d] disabled:cursor-not-allowed disabled:opacity-40";

function gearFromEntry(entry: DaggerheartCompendiumEntry): GearItem {
  return {
    name: entry.name,
    details: compendiumEntryDetails(entry),
    compendium_id: entry.id,
    category: entry.category,
    slug: entry.slug,
    source_key: entry.source_key,
    tier: entry.tier,
    metadata: compendiumEffectiveMetadata(entry),
    effects: entry.effects ?? [],
    actions: entry.actions ?? [],
    instance_id: crypto.randomUUID(),
    equipped: ["weapon_primary", "weapon_secondary", "armor"].includes(entry.category),
    quantity: 1,
  };
}

function normalizedTraitValues(traits: Traits) {
  return daggerheartTraits.map((key) => Number(traits[key] ?? 0)).sort((a, b) => a - b);
}

function isStartingTraitSpread(traits: Traits) {
  return JSON.stringify(normalizedTraitValues(traits)) === JSON.stringify([-1, 0, 0, 1, 1, 2]);
}

function burden(item: GearItem | undefined) {
  const raw = item?.metadata?.burden;
  return typeof raw === "string" ? raw.toLowerCase() : "";
}

function classManagedResources(resources: Resource[]) {
  return resources.filter((resource) => !["Favor", "Focus"].includes(resource.name));
}

function hasAncestryFeature(
  character: WizardCharacter,
  ancestry: string,
  feature: string
) {
  if (character.heritage_state?.mixed) {
    return [character.heritage_state.feature_one, character.heritage_state.feature_two]
      .some((item) => item?.ancestry === ancestry && item?.name === feature);
  }
  return character.ancestry_key === ancestry;
}

function hasSpellcastTrait(character: WizardCharacter) {
  return spellcastTraitKey(character) !== null;
}

export function DaggerheartCharacterCreationWizard({
  draft,
  patch,
  onFinish,
  onAdvanced,
  saving,
}: Props) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const selectedClass = classOption(draft.class_key);
  const expectedDomainCards =
    draft.class_key === "wizard" && draft.subclass_key === "school-knowledge" ? 3 : 2;
  const purposefulDesign = hasAncestryFeature(draft, "Clank", "Purposeful Design");
  const spellcastAvailable = hasSpellcastTrait(draft);
  const creationGuidance = draft.class_key
    ? daggerheartClassCreationGuidance[draft.class_key]
    : null;
  const effectResult = useMemo(() => deriveDaggerheartStats(draft), [draft]);

  useEffect(() => {
    const derived = effectiveSnapshot(effectResult);
    if (
      draft.evasion !== derived.evasion ||
      draft.proficiency !== derived.proficiency ||
      draft.hope_max !== derived.hope_max ||
      draft.hp_max !== derived.hp_max ||
      draft.stress_max !== derived.stress_max ||
      draft.armor_score !== derived.armor_score ||
      draft.armor_slots_max !== derived.armor_slots_max ||
      draft.major_threshold !== derived.major_threshold ||
      draft.severe_threshold !== derived.severe_threshold
    ) {
      patch(derived);
    }
  }, [draft, effectResult, patch]);

  useEffect(() => {
    if (step !== 4) return;
    const inventory = draft.inventory.filter(
      (item) => item.name !== "Nomadic Pack" || draft.community_key === "Wanderborne"
    );
    const add = (name: string, details = "") => {
      if (!inventory.some((item) => item.name === name)) inventory.push({ name, details });
    };
    add("Torch");
    add("50 feet of rope");
    add("Basic supplies", "Tent, bedroll, tinderbox, rations, and similar adventuring basics.");
    if (draft.community_key === "Wanderborne") {
      add(
        "Nomadic Pack",
        "Once per session, spend a Hope to produce a mundane item useful to the situation, with GM agreement."
      );
    }
    if (
      inventory.length !== draft.inventory.length ||
      draft.gold.handfuls < 1
    ) {
      patch({
        inventory,
        gold: { ...draft.gold, handfuls: Math.max(1, draft.gold.handfuls) },
      });
    }
  }, [draft.community_key, draft.gold, draft.inventory, patch, step]);

  function selectClass(key: string) {
    const nextClass = classOption(key);
    if (!nextClass) return;
    let resources = classManagedResources(draft.special_resources);
    if (key === "warlock") {
      resources = [...resources, { name: "Favor", current: 3, max: 6, notes: "Patron Die d6 (d8 at level 5)" }];
    }

    patch({
      class_key: key,
      subclass_key: null,
      level: 1,
      base_stats: baseStatsForClass(key, 1),
      manual_stat_modifiers: {},
      effect_state: { active_effect_ids: [] },
      evasion: nextClass.startingEvasion,
      hp_current: 0,
      hp_max: nextClass.startingHitPoints,
      stress_current: 0,
      stress_max: 6,
      hope_current: 2,
      hope_max: 6,
      proficiency: 1,
      domain_cards: [],
      class_state: {},
      subclass_state: {},
      inventory: draft.inventory.filter(
        (item) => !daggerheartAllClassStartingItems.includes(item.name)
      ),
      special_resources: resources,
    });
  }

  function selectSubclass(key: string) {
    let resources = classManagedResources(draft.special_resources);
    if (draft.class_key === "warlock") {
      resources = [...resources, { name: "Favor", current: 3, max: 0, notes: "Patron Die d6 (d8 at level 5)" }];
    }
    if (draft.class_key === "brawler" && key === "martial-artist") {
      resources = [...resources, { name: "Focus", current: 0, max: 6, notes: "Spend Focus to shift stances." }];
    }
    patch({
      subclass_key: key || null,
      subclass_state: {},
      domain_cards: [],
      special_resources: resources,
    });
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (!draft.name.trim()) return "Give the character a name.";
      if (!draft.class_key || !selectedClass) return "Choose a class.";
      if (!draft.subclass_key) return "Choose a subclass.";

      if (draft.class_key === "wizard") {
        const pattern = Number(draft.class_state.strange_pattern ?? 0);
        if (pattern < 1 || pattern > 12) return "Wizard must choose a Strange Patterns number from 1 to 12.";
      }
      if (draft.class_key === "sorcerer" && draft.subclass_key === "elemental-origin" && !draft.subclass_state.element) {
        return "Elemental Origin must choose an element.";
      }
      if (draft.class_key === "brawler" && !draft.class_state.brawler_strike_trait) {
        return "Choose the trait used by Brawler’s Strike.";
      }
      if (draft.class_key === "brawler" && draft.subclass_key === "martial-artist") {
        const stances = (draft.class_state.options ?? []).filter(
          (option) => option.category === "martial_stance"
        );
        if (stances.length !== 2) {
          return "Martial Artist starts with exactly two Tier 1 stances.";
        }
      }
      if (draft.class_key === "warlock") {
        if (!String(draft.class_state.patron_name ?? "").trim()) return "Name the Warlock’s patron.";
        if (!String(draft.class_state.patron_sphere ?? "").trim()) return "Choose the patron’s sphere of influence.";
      }
      if (draft.class_key === "ranger" && draft.subclass_key === "beastbound") {
        if (!String(draft.subclass_state.companion_name ?? "").trim()) return "Name the Beastbound companion.";
        if (!String(draft.subclass_state.companion_type ?? "").trim()) return "Describe the Beastbound companion.";
      }
    }

    if (step === 1) {
      if (!draft.ancestry_key || !draft.community_key) {
        return "Choose both an ancestry and a community.";
      }
      if (
        draft.heritage_state?.mixed &&
        (
          !draft.heritage_state.ancestry_one ||
          !draft.heritage_state.ancestry_two ||
          !draft.heritage_state.feature_one ||
          !draft.heritage_state.feature_two
        )
      ) {
        return "Mixed ancestry requires two different lineages and one feature from each.";
      }
    }

    if (step === 2 && !isStartingTraitSpread(draft.traits)) {
      return "Starting traits must use +2, +1, +1, 0, 0, and −1 exactly once.";
    }

    if (step === 4) {
      const primary = draft.weapons.find((item) => item.category === "weapon_primary");
      const secondary = draft.weapons.find((item) => item.category === "weapon_secondary");
      const isBrawlerUnarmed = draft.class_key === "brawler" && draft.weapons.length === 0;
      if (!primary && !isBrawlerUnarmed) return "Choose a Tier 1 primary weapon.";
      if (primary) {
        const primaryBurden = burden(primary);
        if (primaryBurden.includes("two") && secondary) {
          return "A two-handed primary weapon can’t be paired with a secondary weapon.";
        }
      }
      if (draft.armor.length > 1) return "Choose at most one starting armor.";
      const hasPotion = draft.inventory.some((item) =>
        ["Minor Health Potion", "Minor Stamina Potion"].includes(item.name)
      );
      if (!hasPotion) return "Choose a Minor Health Potion or Minor Stamina Potion.";
      if (
        creationGuidance &&
        !creationGuidance.startingItems.includes(
          String(draft.class_state.starting_item_choice ?? "")
        )
      ) {
        return "Choose one of your class-specific starting items.";
      }
      if (
        creationGuidance?.spellContainerPrompt &&
        !String(draft.class_state.spell_container ?? "").trim()
      ) {
        return "Choose what your character carries their spells in.";
      }
    }

    if (step === 6) {
      const experiences = draft.experiences.filter((item) => item.name.trim());
      if (experiences.length !== 2) {
        return "A level 1 character starts with exactly two Experiences.";
      }
      if (purposefulDesign) {
        const chosen = draft.heritage_state?.purposeful_experience_index;
        if (chosen !== 0 && chosen !== 1) {
          return "Purposeful Design must improve one of your two starting Experiences.";
        }
        if (
          experiences[chosen].modifier !== 3 ||
          experiences[chosen === 0 ? 1 : 0].modifier !== 2
        ) {
          return "Purposeful Design gives one starting Experience +3 and the other remains +2.";
        }
      } else if (experiences.some((item) => item.modifier !== 2)) {
        return "A level 1 character starts with exactly two Experiences at +2.";
      }
    }

    if (step === 7) {
      const cards = draft.domain_cards.filter((card) => card.name.trim());
      if (cards.length !== expectedDomainCards) {
        return `Choose exactly ${expectedDomainCards} level 1 Domain Cards for this build.`;
      }
      if (
        cards.some(
          (card) =>
            card.level !== 1 ||
            !selectedClass?.domains.includes(card.domain)
        )
      ) {
        return "Starting Domain Cards must be level 1 and come from your class domains.";
      }
      if (
        draft.armor.length === 0 &&
        !cards.some((card) => card.slug === "valor-bare-bones" || card.name === "Bare Bones")
      ) {
        return "Starting without armor requires Bare Bones. Choose starting armor or select Bare Bones.";
      }
    }

    return null;
  }

  function next() {
    const validation = validateCurrentStep();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setStep((current) => Math.min(stepNames.length - 1, current + 1));
  }

  function back() {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  }

  function selectClassStartingItem(name: string) {
    const inventory = draft.inventory.filter(
      (item) => !daggerheartAllClassStartingItems.includes(item.name)
    );
    patch({
      class_state: { ...draft.class_state, starting_item_choice: name },
      inventory: [...inventory, { name, details: "Class-specific starting item." }],
    });
  }

  function addNarrativePrompt(
    field: "background_answers" | "connections",
    prompt: string
  ) {
    const current = draft[field];
    if (current.some((item) => item.startsWith(prompt))) return;
    patch({ [field]: [...current.filter(Boolean), `${prompt}\n`] } as Partial<WizardCharacter>);
  }

  function replaceWeapon(category: "weapon_primary" | "weapon_secondary", entry: DaggerheartCompendiumEntry) {
    patch({
      weapons: [
        ...draft.weapons.filter((item) => item.category !== category),
        gearFromEntry(entry),
      ],
    });
  }

  function finish() {
    const validation = validateCurrentStep();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    onFinish();
  }

  const traitSpreadOkay = isStartingTraitSpread(draft.traits);

  return (
    <div className="space-y-5">
      <section className="rounded-[26px] border border-[#4a2935] bg-gradient-to-br from-[#2a111a] to-[#100a0e] p-5 shadow-xl shadow-black/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#a65a70]">
              Guided Character Creation
            </p>
            <h2 className="mt-2 font-serif text-3xl font-black text-[#f0dde2]">
              {draft.name || "A soul before the Mists"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a58f96]">
              Nine steps following Daggerheart character creation, with Core Rulebook and Hope & Fear options from the private compendium.
            </p>
          </div>
          <button type="button" onClick={onAdvanced} className={buttonClass}>
            Advanced editor
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {stepNames.map((name, index) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                if (index <= step) {
                  setError(null);
                  setStep(index);
                }
              }}
              className={`rounded-xl border px-2 py-2 text-center text-[11px] font-bold transition ${
                index === step
                  ? "border-[#a65068] bg-[#5b1e31] text-[#f2dce2]"
                  : index < step
                    ? "border-[#57323f] bg-[#241219] text-[#bea3ab]"
                    : "border-[#312029] bg-black/15 text-[#6e5c62]"
              }`}
            >
              <span className="block text-[9px] opacity-70">{index + 1}</span>
              {name}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-[#7c3a4d] bg-[#3d121f]/50 px-4 py-3 text-sm text-[#f0c9d4]">
          {error}
        </div>
      )}

      <section className="rounded-[26px] border border-[#402731] bg-[#110b0f]/92 p-5 sm:p-6">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9c6172]">Step 1</p>
              <h3 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">Choose class & subclass</h3>
              <p className="mt-2 text-sm leading-6 text-[#97848b]">Start at level 1. Choose the character’s identity, class, subclass, and any creation-time class choices.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Character name</span>
                <input className={fieldClass} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Pronouns</span>
                <input className={fieldClass} value={draft.pronouns} onChange={(e) => patch({ pronouns: e.target.value })} />
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Class</span>
                <select className={fieldClass} value={draft.class_key ?? ""} onChange={(e) => selectClass(e.target.value)}>
                  <option value="">Choose class</option>
                  <optgroup label="Core Rulebook">
                    {daggerheartClasses.filter((item) => item.source === "core").map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Hope & Fear">
                    {daggerheartClasses.filter((item) => item.source === "hope-fear").map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Subclass</span>
                <select
                  className={fieldClass}
                  value={draft.subclass_key ?? ""}
                  onChange={(e) => selectSubclass(e.target.value)}
                  disabled={!selectedClass}
                >
                  <option value="">Choose subclass</option>
                  {(selectedClass?.subclasses ?? []).map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {selectedClass && (
              <div className="rounded-2xl border border-[#39252d] bg-black/20 p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#5f3544] px-3 py-1 text-xs text-[#caa8b2]">{selectedClass.domains[0]}</span>
                  <span className="rounded-full border border-[#5f3544] px-3 py-1 text-xs text-[#caa8b2]">{selectedClass.domains[1]}</span>
                  <span className="rounded-full border border-[#49303a] px-3 py-1 text-xs text-[#a99198]">Evasion {selectedClass.startingEvasion}</span>
                  <span className="rounded-full border border-[#49303a] px-3 py-1 text-xs text-[#a99198]">HP {selectedClass.startingHitPoints}</span>
                  {selectedClass.source === "hope-fear" && (
                    <span className="rounded-full border border-[#704152] bg-[#30141e] px-3 py-1 text-xs text-[#d7a8b6]">Hope & Fear</span>
                  )}
                </div>
              </div>
            )}

            {draft.class_key === "wizard" && (
              <label className="block">
                <span className="mb-1.5 block text-xs text-[#a48d95]">Strange Patterns number (1–12)</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className={fieldClass}
                  value={Number(draft.class_state.strange_pattern ?? 1)}
                  onChange={(e) => patch({ class_state: { ...draft.class_state, strange_pattern: Number(e.target.value) } })}
                />
              </label>
            )}

            {draft.class_key === "sorcerer" && draft.subclass_key === "elemental-origin" && (
              <label className="block">
                <span className="mb-1.5 block text-xs text-[#a48d95]">Elemental Origin</span>
                <select
                  className={fieldClass}
                  value={String(draft.subclass_state.element ?? "")}
                  onChange={(e) => patch({ subclass_state: { ...draft.subclass_state, element: e.target.value } })}
                >
                  <option value="">Choose element</option>
                  {["Air", "Earth", "Fire", "Lightning", "Water"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            )}

            {draft.class_key === "brawler" && (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs text-[#a48d95]">Brawler’s Strike trait</span>
                  <select
                    className={fieldClass}
                    value={String(draft.class_state.brawler_strike_trait ?? "")}
                    onChange={(e) => patch({ class_state: { ...draft.class_state, brawler_strike_trait: e.target.value } })}
                  >
                    <option value="">Choose trait</option>
                    {daggerheartTraits.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                {draft.subclass_key === "martial-artist" && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#957681]">Choose two Tier 1 Martial Stances</p>
                    <DaggerheartCompendiumPicker
                      categories={["martial_stance"]}
                      label="Choose a Tier 1 stance…"
                      maxTier={1}
                      onSelect={(entry) => {
                        const options = draft.class_state.options ?? [];
                        const stances = options.filter(
                          (option) => option.category === "martial_stance"
                        );
                        if (
                          stances.some((option) => option.id === entry.id) ||
                          stances.length >= 2
                        ) {
                          return;
                        }
                        patch({
                          class_state: {
                            ...draft.class_state,
                            options: [
                              ...options,
                              {
                                id: entry.id,
                                name: entry.name,
                                category: "martial_stance",
                                tier: entry.tier,
                                details: compendiumEntryDetails(entry),
                                metadata: compendiumEffectiveMetadata(entry),
                                effects: entry.effects ?? [],
                                actions: entry.actions ?? [],
                              },
                            ],
                          },
                        });
                      }}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(draft.class_state.options ?? [])
                        .filter((option) => option.category === "martial_stance")
                        .map((stance) => (
                          <button
                            key={stance.id}
                            type="button"
                            className="rounded-full border border-[#694052] bg-[#2b1520] px-3 py-1.5 text-xs text-[#ddb8c3]"
                            onClick={() =>
                              patch({
                                class_state: {
                                  ...draft.class_state,
                                  options: (draft.class_state.options ?? []).filter(
                                    (item) => item.id !== stance.id
                                  ),
                                },
                              })
                            }
                          >
                            {stance.name} ×
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {draft.class_key === "warlock" && (
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs text-[#a48d95]">Patron name</span>
                  <input
                    className={fieldClass}
                    value={String(draft.class_state.patron_name ?? "")}
                    onChange={(e) => patch({ class_state: { ...draft.class_state, patron_name: e.target.value } })}
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs text-[#a48d95]">Patron sphere of influence</span>
                  <input
                    className={fieldClass}
                    placeholder="Death, Nature, Secrets, War…"
                    value={String(draft.class_state.patron_sphere ?? "")}
                    onChange={(e) => patch({ class_state: { ...draft.class_state, patron_sphere: e.target.value } })}
                  />
                </label>
              </div>
            )}

            {draft.class_key === "ranger" && draft.subclass_key === "beastbound" && (
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs text-[#a48d95]">Companion name</span>
                  <input
                    className={fieldClass}
                    value={String(draft.subclass_state.companion_name ?? "")}
                    onChange={(e) => patch({ subclass_state: { ...draft.subclass_state, companion_name: e.target.value } })}
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs text-[#a48d95]">Companion animal / description</span>
                  <input
                    className={fieldClass}
                    value={String(draft.subclass_state.companion_type ?? "")}
                    onChange={(e) => patch({ subclass_state: { ...draft.subclass_state, companion_type: e.target.value } })}
                  />
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs text-[#a48d95]">Character description</span>
              <textarea className={`${fieldClass} min-h-28`} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9c6172]">Step 2</p>
              <h3 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">Choose heritage</h3>
              <p className="mt-2 text-sm text-[#97848b]">Heritage combines ancestry and community. Hope & Fear options are included.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
              <DaggerheartHeritageBuilder
                ancestryKey={draft.ancestry_key}
                value={draft.heritage_state ?? {}}
                onChange={(ancestryKey, heritageState) =>
                  patch({
                    ancestry_key: ancestryKey,
                    heritage_state: heritageState,
                    experiences: draft.experiences.map((item) => ({
                      ...item,
                      modifier: 2,
                    })),
                  })
                }
              />
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Community</span>
                <select className={fieldClass} value={draft.community_key ?? ""} onChange={(e) => patch({ community_key: e.target.value || null })}>
                  <option value="">Choose community</option>
                  {daggerheartCommunities.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#957681]">Optional Hope & Fear transformation</p>
              <p className="mb-3 text-xs leading-5 text-[#7f6c73]">Only select one if the GM intends the character to begin play with a transformation.</p>
              <div className="flex flex-wrap gap-2">
                {daggerheartTransformations.map((item) => {
                  const checked = draft.transformations.includes(item);
                  return (
                    <label key={item} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${checked ? "border-[#9b4b61] bg-[#4b1928] text-[#f0d6dd]" : "border-[#412731] bg-black/15 text-[#a99098]"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          patch({
                            transformations: checked ? [] : [item],
                          })
                        }
                      />
                      {item}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9c6172]">Step 3</p>
              <h3 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">Assign character traits</h3>
              <p className="mt-2 text-sm text-[#97848b]">Distribute exactly +2, +1, +1, 0, 0, and −1.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {daggerheartTraits.map((trait) => (
                <label key={trait}>
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.15em] text-[#987984]">{trait}</span>
                  <select
                    className={fieldClass}
                    value={draft.traits[trait]}
                    onChange={(e) => patch({ traits: { ...draft.traits, [trait]: Number(e.target.value) } })}
                  >
                    {[-1, 0, 1, 2].map((value) => <option key={value} value={value}>{value > 0 ? `+${value}` : value}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className={`rounded-xl border px-4 py-3 text-sm ${traitSpreadOkay ? "border-emerald-900/50 bg-emerald-950/15 text-emerald-200" : "border-[#54313d] bg-black/15 text-[#b89fa7]"}`}>
              {traitSpreadOkay ? "Valid starting trait spread." : `Current spread: ${normalizedTraitValues(draft.traits).map((value) => value > 0 ? `+${value}` : value).join(", ")}`}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9c6172]">Step 4</p>
              <h3 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">Record core stats</h3>
              <p className="mt-2 text-sm text-[#97848b]">These starting values are applied automatically from your class.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                ["Level", draft.level],
                ["Evasion", draft.evasion],
                ["Hit Points", draft.hp_max],
                ["Stress", draft.stress_max],
                ["Hope", `${draft.hope_current}/${draft.hope_max}`],
                ["Proficiency", draft.proficiency],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-[#3a252d] bg-black/20 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8c717a]">{label}</p>
                  <p className="mt-2 text-2xl font-black text-[#ead7dc]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9c6172]">Step 5</p>
              <h3 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">Choose starting equipment</h3>
              <p className="mt-2 text-sm text-[#97848b]">Tier 1 only. A two-handed primary excludes a secondary; a one-handed secondary is optional. You may leave armor empty if your final build takes Bare Bones.</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#957681]">Primary weapon</p>
              {draft.class_key === "brawler" && (
                <p className="mb-3 rounded-xl border border-[#49303a] bg-black/15 p-3 text-xs leading-5 text-[#a99098]">
                  Brawlers may leave weapons empty and use Brawler’s Strike.
                </p>
              )}
              <DaggerheartCompendiumPicker
                categories={["weapon_primary"]}
                label="Choose Tier 1 primary weapon…"
                maxTier={1}
                allowMagicWeapons={spellcastAvailable}
                onSelect={(entry) => replaceWeapon("weapon_primary", entry)}
              />
              {draft.weapons.filter((item) => item.category === "weapon_primary").map((item) => (
                <div key={item.name} className="mt-2 flex items-center justify-between rounded-xl border border-[#3a252d] bg-black/15 p-3 text-sm text-[#cdb9bf]">
                  <span>{item.name}</span>
                  <button type="button" onClick={() => patch({ weapons: draft.weapons.filter((weapon) => weapon !== item) })}>×</button>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#957681]">Secondary weapon</p>
              <DaggerheartCompendiumPicker
                categories={["weapon_secondary"]}
                label="Choose Tier 1 secondary weapon…"
                maxTier={1}
                allowMagicWeapons={spellcastAvailable}
                onSelect={(entry) => replaceWeapon("weapon_secondary", entry)}
              />
              {draft.weapons.filter((item) => item.category === "weapon_secondary").map((item) => (
                <div key={item.name} className="mt-2 flex items-center justify-between rounded-xl border border-[#3a252d] bg-black/15 p-3 text-sm text-[#cdb9bf]">
                  <span>{item.name}</span>
                  <button type="button" onClick={() => patch({ weapons: draft.weapons.filter((weapon) => weapon !== item) })}>×</button>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#957681]">Armor</p>
              <DaggerheartCompendiumPicker
                categories={["armor"]}
                label="Choose Tier 1 armor…"
                maxTier={1}
                onSelect={(entry) => {
                  patch({
                    armor: [gearFromEntry(entry)],
                    armor_slots_current: 0,
                  });
                }}
              />
              {draft.armor.map((item) => (
                <div key={item.name} className="mt-2 flex items-center justify-between rounded-xl border border-[#3a252d] bg-black/15 p-3 text-sm text-[#cdb9bf]">
                  <span>{item.name} · Armor {draft.armor_score} · Thresholds {draft.major_threshold}/{draft.severe_threshold}</span>
                  <button type="button" onClick={() => patch({ armor: [], armor_score: 0, armor_slots_max: 0, major_threshold: 0, severe_threshold: 0 })}>×</button>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#957681]">
                Starting potion
              </p>
              <DaggerheartCompendiumPicker
                categories={["consumable"]}
                names={["Minor Health Potion", "Minor Stamina Potion"]}
                label="Choose your starting potion…"
                onSelect={(entry) => {
                  const inventory = draft.inventory.filter(
                    (item) =>
                      !["Minor Health Potion", "Minor Stamina Potion"].includes(
                        item.name
                      )
                  );
                  patch({
                    inventory: [...inventory, { ...gearFromEntry(entry), equipped: false }],
                  });
                }}
              />
              {draft.inventory
                .filter((item) =>
                  ["Minor Health Potion", "Minor Stamina Potion"].includes(
                    item.name
                  )
                )
                .map((item) => (
                  <div
                    key={item.instance_id ?? item.name}
                    className="mt-2 rounded-xl border border-[#5d3341] bg-[#29131c] p-3 text-sm text-[#d9bcc5]"
                  >
                    {item.name} · usable directly from the finished character sheet
                  </div>
                ))}
            </div>

            {creationGuidance && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#957681]">
                  Class-specific starting item
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {creationGuidance.startingItems.map((item) => {
                    const selected = draft.class_state.starting_item_choice === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => selectClassStartingItem(item)}
                        className={`rounded-xl border p-3 text-left text-sm transition ${
                          selected
                            ? "border-[#985066] bg-[#401723] text-[#f0d4dc]"
                            : "border-[#3b262e] bg-black/15 text-[#ad979e]"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
                {creationGuidance.spellContainerPrompt && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs text-[#a48d95]">
                      {creationGuidance.spellContainerPrompt}
                    </span>
                    <input
                      className={fieldClass}
                      placeholder="Describe the spell-carrying medium…"
                      value={String(draft.class_state.spell_container ?? "")}
                      onChange={(event) =>
                        patch({
                          class_state: {
                            ...draft.class_state,
                            spell_container: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9c6172]">Step 6</p>
              <h3 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">Create background</h3>
              <p className="mt-2 text-sm text-[#97848b]">Answer the prompts that matter to this character. You can write your own questions too.</p>
            </div>
            {creationGuidance && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#957681]">
                  Character guide prompts
                </p>
                <div className="grid gap-2 lg:grid-cols-3">
                  {creationGuidance.backgroundQuestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => addNarrativePrompt("background_answers", prompt)}
                      className="rounded-xl border border-[#3b2730] bg-black/15 p-3 text-left text-xs leading-5 text-[#b39ea5] transition hover:border-[#704052] hover:bg-[#26131b]"
                    >
                      + {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(draft.background_answers.length ? draft.background_answers : [""]).map((item, index) => (
              <div key={index} className="flex gap-2">
                <textarea
                  className={`${fieldClass} min-h-24`}
                  placeholder="Background question / answer…"
                  value={item}
                  onChange={(e) => {
                    const next = draft.background_answers.length ? [...draft.background_answers] : [""];
                    next[index] = e.target.value;
                    patch({ background_answers: next });
                  }}
                />
                <button type="button" className={buttonClass} onClick={() => patch({ background_answers: draft.background_answers.filter((_, i) => i !== index) })}>×</button>
              </div>
            ))}
            <button type="button" className={buttonClass} onClick={() => patch({ background_answers: [...draft.background_answers, ""] })}>+ Background answer</button>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9c6172]">Step 7</p>
              <h3 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">Create Experiences</h3>
              <p className="mt-2 text-sm text-[#97848b]">
                Create exactly two specific Experiences. Both start at +2
                {purposefulDesign ? ", then Purposeful Design raises one of them to +3." : "."}
              </p>
            </div>
            {[0, 1].map((index) => {
              const item = draft.experiences[index] ?? { name: "", modifier: 2 };
              return (
                <label key={index} className="block">
                  <span className="mb-1.5 block text-xs text-[#a48d95]">Experience {index + 1} · +2</span>
                  <input
                    className={fieldClass}
                    placeholder={index === 0 ? "Assassin of the Sapphire Syndicate" : "Never Leave Anyone Behind"}
                    value={item.name}
                    onChange={(e) => {
                      const next = [
                        draft.experiences[0] ?? { name: "", modifier: 2 },
                        draft.experiences[1] ?? { name: "", modifier: 2 },
                      ];
                      const purposefulIndex = draft.heritage_state?.purposeful_experience_index;
                      next[index] = {
                        name: e.target.value,
                        modifier:
                          purposefulDesign && purposefulIndex === index ? 3 : 2,
                      };
                      patch({ experiences: next });
                    }}
                  />
                </label>
              );
            })}
            {purposefulDesign && (
              <div className="rounded-2xl border border-[#4c3039] bg-black/15 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#aa7382]">
                  Clank · Purposeful Design
                </p>
                <p className="mt-2 text-xs leading-5 text-[#8f7b82]">
                  Choose which Experience best reflects what your Clank was built for. It gains a permanent +1 bonus.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[0, 1].map((index) => {
                    const experience = draft.experiences[index] ?? { name: "", modifier: 2 };
                    const selected = draft.heritage_state?.purposeful_experience_index === index;
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={!experience.name.trim()}
                        onClick={() => {
                          const next = [
                            draft.experiences[0] ?? { name: "", modifier: 2 },
                            draft.experiences[1] ?? { name: "", modifier: 2 },
                          ].map((item, itemIndex) => ({
                            ...item,
                            modifier: itemIndex === index ? 3 : 2,
                          }));
                          patch({
                            experiences: next,
                            heritage_state: {
                              ...draft.heritage_state,
                              purposeful_experience_index: index,
                            },
                          });
                        }}
                        className={`rounded-xl border p-3 text-left text-sm transition disabled:opacity-40 ${
                          selected
                            ? "border-[#9a5064] bg-[#401823] text-[#f0d5dc]"
                            : "border-[#3a252d] bg-black/15 text-[#ad979e]"
                        }`}
                      >
                        {experience.name || `Experience ${index + 1}`}
                        <span className="ml-2 font-black">{selected ? "+3" : "+2"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 7 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9c6172]">Step 8</p>
              <h3 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">Choose Domain Cards</h3>
              <p className="mt-2 text-sm text-[#97848b]">
                Choose {expectedDomainCards} level 1 cards from {selectedClass?.domains.join(" and ") || "your class domains"}.
                {expectedDomainCards === 3 ? " School of Knowledge grants one additional starting card." : ""}
              </p>
            </div>
            <DaggerheartCompendiumPicker
              categories={["domain_card"]}
              label="Choose a level 1 Domain Card…"
              domains={selectedClass?.domains}
              maxLevel={1}
              onSelect={(entry) => {
                if (draft.domain_cards.some((card) => card.compendium_id === entry.id)) return;
                if (draft.domain_cards.length >= expectedDomainCards) return;
                patch({
                  domain_cards: [
                    ...draft.domain_cards,
                    {
                      name: entry.name,
                      domain: entry.domain ?? "",
                      level: entry.level ?? 1,
                      state: "loadout",
                      compendium_id: entry.id,
                      slug: entry.slug,
                      source_key: entry.source_key,
                      details: compendiumEntryDetails(entry),
                      metadata: compendiumEffectiveMetadata(entry),
                      effects: entry.effects ?? [],
                      actions: entry.actions ?? [],
                    },
                  ],
                });
              }}
            />
            <div className="space-y-2">
              {draft.domain_cards.map((card) => (
                <div key={card.compendium_id ?? card.name} className="flex items-center justify-between rounded-xl border border-[#3a252d] bg-black/15 p-3">
                  <div>
                    <p className="font-semibold text-[#d9c5cb]">{card.name}</p>
                    <p className="mt-1 text-xs text-[#8e777f]">{card.domain} · Level {card.level}</p>
                  </div>
                  <button type="button" onClick={() => patch({ domain_cards: draft.domain_cards.filter((item) => item !== card) })}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9c6172]">Step 9</p>
              <h3 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">Create connections</h3>
              <p className="mt-2 text-sm leading-6 text-[#97848b]">Connections are collaborative. Add what you already know, or leave this blank until Session 0.</p>
            </div>
            {creationGuidance && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#957681]">
                  Character guide prompts
                </p>
                <div className="grid gap-2 lg:grid-cols-3">
                  {creationGuidance.connectionQuestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => addNarrativePrompt("connections", prompt)}
                      className="rounded-xl border border-[#3b2730] bg-black/15 p-3 text-left text-xs leading-5 text-[#b39ea5] transition hover:border-[#704052] hover:bg-[#26131b]"
                    >
                      + {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(draft.connections.length ? draft.connections : [""]).map((item, index) => (
              <div key={index} className="flex gap-2">
                <textarea
                  className={`${fieldClass} min-h-24`}
                  placeholder="Connection to another character…"
                  value={item}
                  onChange={(e) => {
                    const next = draft.connections.length ? [...draft.connections] : [""];
                    next[index] = e.target.value;
                    patch({ connections: next });
                  }}
                />
                <button type="button" className={buttonClass} onClick={() => patch({ connections: draft.connections.filter((_, i) => i !== index) })}>×</button>
              </div>
            ))}
            <button type="button" className={buttonClass} onClick={() => patch({ connections: [...draft.connections, ""] })}>+ Connection</button>

            <div className="rounded-2xl border border-[#4c2d38] bg-[#251019] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b47284]">Ready for the Mists</p>
              <p className="mt-2 text-sm leading-6 text-[#bda9af]">
                {draft.name} · {selectedClass?.label ?? "No class"} · {draft.ancestry_key ?? "No ancestry"} / {draft.community_key ?? "No community"} · {draft.domain_cards.length} Domain Cards
              </p>
            </div>
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#332129] pt-5">
          <button type="button" onClick={back} disabled={step === 0} className={buttonClass}>
            ← Back
          </button>
          <span className="text-xs text-[#76636a]">Step {step + 1} of {stepNames.length}</span>
          {step < stepNames.length - 1 ? (
            <button type="button" onClick={next} className={buttonClass}>
              Continue →
            </button>
          ) : (
            <button type="button" onClick={finish} disabled={saving} className="min-h-11 rounded-xl border border-[#a9556d] bg-[#70253b] px-5 text-sm font-black text-[#f7e2e8] transition hover:bg-[#833149] disabled:opacity-50">
              {saving ? "Creating…" : "Create character"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
