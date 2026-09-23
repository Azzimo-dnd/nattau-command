"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DaggerheartCompendiumPicker, compendiumEntryDetails } from "@/components/daggerheart/DaggerheartCompendiumPicker";
import {
  compendiumEffectiveMetadata,
  type DaggerheartCompendiumEntry,
} from "@/lib/daggerheart/compendium";
import { DaggerheartEffectsPanel } from "@/components/daggerheart/DaggerheartEffectsPanel";
import { DaggerheartActionsPanel } from "@/components/daggerheart/DaggerheartActionsPanel";
import { DaggerheartCombatPanel } from "@/components/daggerheart/DaggerheartCombatPanel";
import { DaggerheartActiveRulesPanel } from "@/components/daggerheart/DaggerheartActiveRulesPanel";
import {
  type DaggerheartAction,
  collectDaggerheartActions,
  resetDaggerheartActionUses,
  resolveDaggerheartAction,
} from "@/lib/daggerheart/actions";
import {
  baseStatsForClass,
  deriveDaggerheartStats,
  spellcastTraitKey,
  effectiveSnapshot,
  type DaggerheartBaseStats,
  type DaggerheartEffect,
  type DaggerheartEffectState,
  type DaggerheartManualStatModifiers,
} from "@/lib/daggerheart/effects";
import { DaggerheartCharacterCreationWizard } from "@/components/daggerheart/DaggerheartCharacterCreationWizard";
import type { HeritageState } from "@/components/daggerheart/DaggerheartHeritageBuilder";
import {
  classOption,
  subclassCompendiumSlug,
  daggerheartAncestries,
  daggerheartClasses,
  daggerheartCommunities,
  daggerheartDomains,
  daggerheartTraits,
  daggerheartTransformations,
} from "@/lib/daggerheart/catalog";

type TraitKey = (typeof daggerheartTraits)[number];
type Traits = Record<TraitKey, number>;
type Experience = { name: string; modifier: number };
type DomainCard = {
  name: string;
  domain: string;
  level: number;
  state: "loadout" | "vault";
  permanent_vault?: boolean;
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
  marked_slots?: number;
  notes?: string;
  pending_rule?: boolean;
};
type Advancement = { level: number; choice: string };
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
type NotesState = { notes?: string; options?: ClassOptionRef[]; [key: string]: unknown };

type CharacterRow = {
  id: string;
  campaign_id: string;
  player_id: string;
  is_active: boolean;
  name: string;
  pronouns: string;
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
  advancements: Advancement[];
  special_resources: Resource[];
  class_state: NotesState;
  subclass_state: NotesState;
  transformation_notes: string;
  description: string;
  notes: string;
  base_stats: DaggerheartBaseStats;
  manual_stat_modifiers: DaggerheartManualStatModifiers;
  effect_state: DaggerheartEffectState;
  state_revision: number;
};

type RosterRow = {
  player_id: string;
  display_name: string;
  member_role: string;
  character_id: string | null;
  character_name: string | null;
  character_level: number | null;
  character_class: string | null;
};

type Props = {
  campaignId: string;
  currentUserId: string;
  isDm: boolean;
};

const inputClass =
  "min-h-11 w-full rounded-xl border border-[#58323f] bg-[#100a0e] px-3 py-2 text-sm text-[#eadfe3] outline-none transition focus:border-[#a34d64] focus:ring-2 focus:ring-[#6e263b]/30";
const smallButton =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#5a3441] bg-[#221219] px-3 text-sm font-semibold text-[#ddbdc6] transition hover:border-[#8b465a] hover:bg-[#321721] disabled:cursor-not-allowed disabled:opacity-50";

function emptyCharacter(campaignId: string, playerId: string): CharacterRow {
  return {
    id: "",
    campaign_id: campaignId,
    player_id: playerId,
    is_active: true,
    name: "",
    pronouns: "",
    level: 1,
    class_key: null,
    subclass_key: null,
    ancestry_key: null,
    community_key: null,
    heritage_state: {},
    transformations: [],
    traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    evasion: 10,
    proficiency: 1,
    hope_current: 2,
    hope_max: 6,
    hp_current: 0,
    hp_max: 0,
    stress_current: 0,
    stress_max: 6,
    armor_score: 0,
    armor_slots_current: 0,
    armor_slots_max: 0,
    major_threshold: 0,
    severe_threshold: 0,
    experiences: [],
    domain_cards: [],
    weapons: [],
    armor: [],
    inventory: [],
    gold: { handfuls: 0, bags: 0, chests: 0 },
    background_answers: [],
    connections: [],
    advancements: [],
    special_resources: [],
    class_state: {},
    subclass_state: {},
    transformation_notes: "",
    description: "",
    notes: "",
    base_stats: baseStatsForClass(null, 1),
    manual_stat_modifiers: {},
    effect_state: { active_effect_ids: [] },
    state_revision: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validCharacterRow(value: unknown): value is CharacterRow {
  if (!isRecord(value)) return false;
  const arrays = [
    "transformations",
    "experiences",
    "domain_cards",
    "weapons",
    "armor",
    "inventory",
    "background_answers",
    "connections",
    "advancements",
    "special_resources",
  ] as const;
  const objects = [
    "heritage_state",
    "traits",
    "gold",
    "class_state",
    "subclass_state",
    "base_stats",
    "manual_stat_modifiers",
    "effect_state",
  ] as const;
  if (arrays.some((key) => !Array.isArray(value[key]))) return false;
  if (objects.some((key) => !isRecord(value[key]))) return false;
  const classState = value.class_state as Record<string, unknown>;
  if ("options" in classState && !Array.isArray(classState.options)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.campaign_id === "string" &&
    typeof value.player_id === "string"
  );
}

function mutableCharacterPayload(character: CharacterRow) {
  return {
    is_active: character.is_active,
    name: character.name.trim(),
    pronouns: character.pronouns.trim(),
    level: character.level,
    class_key: character.class_key,
    subclass_key: character.subclass_key,
    ancestry_key: character.ancestry_key,
    community_key: character.community_key,
    heritage_state: character.heritage_state,
    transformations: character.transformations,
    traits: character.traits,
    base_stats: character.base_stats,
    manual_stat_modifiers: character.manual_stat_modifiers,
    effect_state: character.effect_state,
    evasion: character.evasion,
    proficiency: character.proficiency,
    hope_current: character.hope_current,
    hope_max: character.hope_max,
    hp_current: character.hp_current,
    hp_max: character.hp_max,
    stress_current: character.stress_current,
    stress_max: character.stress_max,
    armor_score: character.armor_score,
    armor_slots_current: character.armor_slots_current,
    armor_slots_max: character.armor_slots_max,
    major_threshold: character.major_threshold,
    severe_threshold: character.severe_threshold,
    experiences: character.experiences,
    domain_cards: character.domain_cards,
    weapons: character.weapons,
    armor: character.armor,
    inventory: character.inventory,
    gold: character.gold,
    background_answers: character.background_answers,
    connections: character.connections,
    advancements: character.advancements,
    special_resources: character.special_resources,
    class_state: character.class_state,
    subclass_state: character.subclass_state,
    transformation_notes: character.transformation_notes,
    description: character.description,
    notes: character.notes,
  };
}

function activeClassOptionSources(
  state: NotesState,
  classKey: string | null,
  subclassKey: string | null
) {
  const options = state.options ?? [];
  const activeBeastformId =
    typeof state.active_beastform_id === "string" ? state.active_beastform_id : null;
  const activeStanceId =
    typeof state.active_stance_id === "string" ? state.active_stance_id : null;

  return options
    .filter(
      (option) =>
        (classKey === "druid" &&
          option.category === "beastform" &&
          option.id === activeBeastformId) ||
        (classKey === "brawler" &&
          subclassKey === "martial-artist" &&
          option.category === "martial_stance" &&
          option.id === activeStanceId)
    )
    .map((option) => ({
      id: `class-option:${option.id}`,
      name: option.name,
      category: option.category,
      details: option.details,
      effects: option.effects ?? [],
      actions: option.actions ?? [],
      metadata: option.metadata ?? {},
    }));
}

function managedSpecialResources(
  resources: Resource[],
  classKey: string | null,
  subclassKey: string | null
) {
  const unmanaged = resources.filter(
    (resource) => !["favor", "focus"].includes(resource.name.toLowerCase())
  );
  if (classKey === "warlock") {
    const existing = resources.find(
      (resource) => resource.name.toLowerCase() === "favor"
    );
    unmanaged.push(
      existing ?? {
        name: "Favor",
        current: 3,
        max: 6,
        notes: "Patron Die d6 (d8 at level 5)",
      }
    );
  }
  if (classKey === "brawler" && subclassKey === "martial-artist") {
    const existing = resources.find(
      (resource) => resource.name.toLowerCase() === "focus"
    );
    unmanaged.push(
      existing ?? {
        name: "Focus",
        current: 0,
        max: 6,
        notes: "Spend 1 Focus to shift into a known martial stance.",
      }
    );
  }
  return unmanaged;
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const relicNames = new Set([
  "Stride Relic",
  "Bolster Relic",
  "Control Relic",
  "Attune Relic",
  "Charm Relic",
  "Enlighten Relic",
]);

function gearBurden(item: Pick<GearItem, "metadata">) {
  return String(item.metadata?.burden ?? "").toLowerCase();
}

function isTwoHanded(item: Pick<GearItem, "metadata">) {
  return gearBurden(item).includes("two");
}

function isMagicWeapon(item: Pick<GearItem, "metadata">) {
  return String(item.metadata?.weapon_kind ?? "").toLowerCase() === "magic";
}

function equipmentConfigurationError(character: CharacterRow) {
  const equippedPrimary = character.weapons.find(
    (item) => item.category === "weapon_primary" && item.equipped !== false
  );
  const equippedSecondary = character.weapons.find(
    (item) => item.category === "weapon_secondary" && item.equipped !== false
  );
  if (equippedPrimary && isTwoHanded(equippedPrimary) && equippedSecondary) {
    return "A two-handed primary weapon cannot be used with an equipped secondary weapon.";
  }
  const equippedRelics = character.inventory.filter(
    (item) => relicNames.has(item.name) && item.equipped === true
  );
  if (equippedRelics.length > 1) {
    return "Only one Relic can be equipped at a time.";
  }
  const spellcast = spellcastTraitKey(character);
  const illegalMagic = character.weapons.find(
    (item) =>
      item.equipped !== false &&
      isMagicWeapon(item) &&
      !spellcast
  );
  if (illegalMagic) {
    return `${illegalMagic.name} is a magic weapon and requires a Spellcast trait.`;
  }
  return null;
}

function gearFromCompendium(
  entry: DaggerheartCompendiumEntry,
  equipped: boolean
): GearItem {
  return {
    instance_id: crypto.randomUUID(),
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
    equipped,
    quantity: 1,
    marked_slots: entry.category === "armor" ? 0 : undefined,
    notes: "",
    pending_rule: false,
  };
}

function addEquippedGear(
  current: GearItem[],
  entry: DaggerheartCompendiumEntry
) {
  const added = gearFromCompendium(entry, true);
  const addedTwoHanded =
    entry.category === "weapon_primary" && isTwoHanded(added);
  const blockedSecondary =
    entry.category === "weapon_secondary" &&
    current.some(
      (item) =>
        item.category === "weapon_primary" &&
        item.equipped !== false &&
        isTwoHanded(item)
    );

  const next = current.map((item) => {
    if (item.category === entry.category) return { ...item, equipped: false };
    if (addedTwoHanded && item.category === "weapon_secondary") {
      return { ...item, equipped: false };
    }
    return item;
  });
  return [...next, { ...added, equipped: blockedSecondary ? false : true }];
}

function syncEquippedArmorMarks(armor: GearItem[], markedSlots: number) {
  return armor.map((item) =>
    item.equipped !== false && item.category === "armor"
      ? { ...item, marked_slots: Math.max(0, markedSlots) }
      : item
  );
}

function equippedArmorMarks(armor: GearItem[]) {
  return (
    armor.find((item) => item.category === "armor" && item.equipped !== false)
      ?.marked_slots ?? 0
  );
}

function characterCompendiumIds(character: CharacterRow) {
  return [
    ...character.weapons.map((item) => item.compendium_id),
    ...character.armor.map((item) => item.compendium_id),
    ...character.inventory.map((item) => item.compendium_id),
    ...character.domain_cards.map((card) => card.compendium_id),
    ...(character.class_state.options ?? []).map((option) => option.id),
  ].filter((id): id is string => Boolean(id));
}

function hydrateCharacterCompendium(
  character: CharacterRow,
  entries: Map<string, DaggerheartCompendiumEntry>
): CharacterRow {
  const hydrateGear = (item: GearItem): GearItem => {
    if (!item.compendium_id) return item;
    const entry = entries.get(item.compendium_id);
    if (!entry) return item;
    return {
      ...item,
      name: entry.name,
      details: compendiumEntryDetails(entry),
      category: entry.category,
      slug: entry.slug,
      source_key: entry.source_key,
      tier: entry.tier,
      metadata: compendiumEffectiveMetadata(entry),
      effects: entry.effects ?? [],
      actions: entry.actions ?? [],
    };
  };

  const hydrateClassOption = (option: ClassOptionRef): ClassOptionRef => {
    const entry = entries.get(option.id);
    if (!entry) return option;
    return {
      ...option,
      name: entry.name,
      category: entry.category as ClassOptionRef["category"],
      tier: entry.tier,
      details: compendiumEntryDetails(entry),
      metadata: compendiumEffectiveMetadata(entry),
      effects: entry.effects ?? [],
      actions: entry.actions ?? [],
    };
  };

  const hydrateCard = (card: DomainCard): DomainCard => {
    if (!card.compendium_id) return card;
    const entry = entries.get(card.compendium_id);
    if (!entry) return card;
    return {
      ...card,
      name: entry.name,
      domain: entry.domain ?? card.domain,
      level: entry.level ?? card.level,
      slug: entry.slug,
      source_key: entry.source_key,
      details: compendiumEntryDetails(entry),
      metadata: compendiumEffectiveMetadata(entry),
      effects: entry.effects ?? [],
      actions: entry.actions ?? [],
    };
  };

  return {
    ...character,
    weapons: character.weapons.map(hydrateGear),
    armor: character.armor.map(hydrateGear),
    inventory: character.inventory.map(hydrateGear),
    domain_cards: character.domain_cards.map(hydrateCard),
    class_state: {
      ...character.class_state,
      options: (character.class_state.options ?? []).map(hydrateClassOption),
    },
  };
}

function Section({
  title,
  subtitle,
  children,
  open = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="group rounded-2xl border border-[#3f2630] bg-[#120c10]/85">
      <summary className="cursor-pointer list-none px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-black text-[#ead7dc]">{title}</h3>
            {subtitle && <p className="mt-1 text-xs leading-5 text-[#8f7b82]">{subtitle}</p>}
          </div>
          <span className="text-[#a96577] transition group-open:rotate-180">⌄</span>
        </div>
      </summary>
      <div className="border-t border-[#352129] px-4 py-5 sm:px-5">{children}</div>
    </details>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#91747e]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(toNumber(event.target.value))}
        className={inputClass}
      />
    </label>
  );
}

function StringListEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={item}
            onChange={(event) => {
              const next = [...value];
              next[index] = event.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            className={inputClass}
          />
          <button type="button" className={smallButton} onClick={() => onChange(value.filter((_, i) => i !== index))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className={smallButton} onClick={() => onChange([...value, ""])}>
        + Add
      </button>
    </div>
  );
}

function GearEditor({
  value,
  onChange,
  addLabel,
  equipMode = "none",
}: {
  value: GearItem[];
  onChange: (next: GearItem[]) => void;
  addLabel: string;
  equipMode?: "exclusive-category" | "independent" | "none";
}) {
  function toggleEquipped(index: number) {
    const current = value[index];
    const nextEquipped = !(current.equipped ?? false);
    const next = value.map((item, itemIndex) => {
      if (itemIndex === index) return { ...item, equipped: nextEquipped };
      if (
        nextEquipped &&
        equipMode === "exclusive-category" &&
        item.category === current.category
      ) {
        return { ...item, equipped: false };
      }
      if (
        nextEquipped &&
        relicNames.has(current.name) &&
        relicNames.has(item.name)
      ) {
        return { ...item, equipped: false };
      }
      return item;
    });
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {value.map((item, index) => (
        <div
          key={item.instance_id ?? `${item.name}-${index}`}
          className={`rounded-xl border p-3 transition ${
            item.equipped
              ? "border-[#744052] bg-[#28121b]/70"
              : "border-[#342029] bg-black/15"
          }`}
        >
          <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
            <input
              className={inputClass}
              placeholder="Name"
              value={item.name}
              readOnly={Boolean(item.compendium_id)}
              onChange={(event) => {
                const next = [...value];
                next[index] = { ...item, name: event.target.value };
                onChange(next);
              }}
            />
            <input
              className={inputClass}
              placeholder="Traits, range, damage, feature, burden..."
              value={item.details}
              readOnly={Boolean(item.compendium_id)}
              onChange={(event) => {
                const next = [...value];
                next[index] = { ...item, details: event.target.value };
                onChange(next);
              }}
            />
            <button
              type="button"
              className={smallButton}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>

          {item.compendium_id && (
            <input
              className={`${inputClass} mt-2`}
              placeholder="Instance notes / alias / campaign-specific reminder…"
              value={item.notes ?? ""}
              onChange={(event) => {
                const next = [...value];
                next[index] = { ...item, notes: event.target.value };
                onChange(next);
              }}
            />
          )}
          {item.pending_rule && (
            <p className="mt-2 rounded-lg border border-amber-800/45 bg-amber-950/20 px-2.5 py-1.5 text-[11px] text-amber-100/85">
              Consumed · this rule is still being resolved. Remove the entry after the effect ends.
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {equipMode !== "none" && (
              <button
                type="button"
                className={`min-h-8 rounded-lg border px-3 text-xs font-bold transition ${
                  item.equipped
                    ? "border-emerald-800/60 bg-emerald-950/25 text-emerald-200"
                    : "border-[#49303a] bg-black/20 text-[#9b858c] hover:border-[#704052]"
                }`}
                onClick={() => toggleEquipped(index)}
              >
                {item.equipped ? "Equipped" : "Stored"}
              </button>
            )}
            {(item.effects?.length ?? 0) > 0 && (
              <span className="rounded-lg border border-[#49303a] bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#b78896]">
                {item.effects?.length} dynamic effect{item.effects?.length === 1 ? "" : "s"}
              </span>
            )}
            {(item.actions?.length ?? 0) > 0 && (
              <span className="rounded-lg border border-sky-900/40 bg-sky-950/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200/80">
                {item.actions?.length} quick action{item.actions?.length === 1 ? "" : "s"}
              </span>
            )}
            {item.compendium_id && (
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#6f5c63]">
                Compendium-linked
              </span>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        className={smallButton}
        onClick={() =>
          onChange([
            ...value,
            {
              instance_id: crypto.randomUUID(),
              name: "",
              details: "",
              equipped: false,
              quantity: 1,
              effects: [],
            },
          ])
        }
      >
        + {addLabel}
      </button>
    </div>
  );
}

export function DaggerheartCharacterSheets({ campaignId, currentUserId, isDm }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [intrinsicCatalog, setIntrinsicCatalog] = useState<DaggerheartCompendiumEntry[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(currentUserId);
  const [draft, setDraft] = useState<CharacterRow>(() => emptyCharacter(campaignId, currentUserId));
  const draftRef = useRef(draft);
  const revisionRef = useRef<Map<string, number>>(new Map());
  const runtimeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const runtimeConflictRef = useRef<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [advancedCreation, setAdvancedCreation] = useState(false);
  const [freeLoadoutEditing, setFreeLoadoutEditing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const [rosterResult, characterResult, intrinsicResult] = await Promise.all([
      supabase.rpc("list_daggerheart_character_roster", { p_campaign_id: campaignId }),
      supabase
        .from("daggerheart_characters")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("daggerheart_compendium_entries")
        .select("*")
        .eq("is_active", true)
        .in("category", ["class", "subclass", "ancestry", "community", "transformation"]),
    ]);

    if (rosterResult.error) {
      setMessage(rosterResult.error.message);
      setLoading(false);
      return;
    }
    if (characterResult.error) {
      setMessage(characterResult.error.message);
      setLoading(false);
      return;
    }
    if (intrinsicResult.error) {
      setMessage(intrinsicResult.error.message);
      setLoading(false);
      return;
    }

    setIntrinsicCatalog((intrinsicResult.data ?? []) as DaggerheartCompendiumEntry[]);

    const nextRoster = (rosterResult.data ?? []) as RosterRow[];
    const rawCharacters = characterResult.data ?? [];
    const invalidCharacterCount = rawCharacters.filter(
      (row) => !validCharacterRow(row)
    ).length;
    let nextCharacters = rawCharacters.filter(validCharacterRow).map((row) => ({
      ...row,
      state_revision: Number(row.state_revision ?? 0),
    }));

    if (invalidCharacterCount > 0) {
      setMessage(
        `Skipped ${invalidCharacterCount} malformed character record${invalidCharacterCount === 1 ? "" : "s"}. The bad record was not overwritten.`
      );
    }

    const compendiumIds = [
      ...new Set(nextCharacters.flatMap(characterCompendiumIds)),
    ];
    if (compendiumIds.length > 0) {
      const compendiumResult = await supabase
        .from("daggerheart_compendium_entries")
        .select("*")
        .in("id", compendiumIds);

      if (compendiumResult.error) {
        setMessage(
          `Could not refresh linked compendium rules. Cached definitions are being used: ${compendiumResult.error.message}`
        );
      } else {
        const byId = new Map(
          ((compendiumResult.data ?? []) as DaggerheartCompendiumEntry[]).map(
            (entry) => [entry.id, entry]
          )
        );
        const missingDefinitions = compendiumIds.filter((id) => !byId.has(id));
        if (missingDefinitions.length > 0) {
          setMessage(
            `${missingDefinitions.length} linked compendium definition${missingDefinitions.length === 1 ? "" : "s"} could not be refreshed. Cached rules remain in use for those items.`
          );
        }
        nextCharacters = nextCharacters.map((character) =>
          hydrateCharacterCompendium(character, byId)
        );
      }
    }

    setRoster(nextRoster);
    setCharacters(nextCharacters);
    revisionRef.current = new Map(
      nextCharacters
        .filter((row) => Boolean(row.id))
        .map((row) => [row.id, row.state_revision ?? 0])
    );

    const preferred = isDm
      ? (nextRoster.find((row) => row.player_id === selectedPlayerId)?.player_id ?? nextRoster[0]?.player_id ?? currentUserId)
      : currentUserId;
    setSelectedPlayerId(preferred);
    const preferredDraft =
      nextCharacters.find((row) => row.player_id === preferred) ??
      emptyCharacter(campaignId, preferred);
    draftRef.current = preferredDraft;
    setDraft(preferredDraft);
    setDirty(false);
    setLoading(false);
  }, [campaignId, currentUserId, isDm, selectedPlayerId, supabase]);

  useEffect(() => {
    void load();
    // Initial load only. Selection changes are handled locally below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, currentUserId]);

  function choosePlayer(playerId: string) {
    if (
      dirty &&
      typeof window !== "undefined" &&
      !window.confirm("Discard unsaved character-sheet changes and switch players?")
    ) {
      return;
    }
    setSelectedPlayerId(playerId);
    setMessage(null);
    setAdvancedCreation(false);
    setActionMessage(null);
    const next =
      characters.find((row) => row.player_id === playerId) ??
      emptyCharacter(campaignId, playerId);
    draftRef.current = next;
    setDraft(next);
    setDirty(false);
  }

  const patch = useCallback((patchValue: Partial<CharacterRow>) => {
    setDraft((current) => {
      const next = { ...current, ...patchValue };
      draftRef.current = next;
      return next;
    });
    setDirty(true);
  }, []);

  const selectedIntrinsicSources = useMemo(() => {
    const ancestryFeatures = draft.heritage_state?.mixed
      ? [draft.heritage_state.feature_one, draft.heritage_state.feature_two]
          .filter(Boolean)
          .map((item) => ({ ancestry: item?.ancestry ?? "", feature: item?.name ?? "" }))
      : [];
    const ancestryNames = draft.heritage_state?.mixed
      ? [...new Set(ancestryFeatures.map((item) => item.ancestry).filter(Boolean))]
      : draft.ancestry_key
        ? [draft.ancestry_key]
        : [];

    return intrinsicCatalog
      .filter((entry) => {
        if (entry.category === "class") return entry.slug === draft.class_key;
        if (entry.category === "subclass") {
          return entry.slug === subclassCompendiumSlug(draft.subclass_key);
        }
        if (entry.category === "community") return entry.name === draft.community_key;
        if (entry.category === "transformation") return draft.transformations.includes(entry.name);
        if (entry.category === "ancestry") return ancestryNames.includes(entry.name);
        return false;
      })
      .map((entry) => {
        const filterForHeritage = <T extends { feature?: string }>(items: T[]) => {
          if (entry.category !== "ancestry" || !draft.heritage_state?.mixed) return items;
          const selected = ancestryFeatures
            .filter((item) => item.ancestry === entry.name)
            .map((item) => item.feature);
          return items.filter((item) => Boolean(item.feature) && selected.includes(item.feature ?? ""));
        };
        return {
          id: `intrinsic:${entry.category}:${entry.slug}`,
          name: entry.name,
          category: entry.category,
          details: compendiumEntryDetails(entry),
          effects: filterForHeritage(entry.effects ?? []),
          actions: filterForHeritage(entry.actions ?? []),
        };
      });
  }, [draft.ancestry_key, draft.class_key, draft.community_key, draft.heritage_state, draft.subclass_key, draft.transformations, intrinsicCatalog]);

  const activeClassOptions = useMemo(
    () =>
      activeClassOptionSources(
        draft.class_state,
        draft.class_key,
        draft.subclass_key
      ),
    [draft.class_key, draft.class_state, draft.subclass_key]
  );

  const activeBeastform = useMemo(
    () => activeClassOptions.find((option) => option.category === "beastform") ?? null,
    [activeClassOptions]
  );

  const runtimeCharacter = useMemo(
    () => ({
      ...draft,
      weapons: activeBeastform ? [] : draft.weapons,
      intrinsic_sources: [...selectedIntrinsicSources, ...activeClassOptions],
    }),
    [draft, selectedIntrinsicSources, activeClassOptions, activeBeastform]
  );
  const effectResult = useMemo(
    () => deriveDaggerheartStats(runtimeCharacter),
    [runtimeCharacter]
  );
  const actionCharacter = useMemo(
    () => ({
      ...runtimeCharacter,
      ...effectiveSnapshot(effectResult),
      consumable_clear_bonus: effectResult.stats.consumable_clear_bonus,
      beastform_active: Boolean(activeBeastform),
    }),
    [runtimeCharacter, effectResult]
  );
  const actionSources = useMemo(
    () => collectDaggerheartActions(actionCharacter),
    [actionCharacter]
  );
  const actionControlledEffectKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const source of actionSources) {
      for (const effectId of [
        ...(source.action.activate_effect_id
          ? [source.action.activate_effect_id]
          : []),
        ...(source.action.activate_effect_ids ?? []),
      ]) {
        keys.add(`${source.source_key}:${effectId}`);
      }
    }
    return keys;
  }, [actionSources]);
  const domainLoadoutCount = useMemo(
    () => draft.domain_cards.filter((card) => card.state === "loadout").length,
    [draft.domain_cards]
  );
  const duplicateDomainCardIds = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const card of draft.domain_cards) {
      if (!card.compendium_id) continue;
      if (seen.has(card.compendium_id)) duplicates.add(card.compendium_id);
      seen.add(card.compendium_id);
    }
    return duplicates;
  }, [draft.domain_cards]);
  const equipmentError = useMemo(
    () => equipmentConfigurationError(draft),
    [draft]
  );
  const domainConfigurationValid =
    domainLoadoutCount <= effectResult.stats.domain_loadout_max &&
    duplicateDomainCardIds.size === 0;

  useEffect(() => {
    const snapshot = effectiveSnapshot(effectResult);
    const nextHp = Math.min(draft.hp_current, snapshot.hp_max);
    const nextStress = Math.min(draft.stress_current, snapshot.stress_max);
    const nextHope = Math.min(draft.hope_current, snapshot.hope_max);
    const nextArmorSlots = Math.min(
      draft.armor_slots_current,
      snapshot.armor_slots_max
    );

    if (
      draft.evasion !== snapshot.evasion ||
      draft.proficiency !== snapshot.proficiency ||
      draft.hope_max !== snapshot.hope_max ||
      draft.hp_max !== snapshot.hp_max ||
      draft.stress_max !== snapshot.stress_max ||
      draft.armor_score !== snapshot.armor_score ||
      draft.armor_slots_max !== snapshot.armor_slots_max ||
      draft.major_threshold !== snapshot.major_threshold ||
      draft.severe_threshold !== snapshot.severe_threshold ||
      draft.hp_current !== nextHp ||
      draft.stress_current !== nextStress ||
      draft.hope_current !== nextHope ||
      draft.armor_slots_current !== nextArmorSlots
    ) {
      patch({
        ...snapshot,
        hp_current: nextHp,
        stress_current: nextStress,
        hope_current: nextHope,
        armor_slots_current: nextArmorSlots,
      });
    }
  }, [draft, effectResult, patch]);

  function normalizeRuntimePatch(
    patchValue: Partial<CharacterRow>
  ): Partial<CharacterRow> {
    const nextDraft = { ...draftRef.current, ...patchValue };
    const nextClassOptions = activeClassOptionSources(
      nextDraft.class_state,
      nextDraft.class_key,
      nextDraft.subclass_key
    );
    const nextBeastformActive = nextClassOptions.some(
      (option) => option.category === "beastform"
    );
    const calculated = deriveDaggerheartStats({
      ...nextDraft,
      weapons: nextBeastformActive ? [] : nextDraft.weapons,
      intrinsic_sources: [...selectedIntrinsicSources, ...nextClassOptions],
    });
    const snapshot = effectiveSnapshot(calculated);

    return {
      ...patchValue,
      ...snapshot,
      hope_current: Math.min(
        patchValue.hope_current ?? nextDraft.hope_current,
        snapshot.hope_max
      ),
      hp_current: Math.min(
        patchValue.hp_current ?? nextDraft.hp_current,
        snapshot.hp_max
      ),
      stress_current: Math.min(
        patchValue.stress_current ?? nextDraft.stress_current,
        snapshot.stress_max
      ),
      armor_slots_current: Math.min(
        patchValue.armor_slots_current ?? nextDraft.armor_slots_current,
        snapshot.armor_slots_max
      ),
    };
  }

  function persistRuntimePatch(
    patchValue: Partial<CharacterRow>
  ) {
    const preview = { ...draftRef.current, ...patchValue };
    const previewEquipmentError = equipmentConfigurationError(preview);
    if (previewEquipmentError) {
      setActionMessage(previewEquipmentError);
      return;
    }
    const normalized = normalizeRuntimePatch(patchValue);
    const base = draftRef.current;
    const optimistic: CharacterRow = { ...base, ...normalized };
    draftRef.current = optimistic;
    setDraft((current) =>
      current.id === base.id && current.player_id === base.player_id
        ? optimistic
        : current
    );
    setDirty(true);

    if (!base.id) return;

    const characterId = base.id;
    const playerId = base.player_id;
    const payload = mutableCharacterPayload(optimistic);

    runtimeQueueRef.current = runtimeQueueRef.current.then(async () => {
      if (runtimeConflictRef.current.has(characterId)) return;

      const expectedRevision =
        revisionRef.current.get(characterId) ?? base.state_revision ?? 0;
      const result = await supabase
        .from("daggerheart_characters")
        .update(payload)
        .eq("id", characterId)
        .eq("state_revision", expectedRevision)
        .select("*")
        .maybeSingle();

      if (result.error) {
        setActionMessage(
          `Runtime save failed; local changes were not confirmed: ${result.error.message}`
        );
        return;
      }
      if (!result.data) {
        runtimeConflictRef.current.add(characterId);
        setActionMessage(
          "Character changed in another tab/session. Runtime save stopped to avoid overwriting newer data. Reload the sheet before using more actions."
        );
        return;
      }

      const savedRevision = Number(result.data.state_revision ?? expectedRevision + 1);
      revisionRef.current.set(characterId, savedRevision);
      setCharacters((current) =>
        current.map((row) =>
          row.id === characterId
            ? { ...optimistic, state_revision: savedRevision }
            : row
        )
      );
      setDraft((current) => {
        if (current.id !== characterId || current.player_id !== playerId) {
          return current;
        }
        const next = { ...current, state_revision: savedRevision };
        draftRef.current = next;
        return next;
      });
      setDirty(false);
    });
  }

  async function save() {
    const currentDraft = draftRef.current;
    if (!currentDraft.name.trim()) {
      setMessage("Give the character a name before saving.");
      return;
    }
    const currentEquipmentError = equipmentConfigurationError(currentDraft);
    if (currentEquipmentError) {
      setMessage(currentEquipmentError);
      return;
    }

    const calculated = deriveDaggerheartStats({
      ...currentDraft,
      weapons: activeBeastform ? [] : currentDraft.weapons,
      intrinsic_sources: [...selectedIntrinsicSources, ...activeClassOptions],
    });
    const snapshot = effectiveSnapshot(calculated);
    if (snapshot.major_threshold > snapshot.severe_threshold) {
      setMessage("Major threshold cannot be higher than Severe threshold.");
      return;
    }
    if (duplicateDomainCardIds.size > 0) {
      setMessage("The same compendium Domain Card cannot be added twice.");
      return;
    }
    if (domainLoadoutCount > snapshot.domain_loadout_max) {
      const overflow = domainLoadoutCount - snapshot.domain_loadout_max;
      setMessage(
        `Move ${overflow} Domain Card${overflow === 1 ? "" : "s"} to the Vault before saving. Current Loadout: ${domainLoadoutCount}/${snapshot.domain_loadout_max}.`
      );
      return;
    }

    setSaving(true);
    setMessage(null);

    const normalized: CharacterRow = {
      ...currentDraft,
      ...snapshot,
      hope_current: Math.min(currentDraft.hope_current, snapshot.hope_max),
      hp_current: Math.min(currentDraft.hp_current, snapshot.hp_max),
      stress_current: Math.min(currentDraft.stress_current, snapshot.stress_max),
      armor_slots_current: Math.min(
        currentDraft.armor_slots_current,
        snapshot.armor_slots_max
      ),
    };
    const mutablePayload = mutableCharacterPayload(normalized);
    const requestId = currentDraft.id;
    const requestPlayerId = currentDraft.player_id;

    const result = requestId
      ? await supabase
          .from("daggerheart_characters")
          .update(mutablePayload)
          .eq("id", requestId)
          .eq(
            "state_revision",
            revisionRef.current.get(requestId) ?? currentDraft.state_revision ?? 0
          )
          .select("*")
          .maybeSingle()
      : await supabase
          .from("daggerheart_characters")
          .insert({
            campaign_id: campaignId,
            player_id: requestPlayerId,
            ...mutablePayload,
          })
          .select("*")
          .single();

    if (result.error) {
      setMessage(result.error.message);
      setSaving(false);
      return;
    }
    if (!result.data) {
      runtimeConflictRef.current.add(requestId);
      setMessage(
        "Save conflict: this character changed in another tab/session. Reload before saving again so newer data is not overwritten."
      );
      setSaving(false);
      return;
    }

    const saved = {
      ...(result.data as CharacterRow),
      state_revision: Number(result.data.state_revision ?? 0),
    };
    revisionRef.current.set(saved.id, saved.state_revision);
    runtimeConflictRef.current.delete(saved.id);

    setDraft((current) => {
      const sameRequest =
        (requestId
          ? current.id === requestId
          : !current.id && current.player_id === requestPlayerId) &&
        current.player_id === requestPlayerId;
      if (!sameRequest) return current;
      draftRef.current = saved;
      return saved;
    });
    setCharacters((current) => [
      ...current.filter((row) => row.player_id !== saved.player_id),
      saved,
    ]);
    setRoster((current) =>
      current.map((row) =>
        row.player_id === saved.player_id
          ? {
              ...row,
              character_id: saved.id,
              character_name: saved.name,
              character_level: saved.level,
              character_class: saved.class_key,
            }
          : row
      )
    );
    setMessage("Character sheet saved.");
    setDirty(false);
    setSaving(false);
  }

  const selectedClass = classOption(draft.class_key);
  const canEdit = isDm || selectedPlayerId === currentUserId;

  function setManualModifier(stat: keyof DaggerheartManualStatModifiers, value: number) {
    patch({
      manual_stat_modifiers: {
        ...draft.manual_stat_modifiers,
        [stat]: value,
      },
    });
  }

  function toggleEffects(effectKeys: string[]) {
    if (!domainConfigurationValid) {
      setActionMessage(
        "Resolve the invalid Domain Loadout before activating sheet effects."
      );
      return;
    }
    const active = new Set(draft.effect_state?.active_effect_ids ?? []);
    const values = { ...(draft.effect_state?.active_effect_values ?? {}) };
    const allActive = effectKeys.every((effectKey) => active.has(effectKey));
    const toggleDefinitions = effectResult.toggles.filter((toggle) =>
      effectKeys.includes(toggle.key)
    );
    const permanentChoice = toggleDefinitions.some((toggle) =>
      (toggle.duration ?? "").toLowerCase().includes("permanent once selected")
    );

    if (allActive && permanentChoice) {
      setActionMessage(
        "This is a permanent character choice and cannot be deactivated from normal play."
      );
      return;
    }
    if (
      !allActive &&
      permanentChoice &&
      typeof window !== "undefined" &&
      !window.confirm(
        "This choice becomes permanent once selected. Activate it permanently?"
      )
    ) {
      return;
    }

    for (const effectKey of effectKeys) {
      if (allActive) {
        active.delete(effectKey);
        delete values[effectKey];
      } else {
        active.add(effectKey);
      }
    }

    void persistRuntimePatch({
      effect_state: {
        ...draft.effect_state,
        active_effect_ids: [...active],
        active_effect_values: values,
      },
    });
  }

  function setActiveClassOption(option: ClassOptionRef) {
    if (!domainConfigurationValid) {
      setActionMessage(
        "Resolve the invalid Domain Loadout before changing live combat state."
      );
      return;
    }
    if (option.category === "beastform") {
      if (
        !String(option.metadata?.trait ?? "").trim() ||
        !String(option.metadata?.damage ?? "").trim()
      ) {
        setActionMessage(
          `${option.name} inherits a lower-tier Beastform and needs an explicit base-form configuration before it can be activated.`
        );
        return;
      }
      const current =
        typeof draft.class_state.active_beastform_id === "string"
          ? draft.class_state.active_beastform_id
          : null;
      void persistRuntimePatch({
        class_state: {
          ...draft.class_state,
          active_beastform_id: current === option.id ? null : option.id,
        },
      });
      setActionMessage(
        current === option.id
          ? `${option.name} Beastform cleared.`
          : `${option.name} is now the active Beastform. Use the Druid Beastform action to pay the transformation cost when required.`
      );
      return;
    }

    const current =
      typeof draft.class_state.active_stance_id === "string"
        ? draft.class_state.active_stance_id
        : null;
    if (current === option.id) {
      void persistRuntimePatch({
        class_state: { ...draft.class_state, active_stance_id: null },
      });
      setActionMessage(`${option.name} stance dropped.`);
      return;
    }

    const focusIndex = draft.special_resources.findIndex(
      (resource) => resource.name.toLowerCase() === "focus"
    );
    if (focusIndex < 0 || draft.special_resources[focusIndex].current < 1) {
      setActionMessage("Not enough Focus to shift into this stance.");
      return;
    }

    const resources = draft.special_resources.map((resource, index) =>
      index === focusIndex
        ? { ...resource, current: Math.max(0, resource.current - 1) }
        : resource
    );
    void persistRuntimePatch({
      special_resources: resources,
      class_state: { ...draft.class_state, active_stance_id: option.id },
    });
    setActionMessage(`Spent 1 Focus. ${option.name} is now your active stance.`);
  }

  function changeDomainCardState(
    index: number,
    nextState: DomainCard["state"]
  ) {
    const card = draft.domain_cards[index];
    if (!card || card.state === nextState) return;
    if (card.permanent_vault && nextState === "loadout") {
      setActionMessage(`${card.name} is permanently in the Vault.`);
      return;
    }
    if (
      nextState === "loadout" &&
      domainLoadoutCount >= effectResult.stats.domain_loadout_max
    ) {
      setActionMessage(
        `Loadout is full (${effectResult.stats.domain_loadout_max} cards).`
      );
      return;
    }

    const nextCards = [...draft.domain_cards];
    nextCards[index] = { ...card, state: nextState };

    if (
      nextState === "loadout" &&
      card.state === "vault" &&
      !freeLoadoutEditing
    ) {
      const recallCost = Math.max(
        0,
        Number(card.metadata?.recall_cost ?? 0) || 0
      );
      if (draft.stress_current + recallCost > effectResult.stats.stress_max) {
        setActionMessage(
          `Not enough unmarked Stress slots to Recall ${card.name}.`
        );
        return;
      }
      persistRuntimePatch({
        domain_cards: nextCards,
        stress_current: draft.stress_current + recallCost,
      });
      setActionMessage(
        recallCost > 0
          ? `Recalled ${card.name}; marked ${recallCost} Stress.`
          : `Recalled ${card.name}.`
      );
      return;
    }

    if (draft.id) {
      persistRuntimePatch({ domain_cards: nextCards });
    } else {
      patch({ domain_cards: nextCards });
    }
  }

  function useResourceAction(source: (typeof actionSources)[number]) {
    if (!domainConfigurationValid) {
      setActionMessage(
        "Resolve the invalid Domain Loadout before using gameplay actions."
      );
      return;
    }
    const resolution = resolveDaggerheartAction(actionCharacter, source);
    if (!resolution.ok || !resolution.patch) {
      setActionMessage(resolution.error ?? "This action cannot be used right now.");
      return;
    }

    const nextPatch: Partial<CharacterRow> = { ...resolution.patch };
    if (typeof resolution.patch.armor_slots_current === "number") {
      nextPatch.armor = syncEquippedArmorMarks(
        draftRef.current.armor,
        resolution.patch.armor_slots_current
      );
    }
    const consume = resolution.consume_quantity ?? 0;

    if (
      consume > 0 &&
      ["weapons", "armor", "inventory"].includes(source.collection)
    ) {
      const collection = source.collection as "weapons" | "armor" | "inventory";
      const current = draft[collection] as GearItem[];
      nextPatch[collection] = current
        .map((item, index) => {
          if (index !== source.index) return item;
          const quantity = Math.max(0, (item.quantity ?? 1) - consume);
          return {
            ...item,
            quantity,
            pending_rule:
              quantity === 0 &&
              Boolean(source.action.preserve_rule_after_use),
          };
        })
        .filter(
          (item) => (item.quantity ?? 1) > 0 || item.pending_rule === true
        ) as CharacterRow[typeof collection];
    }

    void persistRuntimePatch(nextPatch);
    setActionMessage(
      resolution.roll_messages?.length
        ? resolution.roll_messages.join(" · ")
        : `${source.action.label} used.`
    );
  }

  function resetResourceActions(
    reset: Parameters<typeof resetDaggerheartActionUses>[1]
  ) {
    void persistRuntimePatch({
      effect_state: resetDaggerheartActionUses(
        draft.effect_state,
        reset,
        actionSources
      ),
      class_state:
        reset === "session"
          ? draft.class_state
          : {
              ...draft.class_state,
              active_stance_id: null,
            },
    });
    setActionMessage(
      `${reset.replaceAll("_", " ")} uses reset.`
    );
  }

  const equippedActiveWeapons = draft.weapons.filter(
    (item) =>
      ["weapon_primary", "weapon_secondary"].includes(item.category ?? "") &&
      item.equipped !== false
  );
  const brawlerStrike =
    draft.class_key === "brawler" &&
    !activeBeastform &&
    equippedActiveWeapons.length === 0
      ? {
          instance_id: "virtual:brawler-strike",
          name: "Brawler's Strike",
          category: "brawler_strike",
          equipped: true,
          metadata: {
            trait: String(draft.class_state.brawler_strike_trait ?? ""),
            range: "Melee",
            damage: "d8+d6 phy",
            burden: "I Am the Weapon",
          },
        }
      : null;

  if (loading) {
    return <div className="rounded-2xl border border-[#402630] bg-[#120c10]/80 p-6 text-sm text-[#a9969d]">Reading the names written in the Mists…</div>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="self-start rounded-2xl border border-[#402630] bg-[#100a0e]/90 p-3 xl:sticky xl:top-6">
        <p className="px-2 pb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-[#875765]">Party roster</p>
        <div className="space-y-2">
          {roster.map((player) => {
            const active = selectedPlayerId === player.player_id;
            const option = classOption(player.character_class);
            return (
              <button
                key={player.player_id}
                type="button"
                onClick={() => choosePlayer(player.player_id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-[#8b465a] bg-[#421824]/65"
                    : "border-[#352129] bg-black/15 hover:border-[#5d3442]"
                }`}
              >
                <div className="font-semibold text-[#ead7dc]">{player.display_name}</div>
                <div className="mt-1 text-xs text-[#9b858c]">
                  {player.character_name
                    ? `${player.character_name} · Lv. ${player.character_level ?? 1}${option ? ` ${option.label}` : ""}`
                    : "No character sheet yet"}
                </div>
              </button>
            );
          })}
          {roster.length === 0 && <p className="p-3 text-sm text-[#8d7a80]">No active players in Barovia yet.</p>}
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        {message && (
          <p className="rounded-xl border border-[#55303d] bg-black/20 px-3 py-2 text-sm text-[#d8bbc3]">
            {message}
          </p>
        )}
        {!draft.id && canEdit && !advancedCreation && (
          <DaggerheartCharacterCreationWizard
            draft={draft}
            patch={patch}
            onFinish={save}
            onAdvanced={() => setAdvancedCreation(true)}
            saving={saving}
          />
        )}

        {(draft.id || !canEdit || advancedCreation) && (
          <>
        <header className="rounded-2xl border border-[#4a2935] bg-gradient-to-br from-[#2b111a] to-[#100a0e] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#a65a70]">Daggerheart · Core + Hope & Fear</p>
              <h2 className="mt-2 font-serif text-3xl font-black text-[#f0dde2]">
                {draft.name || "Unnamed Wanderer"}
              </h2>
              <p className="mt-2 text-sm text-[#a58f96]">
                {selectedClass ? `${selectedClass.label} · ${selectedClass.domains.join(" + ")}` : "Choose a class to begin."}
              </p>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                {!draft.id && advancedCreation && (
                  <button
                    type="button"
                    onClick={() => setAdvancedCreation(false)}
                    className="min-h-11 rounded-xl border border-[#5c3542] bg-[#241219] px-4 text-sm font-bold text-[#c9adb5] transition hover:bg-[#321720]"
                  >
                    Guided creation
                  </button>
                )}
                <button type="button" onClick={save} disabled={saving || roster.length === 0} className="min-h-11 rounded-xl border border-[#9b4b61] bg-[#6b2438] px-5 font-bold text-[#f6e4e9] transition hover:bg-[#7a2a40] disabled:opacity-50">
                  {saving ? "Saving…" : draft.id ? "Save changes" : "Create character"}
                </button>
              </div>
            )}
          </div>
          {!canEdit && <p className="mt-4 text-xs text-[#88747b]">You can inspect this sheet, but only its player and the Game Master can edit it.</p>}
        </header>

        <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-80">
          <Section title="Identity & Heritage" subtitle="Class, subclass, ancestry, community and Hope & Fear transformations." open>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Character name</span>
                <input className={inputClass} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Pronouns</span>
                <input className={inputClass} value={draft.pronouns} onChange={(e) => patch({ pronouns: e.target.value })} />
              </label>
              <NumberField label="Level" min={1} max={10} value={draft.level} onChange={(level) => patch({ level })} />
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Class</span>
                <select
                  className={inputClass}
                  value={draft.class_key ?? ""}
                  onChange={(e) => {
                    const classKey = e.target.value || null;
                    patch({
                      class_key: classKey,
                      subclass_key: null,
                      base_stats: baseStatsForClass(
                        classKey,
                        draft.base_stats?.proficiency ?? 1
                      ),
                      manual_stat_modifiers: {},
                      effect_state: { active_effect_ids: [] },
                      class_state: {},
                      subclass_state: {},
                      special_resources: managedSpecialResources(
                        draft.special_resources,
                        classKey,
                        null
                      ),
                    });
                  }}
                >
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
                  className={inputClass}
                  value={draft.subclass_key ?? ""}
                  onChange={(e) => {
                    const subclassKey = e.target.value || null;
                    patch({
                      subclass_key: subclassKey,
                      subclass_state: {},
                      special_resources: managedSpecialResources(
                        draft.special_resources,
                        draft.class_key,
                        subclassKey
                      ),
                      class_state:
                        draft.class_key === "brawler"
                          ? {
                              ...draft.class_state,
                              active_stance_id: null,
                            }
                          : draft.class_state,
                    });
                  }}
                >
                  <option value="">Choose subclass</option>
                  {(selectedClass?.subclasses ?? []).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Ancestry</span>
                <select
                  className={inputClass}
                  value={draft.ancestry_key ?? ""}
                  onChange={(e) =>
                    patch({
                      ancestry_key: e.target.value || null,
                      heritage_state: {
                        mixed: false,
                        ancestry_one: e.target.value,
                        display_name: e.target.value,
                      },
                    })
                  }
                >
                  <option value="">Choose ancestry</option>
                  {draft.heritage_state?.mixed && draft.ancestry_key && (
                    <option value={draft.ancestry_key}>{draft.ancestry_key} · Mixed ancestry</option>
                  )}
                  {daggerheartAncestries.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Community</span>
                <select className={inputClass} value={draft.community_key ?? ""} onChange={(e) => patch({ community_key: e.target.value || null })}>
                  <option value="">Choose community</option>
                  {daggerheartCommunities.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#927580]">Transformations · Hope & Fear</p>
              <div className="flex flex-wrap gap-2">
                {daggerheartTransformations.map((item) => {
                  const checked = draft.transformations.includes(item);
                  return (
                    <label key={item} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                      checked ? "border-[#9b4b61] bg-[#4b1928] text-[#f0d6dd]" : "border-[#412731] bg-black/15 text-[#a99098]"
                    }`}>
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
              <textarea
                className={`${inputClass} mt-3 min-h-24`}
                placeholder="Transformation stage, scars, triggers, special notes…"
                value={draft.transformation_notes}
                onChange={(e) => patch({ transformation_notes: e.target.value })}
              />
            </div>
          </Section>

          <Section
            title="Calculated Stats & Effects"
            subtitle="Live totals from class, heritage, equipped gear, Loadout cards, situational effects and GM/homebrew modifiers."
            open
          >
            <DaggerheartEffectsPanel
              result={effectResult}
              manualModifiers={draft.manual_stat_modifiers}
              effectState={draft.effect_state}
              onManualModifierChange={setManualModifier}
              onToggleEffects={toggleEffects}
              actionControlledEffectKeys={actionControlledEffectKeys}
            />
          </Section>

          <Section
            title="Active Weapons"
            subtitle="Equipped weapons use the current trait modifiers, Proficiency and errata-aware weapon data."
          >
            <DaggerheartCombatPanel
              weapons={
                activeBeastform
                  ? [
                      {
                        instance_id: `beastform:${activeBeastform.id}`,
                        name: activeBeastform.name,
                        category: "beastform",
                        equipped: true,
                        metadata: activeBeastform.metadata,
                      },
                    ]
                  : brawlerStrike
                    ? [...draft.weapons, brawlerStrike]
                    : draft.weapons
              }
              stats={effectResult.stats}
              level={draft.level}
            />
          </Section>

          <Section
            title="Actions & Resources"
            subtitle="Use consumables and abilities directly from the sheet. Costs, marked tracks, use limits and linked temporary effects update automatically."
          >
            <DaggerheartActionsPanel
              character={actionCharacter}
              sources={actionSources}
              lastMessage={actionMessage}
              onUse={useResourceAction}
              onReset={resetResourceActions}
            />
          </Section>

          <Section
            title="Active Rules Reference"
            subtitle="Full linked rules for your current Loadout, equipped gear and carried compendium items."
          >
            <DaggerheartActiveRulesPanel
              intrinsicRules={[...selectedIntrinsicSources, ...activeClassOptions]}
              domainCards={draft.domain_cards}
              weapons={draft.weapons}
              armor={draft.armor}
              inventory={draft.inventory}
            />
          </Section>

          <Section
            title="Traits & Core Tracks"
            subtitle="Base character values and marked resources. Temporary and equipment modifiers are calculated above."
            open
          >
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#8f717a]">
                Character traits
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {daggerheartTraits.map((trait) => {
                  const effective = effectResult.stats[trait];
                  const base = draft.traits[trait] ?? 0;
                  return (
                    <div key={trait}>
                      <NumberField
                        label={`${trait} base`}
                        value={base}
                        onChange={(value) =>
                          patch({ traits: { ...draft.traits, [trait]: value } })
                        }
                      />
                      {effective !== base && (
                        <p className="mt-1 text-center text-[10px] font-bold text-[#b98191]">
                          Current {effective > 0 ? "+" : ""}
                          {effective}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#8f717a]">
                Marked resources
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <NumberField
                  label={`Hope · max ${effectResult.stats.hope_max}`}
                  min={0}
                  max={effectResult.stats.hope_max}
                  value={draft.hope_current}
                  onChange={(hope_current) => patch({ hope_current })}
                />
                <NumberField
                  label={`HP marked · max ${effectResult.stats.hp_max}`}
                  min={0}
                  max={effectResult.stats.hp_max}
                  value={draft.hp_current}
                  onChange={(hp_current) =>
                    patch({
                      hp_current,
                      class_state:
                        hp_current >= effectResult.stats.hp_max &&
                        effectResult.stats.hp_max > 0
                          ? {
                              ...draft.class_state,
                              active_beastform_id: null,
                              active_stance_id: null,
                            }
                          : draft.class_state,
                    })
                  }
                />
                <NumberField
                  label={`Stress marked · max ${effectResult.stats.stress_max}`}
                  min={0}
                  max={effectResult.stats.stress_max}
                  value={draft.stress_current}
                  onChange={(stress_current) => patch({ stress_current })}
                />
                <NumberField
                  label={`Armor marked · max ${effectResult.stats.armor_slots_max}`}
                  min={0}
                  max={effectResult.stats.armor_slots_max}
                  value={draft.armor_slots_current}
                  onChange={(armor_slots_current) =>
                    patch({
                      armor_slots_current,
                      armor: syncEquippedArmorMarks(
                        draft.armor,
                        armor_slots_current
                      ),
                    })
                  }
                />
              </div>
            </div>

            <details className="group mt-6 rounded-xl border border-[#38242c] bg-black/15">
              <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#977985]">
                Base progression values · advanced
              </summary>
              <div className="grid gap-3 border-t border-[#302028] p-4 md:grid-cols-3 xl:grid-cols-5">
                <NumberField
                  label="Base Evasion"
                  value={draft.base_stats?.evasion ?? 10}
                  onChange={(evasion) =>
                    patch({ base_stats: { ...draft.base_stats, evasion } })
                  }
                />
                <NumberField
                  label="Base Proficiency"
                  min={0}
                  value={draft.base_stats?.proficiency ?? 1}
                  onChange={(proficiency) =>
                    patch({ base_stats: { ...draft.base_stats, proficiency } })
                  }
                />
                <NumberField
                  label="Base HP max"
                  min={0}
                  value={draft.base_stats?.hp_max ?? 0}
                  onChange={(hp_max) =>
                    patch({ base_stats: { ...draft.base_stats, hp_max } })
                  }
                />
                <NumberField
                  label="Base Stress max"
                  min={0}
                  value={draft.base_stats?.stress_max ?? 6}
                  onChange={(stress_max) =>
                    patch({ base_stats: { ...draft.base_stats, stress_max } })
                  }
                />
                <NumberField
                  label="Base Hope max"
                  min={0}
                  value={draft.base_stats?.hope_max ?? 6}
                  onChange={(hope_max) =>
                    patch({ base_stats: { ...draft.base_stats, hope_max } })
                  }
                />
              </div>
            </details>
          </Section>

          <Section title="Experiences" subtitle="Create any Experiences and track their current modifiers.">
            <div className="space-y-3">
              {draft.experiences.map((experience, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
                  <input
                    className={inputClass}
                    placeholder="Experience"
                    value={experience.name}
                    onChange={(e) => {
                      const next = [...draft.experiences];
                      next[index] = { ...experience, name: e.target.value };
                      patch({ experiences: next });
                    }}
                  />
                  <input
                    type="number"
                    className={inputClass}
                    value={experience.modifier}
                    onChange={(e) => {
                      const next = [...draft.experiences];
                      next[index] = { ...experience, modifier: toNumber(e.target.value, 2) };
                      patch({ experiences: next });
                    }}
                  />
                  <button type="button" className={smallButton} onClick={() => patch({ experiences: draft.experiences.filter((_, i) => i !== index) })}>×</button>
                </div>
              ))}
              <button type="button" className={smallButton} onClick={() => patch({ experiences: [...draft.experiences, { name: "", modifier: 2 }] })}>+ Experience</button>
            </div>
          </Section>

          <Section title="Domain Cards" subtitle="Track cards from all ten domains, including Dread. Move cards between Loadout and Vault.">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#38242c] bg-black/15 px-3 py-2 text-xs text-[#a18a92]">
                <span>Active Loadout</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-[#dfc5cd]">
                    {domainLoadoutCount} / {effectResult.stats.domain_loadout_max}
                  </span>
                  <button
                    type="button"
                    className={smallButton}
                    onClick={() => setFreeLoadoutEditing((value) => !value)}
                  >
                    {freeLoadoutEditing
                      ? "Rest / level-up edit: free"
                      : "Gameplay: Recall costs apply"}
                  </button>
                </div>
              </div>
              {duplicateDomainCardIds.size > 0 && (
                <div className="rounded-xl border border-red-800/55 bg-red-950/20 px-3 py-2 text-xs leading-5 text-red-100/90">
                  Duplicate compendium Domain Cards are not allowed. Remove the duplicate before saving or using gameplay actions.
                </div>
              )}
              {domainLoadoutCount > effectResult.stats.domain_loadout_max && (
                <div className="rounded-xl border border-amber-800/55 bg-amber-950/20 px-3 py-2 text-xs leading-5 text-amber-100/90">
                  Loadout exceeds the current limit by{" "}
                  {domainLoadoutCount - effectResult.stats.domain_loadout_max}. Move a card to the Vault before saving.
                </div>
              )}
              <DaggerheartCompendiumPicker
                categories={["domain_card"]}
                label={selectedClass ? `Choose a ${selectedClass.domains.join(" / ")} card…` : "Choose a domain card…"}
                domains={selectedClass?.domains}
                maxLevel={draft.level}
                onSelect={(entry) => {
                  if (
                    draft.domain_cards.some(
                      (card) => card.compendium_id === entry.id
                    )
                  ) {
                    setMessage(`${entry.name} is already on this character.`);
                    return;
                  }
                  const permanentVault = entry.slug === "blade-vitality";
                  patch({
                    domain_cards: [
                      ...draft.domain_cards,
                      {
                        name: entry.name,
                        domain: entry.domain ?? "",
                        level: entry.level ?? 1,
                        state: permanentVault
                          ? "vault"
                          : domainLoadoutCount <
                              effectResult.stats.domain_loadout_max
                            ? "loadout"
                            : "vault",
                        permanent_vault: permanentVault,
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
              {draft.domain_cards.map((card, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-[#342029] bg-black/15 p-3 md:grid-cols-[1.5fr_1fr_90px_120px_auto]">
                  <input className={inputClass} placeholder="Card name" value={card.name} onChange={(e) => {
                    const next = [...draft.domain_cards]; next[index] = { ...card, name: e.target.value }; patch({ domain_cards: next });
                  }} />
                  <select className={inputClass} value={card.domain} onChange={(e) => {
                    const next = [...draft.domain_cards]; next[index] = { ...card, domain: e.target.value }; patch({ domain_cards: next });
                  }}>
                    <option value="">Domain</option>
                    {daggerheartDomains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
                  </select>
                  <input type="number" min={1} max={10} className={inputClass} value={card.level} onChange={(e) => {
                    const next = [...draft.domain_cards]; next[index] = { ...card, level: toNumber(e.target.value, 1) }; patch({ domain_cards: next });
                  }} />
                  <select
                    className={inputClass}
                    value={card.state}
                    onChange={(e) =>
                      changeDomainCardState(
                        index,
                        e.target.value as DomainCard["state"]
                      )
                    }
                  >
                    <option value="loadout" disabled={card.permanent_vault}>
                      Loadout
                    </option>
                    <option value="vault">
                      {card.permanent_vault ? "Permanent Vault" : "Vault"}
                    </option>
                  </select>
                  <button type="button" className={smallButton} onClick={() => patch({ domain_cards: draft.domain_cards.filter((_, i) => i !== index) })}>×</button>
                </div>
              ))}
              <button
                type="button"
                className={smallButton}
                onClick={() =>
                  patch({
                    domain_cards: [
                      ...draft.domain_cards,
                      {
                        name: "",
                        domain: selectedClass?.domains[0] ?? "",
                        level: 1,
                        state:
                          domainLoadoutCount < effectResult.stats.domain_loadout_max
                            ? "loadout"
                            : "vault",
                        effects: [],
                      },
                    ],
                  })
                }
              >
                + Domain card
              </button>
            </div>
          </Section>

          <Section title="Equipment & Loot" subtitle="Weapons, armor and inventory are intentionally open enough to support Core and Hope & Fear equipment without schema changes.">
            <div className="space-y-6">
              {equipmentError && (
                <div className="rounded-xl border border-amber-800/55 bg-amber-950/20 px-3 py-2 text-xs leading-5 text-amber-100/90">
                  {equipmentError}
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#927580]">Weapons</p>
                <div className="mb-3">
                  <DaggerheartCompendiumPicker
                    categories={["weapon_primary", "weapon_secondary"]}
                    label="Choose an eligible weapon…"
                    maxTier={draft.level === 1 ? 1 : draft.level <= 4 ? 2 : draft.level <= 7 ? 3 : 4}
                    allowMagicWeapons={spellcastTraitKey(draft) !== null}
                    onSelect={(entry) =>
                      patch({
                        weapons: addEquippedGear(draft.weapons, entry),
                      })
                    }
                  />
                </div>
                <GearEditor value={draft.weapons} onChange={(weapons) => patch({ weapons })} addLabel="Custom weapon" equipMode="exclusive-category" />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#927580]">Armor</p>
                <div className="mb-3">
                  <DaggerheartCompendiumPicker
                    categories={["armor"]}
                    label="Choose eligible armor…"
                    maxTier={draft.level === 1 ? 1 : draft.level <= 4 ? 2 : draft.level <= 7 ? 3 : 4}
                    onSelect={(entry) =>
                      patch({
                        armor: addEquippedGear(draft.armor, entry),
                        armor_slots_current: 0,
                      })
                    }
                  />
                </div>
                <GearEditor
                  value={draft.armor}
                  onChange={(armor) =>
                    patch({
                      armor,
                      armor_slots_current: equippedArmorMarks(armor),
                    })
                  }
                  addLabel="Custom armor"
                  equipMode="exclusive-category"
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#927580]">Inventory / Loot</p>
                <div className="mb-3">
                  <DaggerheartCompendiumPicker
                    categories={["loot_item", "consumable"]}
                    label="Choose loot or a consumable…"
                    onSelect={(entry) =>
                      patch({
                        inventory: [
                          ...draft.inventory,
                          gearFromCompendium(entry, false),
                        ],
                      })
                    }
                  />
                </div>
                <GearEditor value={draft.inventory} onChange={(inventory) => patch({ inventory })} addLabel="Custom item" equipMode="independent" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <NumberField label="Gold handfuls" min={0} value={draft.gold.handfuls} onChange={(handfuls) => patch({ gold: { ...draft.gold, handfuls } })} />
                <NumberField label="Gold bags" min={0} value={draft.gold.bags} onChange={(bags) => patch({ gold: { ...draft.gold, bags } })} />
                <NumberField label="Gold chests" min={0} value={draft.gold.chests} onChange={(chests) => patch({ gold: { ...draft.gold, chests } })} />
              </div>
            </div>
          </Section>

          <Section title="Class, Subclass & Special Resources" subtitle="Tracks mechanics unique to a build: Favor, Focus, Patron, Martial Stances, beastform notes, subclass choices and future expansion mechanics.">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Class notes / choices</span>
                <textarea className={`${inputClass} min-h-32`} value={draft.class_state?.notes ?? ""} onChange={(e) => patch({ class_state: { ...draft.class_state, notes: e.target.value } })} />
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-[#a48d95]">Subclass notes / choices</span>
                <textarea className={`${inputClass} min-h-32`} value={draft.subclass_state?.notes ?? ""} onChange={(e) => patch({ subclass_state: { ...draft.subclass_state, notes: e.target.value } })} />
              </label>
            </div>
            {(draft.class_key === "druid" ||
              (draft.class_key === "brawler" &&
                draft.subclass_key === "martial-artist")) && (
              <div className="mt-5 space-y-3 rounded-xl border border-[#3a252d] bg-black/15 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#927580]">
                  {draft.class_key === "druid"
                    ? "Beastform quick access"
                    : "Known Martial Stances"}
                </p>
                {draft.class_key === "druid" && (
                  <DaggerheartCompendiumPicker
                    categories={["beastform"]}
                    label="Choose an available Beastform…"
                    maxTier={draft.level === 1 ? 1 : draft.level <= 4 ? 2 : draft.level <= 7 ? 3 : 4}
                    onSelect={(entry) => {
                      const options = draft.class_state.options ?? [];
                      if (options.some((option) => option.id === entry.id)) return;
                      patch({
                        class_state: {
                          ...draft.class_state,
                          options: [
                            ...options,
                            {
                              id: entry.id,
                              name: entry.name,
                              category: "beastform",
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
                )}
                {draft.class_key === "brawler" &&
                  draft.subclass_key === "martial-artist" && (
                    <DaggerheartCompendiumPicker
                      categories={["martial_stance"]}
                      label="Choose an available Martial Stance…"
                      maxTier={draft.level === 1 ? 1 : draft.level <= 4 ? 2 : draft.level <= 7 ? 3 : 4}
                      onSelect={(entry) => {
                        const options = draft.class_state.options ?? [];
                        if (options.some((option) => option.id === entry.id)) return;
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
                  )}

                {(draft.class_state.options ?? []).length > 0 && (
                  <div className="space-y-2">
                    {(draft.class_state.options ?? []).map((option) => (
                      <div
                        key={option.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-[#35232b] bg-black/20 p-3"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[#e2cbd2]">{option.name}</p>
                            {option.tier && (
                              <span className="text-[10px] uppercase tracking-[0.14em] text-[#846c74]">
                                Tier {option.tier}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-5 text-[#967f87]">
                            {option.details}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <button
                            type="button"
                            className={smallButton}
                            onClick={() => setActiveClassOption(option)}
                          >
                            {(option.category === "beastform"
                              ? draft.class_state.active_beastform_id
                              : draft.class_state.active_stance_id) === option.id
                              ? "Active"
                              : option.category === "martial_stance"
                                ? "Shift · 1 Focus"
                                : "Set active"}
                          </button>
                          <button
                            type="button"
                            className={smallButton}
                            onClick={() =>
                              patch({
                                class_state: {
                                  ...draft.class_state,
                                  options: (draft.class_state.options ?? []).filter(
                                    (item) => item.id !== option.id
                                  ),
                                  ...(draft.class_state.active_beastform_id === option.id
                                    ? { active_beastform_id: null }
                                    : {}),
                                  ...(draft.class_state.active_stance_id === option.id
                                    ? { active_stance_id: null }
                                    : {}),
                                },
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {draft.special_resources.map((resource, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-[#342029] bg-black/15 p-3 md:grid-cols-[1fr_90px_90px_2fr_auto]">
                  <input className={inputClass} placeholder="Favor / Focus / Tokens…" value={resource.name} onChange={(e) => {
                    const next = [...draft.special_resources]; next[index] = { ...resource, name: e.target.value }; patch({ special_resources: next });
                  }} />
                  <input type="number" className={inputClass} value={resource.current} onChange={(e) => {
                    const next = [...draft.special_resources]; next[index] = { ...resource, current: toNumber(e.target.value) }; patch({ special_resources: next });
                  }} />
                  <input type="number" className={inputClass} value={resource.max} onChange={(e) => {
                    const next = [...draft.special_resources]; next[index] = { ...resource, max: toNumber(e.target.value) }; patch({ special_resources: next });
                  }} />
                  <input className={inputClass} placeholder="Patron die, active stance, rules reminder…" value={resource.notes} onChange={(e) => {
                    const next = [...draft.special_resources]; next[index] = { ...resource, notes: e.target.value }; patch({ special_resources: next });
                  }} />
                  <button type="button" className={smallButton} onClick={() => patch({ special_resources: draft.special_resources.filter((_, i) => i !== index) })}>×</button>
                </div>
              ))}
              <button type="button" className={smallButton} onClick={() => patch({ special_resources: [...draft.special_resources, { name: "", current: 0, max: 0, notes: "" }] })}>+ Special resource</button>
            </div>
          </Section>

          <Section title="Advancement" subtitle="Permanent level-up choices, including trait increases, extra HP/Stress, proficiency, subclass upgrades and multiclass choices.">
            <div className="space-y-3">
              {draft.advancements.map((advancement, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-[100px_1fr_auto]">
                  <input type="number" min={2} max={10} className={inputClass} value={advancement.level} onChange={(e) => {
                    const next = [...draft.advancements]; next[index] = { ...advancement, level: toNumber(e.target.value, 2) }; patch({ advancements: next });
                  }} />
                  <input className={inputClass} placeholder="Advancement choice / multiclass / subclass upgrade…" value={advancement.choice} onChange={(e) => {
                    const next = [...draft.advancements]; next[index] = { ...advancement, choice: e.target.value }; patch({ advancements: next });
                  }} />
                  <button type="button" className={smallButton} onClick={() => patch({ advancements: draft.advancements.filter((_, i) => i !== index) })}>×</button>
                </div>
              ))}
              <button type="button" className={smallButton} onClick={() => patch({ advancements: [...draft.advancements, { level: Math.max(2, draft.level), choice: "" }] })}>+ Advancement</button>
            </div>
          </Section>

          <Section title="Story" subtitle="Description, background answers and party connections — the bits Strahd will definitely never weaponize against you.">
            <label className="block">
              <span className="mb-1.5 block text-xs text-[#a48d95]">Character description</span>
              <textarea className={`${inputClass} min-h-28`} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
            </label>
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#927580]">Background answers</p>
                <StringListEditor value={draft.background_answers} onChange={(background_answers) => patch({ background_answers })} placeholder="Question / answer / important history…" />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#927580]">Connections</p>
                <StringListEditor value={draft.connections} onChange={(connections) => patch({ connections })} placeholder="Connection to another character…" />
              </div>
            </div>
          </Section>

          <Section title="Notes" subtitle="Anything that does not deserve its own box yet.">
            <textarea className={`${inputClass} min-h-40`} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} />
          </Section>
        </fieldset>

        {canEdit && (
          <div className="flex justify-end pb-6">
            <button type="button" onClick={save} disabled={saving || roster.length === 0} className="min-h-12 rounded-xl border border-[#9b4b61] bg-[#6b2438] px-6 font-bold text-[#f6e4e9] transition hover:bg-[#7a2a40] disabled:opacity-50">
              {saving ? "Saving…" : draft.id ? "Save character sheet" : "Create character sheet"}
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
