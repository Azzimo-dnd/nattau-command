import {
  daggerheartSourceId,
  type DaggerheartEffect,
  type DaggerheartEffectState,
} from "@/lib/daggerheart/effects";

export type DaggerheartActionScope = "owned" | "equipped" | "loadout";
export type DaggerheartActionReset = "scene" | "rest" | "long_rest" | "session";
export type DaggerheartActionResource = "hope" | "stress" | "hp" | "armor";

export type DaggerheartActionRoll = {
  count: number;
  die: number;
  bonus?: number;
};

export type DaggerheartActionResult = {
  type: "clear";
  resource: "hp" | "stress" | "armor";
  amount?: number;
  roll?: DaggerheartActionRoll;
};

export type DaggerheartAction = {
  id: string;
  label: string;
  description?: string;
  scope: DaggerheartActionScope;
  availability?: "during_rest" | "anytime";
  cost?: {
    hope?: number;
    stress?: number;
    armor?: number;
  };
  limit?: {
    uses: number;
    reset: DaggerheartActionReset;
  };
  results?: DaggerheartActionResult[];
  consume_quantity?: number;
  activate_effect_id?: string;
};

export type DaggerheartActionGearItem = {
  instance_id?: string;
  compendium_id?: string;
  slug?: string;
  name: string;
  category?: string;
  equipped?: boolean;
  quantity?: number;
  effects?: DaggerheartEffect[];
  actions?: DaggerheartAction[];
};

export type DaggerheartActionDomainCard = {
  compendium_id?: string;
  slug?: string;
  name: string;
  domain: string;
  state: "loadout" | "vault";
  effects?: DaggerheartEffect[];
  actions?: DaggerheartAction[];
};

export type DaggerheartActionCharacter = {
  weapons: DaggerheartActionGearItem[];
  armor: DaggerheartActionGearItem[];
  inventory: DaggerheartActionGearItem[];
  domain_cards: DaggerheartActionDomainCard[];
  hope_current: number;
  hope_max: number;
  hp_current: number;
  hp_max: number;
  stress_current: number;
  stress_max: number;
  armor_slots_current: number;
  armor_slots_max: number;
  effect_state?: DaggerheartEffectState;
};

export type DaggerheartActionSource = {
  source_key: string;
  source_name: string;
  collection: "weapons" | "armor" | "inventory" | "domain_cards";
  index: number;
  action: DaggerheartAction;
  action_key: string;
  active: boolean;
  quantity: number | null;
  effects: DaggerheartEffect[];
};

export type DaggerheartActionResolution = {
  ok: boolean;
  error?: string;
  patch?: {
    hope_current: number;
    hp_current: number;
    stress_current: number;
    armor_slots_current: number;
    effect_state: DaggerheartEffectState;
  };
  roll_messages?: string[];
  consume_quantity?: number;
};

function sourceActionActive(
  item: DaggerheartActionGearItem | DaggerheartActionDomainCard,
  action: DaggerheartAction,
  collection: DaggerheartActionSource["collection"]
) {
  if (action.scope === "owned") return true;
  if (action.scope === "loadout") {
    return collection === "domain_cards" && "state" in item && item.state === "loadout";
  }
  if (action.scope === "equipped") {
    return collection !== "domain_cards" && "equipped" in item && item.equipped !== false;
  }
  return false;
}

export function collectDaggerheartActions(
  character: DaggerheartActionCharacter
): DaggerheartActionSource[] {
  const sources: DaggerheartActionSource[] = [];

  const collectGear = (
    collection: "weapons" | "armor" | "inventory",
    items: DaggerheartActionGearItem[],
    prefix: string
  ) => {
    items.forEach((item, index) => {
      const sourceKey = daggerheartSourceId(item, prefix);
      for (const action of item.actions ?? []) {
        sources.push({
          source_key: sourceKey,
          source_name: item.name,
          collection,
          index,
          action,
          action_key: `${sourceKey}:action:${action.id}`,
          active: sourceActionActive(item, action, collection),
          quantity: item.quantity ?? null,
          effects: item.effects ?? [],
        });
      }
    });
  };

  collectGear("weapons", character.weapons, "weapon");
  collectGear("armor", character.armor, "armor");
  collectGear("inventory", character.inventory, "inventory");

  character.domain_cards.forEach((card, index) => {
    const sourceKey = daggerheartSourceId(card, "card");
    for (const action of card.actions ?? []) {
      sources.push({
        source_key: sourceKey,
        source_name: card.name,
        collection: "domain_cards",
        index,
        action,
        action_key: `${sourceKey}:action:${action.id}`,
        active: sourceActionActive(card, action, "domain_cards"),
        quantity: null,
        effects: card.effects ?? [],
      });
    }
  });

  return sources;
}

export function actionUses(
  effectState: DaggerheartEffectState | undefined,
  actionKey: string
) {
  return effectState?.action_uses?.[actionKey] ?? 0;
}

export function actionAvailable(
  character: DaggerheartActionCharacter,
  source: DaggerheartActionSource
) {
  if (!source.active) {
    return { ok: false, reason: "Source is not active." };
  }

  if (
    source.quantity !== null &&
    source.action.consume_quantity &&
    source.quantity < source.action.consume_quantity
  ) {
    return { ok: false, reason: "No uses remaining." };
  }

  const used = actionUses(character.effect_state, source.action_key);
  if (source.action.limit && used >= source.action.limit.uses) {
    return {
      ok: false,
      reason: `Used until ${source.action.limit.reset.replaceAll("_", " ")} reset.`,
    };
  }

  const cost = source.action.cost;
  if ((cost?.hope ?? 0) > character.hope_current) {
    return { ok: false, reason: "Not enough Hope." };
  }
  if (
    character.stress_current + (cost?.stress ?? 0) >
    character.stress_max
  ) {
    return { ok: false, reason: "Not enough unmarked Stress slots." };
  }
  if (
    character.armor_slots_current + (cost?.armor ?? 0) >
    character.armor_slots_max
  ) {
    return { ok: false, reason: "Not enough unmarked Armor Slots." };
  }

  return { ok: true as const };
}

function secureRoll(die: number) {
  if (die <= 0) return 0;
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return (values[0] % die) + 1;
  }
  return Math.floor(Math.random() * die) + 1;
}

function rollAmount(roll: DaggerheartActionRoll) {
  let total = roll.bonus ?? 0;
  for (let i = 0; i < Math.max(0, roll.count); i += 1) {
    total += secureRoll(roll.die);
  }
  return Math.max(0, total);
}

export function resolveDaggerheartAction(
  character: DaggerheartActionCharacter,
  source: DaggerheartActionSource
): DaggerheartActionResolution {
  const availability = actionAvailable(character, source);
  if (!availability.ok) {
    return { ok: false, error: availability.reason };
  }

  const cost = source.action.cost ?? {};
  let hope = character.hope_current - (cost.hope ?? 0);
  let stress = character.stress_current + (cost.stress ?? 0);
  let hp = character.hp_current;
  let armor = character.armor_slots_current;
  const rollMessages: string[] = [];

  for (const result of source.action.results ?? []) {
    const amount = result.roll ? rollAmount(result.roll) : result.amount ?? 0;
    if (result.resource === "hp") hp = Math.max(0, hp - amount);
    if (result.resource === "stress") stress = Math.max(0, stress - amount);
    if (result.resource === "armor") armor = Math.max(0, armor - amount);

    const expression = result.roll
      ? `${result.roll.count}d${result.roll.die}${(result.roll.bonus ?? 0) > 0 ? `+${result.roll.bonus}` : ""}`
      : String(amount);
    rollMessages.push(
      `${source.action.label}: ${expression} → ${amount} ${result.resource} cleared`
    );
  }

  const currentState = character.effect_state ?? {};
  const activeIds = new Set(currentState.active_effect_ids ?? []);

  if (source.action.activate_effect_id) {
    const matchingEffect = source.effects.find(
      (effect) => effect.id === source.action.activate_effect_id
    );
    if (matchingEffect) {
      activeIds.add(`${source.source_key}:${matchingEffect.id}`);
    }
  }

  const uses = { ...(currentState.action_uses ?? {}) };
  if (source.action.limit) {
    uses[source.action_key] = (uses[source.action_key] ?? 0) + 1;
  }

  return {
    ok: true,
    patch: {
      hope_current: Math.max(0, hope),
      hp_current: Math.min(character.hp_max, hp),
      stress_current: Math.min(character.stress_max, stress),
      armor_slots_current: Math.min(character.armor_slots_max, armor),
      effect_state: {
        ...currentState,
        active_effect_ids: [...activeIds],
        action_uses: uses,
      },
    },
    roll_messages: rollMessages,
    consume_quantity: source.action.consume_quantity,
  };
}

export function resetDaggerheartActionUses(
  effectState: DaggerheartEffectState,
  reset: DaggerheartActionReset,
  sources: DaggerheartActionSource[]
) {
  const uses = { ...(effectState.action_uses ?? {}) };
  const resets: DaggerheartActionReset[] =
    reset === "long_rest"
      ? ["scene", "rest", "long_rest"]
      : reset === "rest"
        ? ["scene", "rest"]
        : reset === "session"
          ? ["scene", "rest", "long_rest", "session"]
          : ["scene"];

  for (const source of sources) {
    if (source.action.limit && resets.includes(source.action.limit.reset)) {
      delete uses[source.action_key];
    }
  }

  return { ...effectState, action_uses: uses };
}
