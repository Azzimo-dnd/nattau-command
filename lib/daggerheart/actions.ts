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
  type: "clear" | "gain";
  resource: "hope" | "hp" | "stress" | "armor";
  amount?: number;
  all?: boolean;
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
    special_resource?: {
      name: string;
      amount: number;
    };
  };
  limit?: {
    uses: number;
    reset: DaggerheartActionReset;
  };
  results?: DaggerheartActionResult[];
  consume_quantity?: number;
  activate_effect_id?: string;
  activate_effect_ids?: string[];
  activate_effect_roll?: DaggerheartActionRoll;
  deactivate_effect_id?: string;
  deactivate_effect_ids?: string[];
  feature?: string;
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

export type DaggerheartActionIntrinsicSource = {
  id: string;
  name: string;
  actions?: DaggerheartAction[];
  effects?: DaggerheartEffect[];
};

export type DaggerheartActionSpecialResource = {
  name: string;
  current: number;
  max: number;
  notes: string;
};

export type DaggerheartActionCharacter = {
  weapons: DaggerheartActionGearItem[];
  armor: DaggerheartActionGearItem[];
  inventory: DaggerheartActionGearItem[];
  domain_cards: DaggerheartActionDomainCard[];
  intrinsic_sources?: DaggerheartActionIntrinsicSource[];
  special_resources: DaggerheartActionSpecialResource[];
  consumable_clear_bonus?: number;
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
  collection: "weapons" | "armor" | "inventory" | "domain_cards" | "intrinsic";
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
    special_resources?: DaggerheartActionSpecialResource[];
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

  character.intrinsic_sources?.forEach((item, index) => {
    const sourceKey = item.id;
    for (const action of item.actions ?? []) {
      sources.push({
        source_key: sourceKey,
        source_name: item.name,
        collection: "intrinsic",
        index,
        action,
        action_key: `${sourceKey}:action:${action.id}`,
        active: true,
        quantity: null,
        effects: item.effects ?? [],
      });
    }
  });

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
  if (cost?.special_resource) {
    const resource = character.special_resources.find(
      (item) =>
        item.name.toLowerCase() === cost.special_resource?.name.toLowerCase()
    );
    if (!resource || resource.current < cost.special_resource.amount) {
      return {
        ok: false,
        reason: `Not enough ${cost.special_resource.name}.`,
      };
    }
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
  let armor = character.armor_slots_current + (cost.armor ?? 0);
  const specialResources = character.special_resources.map((item) => ({ ...item }));
  if (cost.special_resource) {
    const index = specialResources.findIndex(
      (item) =>
        item.name.toLowerCase() === cost.special_resource?.name.toLowerCase()
    );
    if (index >= 0) {
      specialResources[index] = {
        ...specialResources[index],
        current: Math.max(
          0,
          specialResources[index].current - cost.special_resource.amount
        ),
      };
    }
  }
  const rollMessages: string[] = [];

  for (const result of source.action.results ?? []) {
    const currentForResource =
      result.resource === "hope"
        ? hope
        : result.resource === "hp"
          ? hp
          : result.resource === "stress"
            ? stress
            : armor;
    const maxForResource =
      result.resource === "hope"
        ? character.hope_max
        : result.resource === "hp"
          ? character.hp_max
          : result.resource === "stress"
            ? character.stress_max
            : character.armor_slots_max;
    let amount = result.all
      ? result.type === "clear"
        ? currentForResource
        : Math.max(0, maxForResource - currentForResource)
      : result.roll
        ? rollAmount(result.roll)
        : result.amount ?? 0;
    if (
      result.type === "clear" &&
      source.collection === "inventory" &&
      (source.action.consume_quantity ?? 0) > 0 &&
      (result.resource === "hp" || result.resource === "stress") &&
      amount > 0
    ) {
      amount += Math.max(0, character.consumable_clear_bonus ?? 0);
    }
    if (result.type === "clear") {
      if (result.resource === "hp") hp = Math.max(0, hp - amount);
      if (result.resource === "stress") stress = Math.max(0, stress - amount);
      if (result.resource === "armor") armor = Math.max(0, armor - amount);
      if (result.resource === "hope") hope = Math.max(0, hope - amount);
    } else {
      if (result.resource === "hope") hope = Math.min(character.hope_max, hope + amount);
      if (result.resource === "hp") hp = Math.min(character.hp_max, hp + amount);
      if (result.resource === "stress") stress = Math.min(character.stress_max, stress + amount);
      if (result.resource === "armor") armor = Math.min(character.armor_slots_max, armor + amount);
    }

    const expression = result.roll
      ? `${result.roll.count}d${result.roll.die}${(result.roll.bonus ?? 0) > 0 ? `+${result.roll.bonus}` : ""}`
      : String(amount);
    rollMessages.push(
      `${source.action.label}: ${expression} → ${amount} ${result.resource} ${result.type === "clear" ? "cleared" : "gained"}`
    );
  }

  const currentState = character.effect_state ?? {};
  const activeIds = new Set(currentState.active_effect_ids ?? []);
  const activeValues = { ...(currentState.active_effect_values ?? {}) };

  const activateIds = [
    ...(source.action.activate_effect_id ? [source.action.activate_effect_id] : []),
    ...(source.action.activate_effect_ids ?? []),
  ];
  let rolledActivation: number | null = null;
  if (source.action.activate_effect_roll && activateIds.length > 0) {
    rolledActivation = rollAmount(source.action.activate_effect_roll);
    const expression = `${source.action.activate_effect_roll.count}d${source.action.activate_effect_roll.die}${(source.action.activate_effect_roll.bonus ?? 0) > 0 ? `+${source.action.activate_effect_roll.bonus}` : ""}`;
    rollMessages.push(`${source.action.label}: ${expression} → temporary effect +${rolledActivation}`);
  }
  for (const id of activateIds) {
    const matchingEffect = source.effects.find((effect) => effect.id === id);
    if (!matchingEffect) continue;
    const effectKey = `${source.source_key}:${matchingEffect.id}`;
    activeIds.add(effectKey);
    if (rolledActivation !== null) activeValues[effectKey] = rolledActivation;
  }

  const deactivateIds = [
    ...(source.action.deactivate_effect_id ? [source.action.deactivate_effect_id] : []),
    ...(source.action.deactivate_effect_ids ?? []),
  ];
  for (const id of deactivateIds) {
    const effectKey = `${source.source_key}:${id}`;
    activeIds.delete(effectKey);
    delete activeValues[effectKey];
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
        active_effect_values: activeValues,
        action_uses: uses,
      },
      special_resources: specialResources,
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

  const activeIds = new Set(effectState.active_effect_ids ?? []);
  const activeValues = { ...(effectState.active_effect_values ?? {}) };

  for (const source of sources) {
    if (source.action.limit && resets.includes(source.action.limit.reset)) {
      delete uses[source.action_key];
      for (const id of [
        ...(source.action.activate_effect_id ? [source.action.activate_effect_id] : []),
        ...(source.action.activate_effect_ids ?? []),
      ]) {
        const effectKey = `${source.source_key}:${id}`;
        activeIds.delete(effectKey);
        delete activeValues[effectKey];
      }
    }
  }

  return {
    ...effectState,
    active_effect_ids: [...activeIds],
    active_effect_values: activeValues,
    action_uses: uses,
  };
}
