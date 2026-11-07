export type DaggerheartEquipmentItem = {
  name: string;
  category?: string;
  equipped?: boolean;
  metadata?: Record<string, unknown>;
};

export function daggerheartEquipmentRulesText(item: {
  rules_text?: string;
  details?: string;
}) {
  // Hydrated rules are authoritative, including equipment with no feature.
  if (typeof item.rules_text === "string") {
    const rules = item.rules_text.trim();
    return /^[—–-]$/.test(rules) ? "" : rules;
  }

  // Older saved sheets keep rules after the stat line in `details`.
  // Prefer the current section if that snapshot also contains original rules.
  const details = item.details?.trim() ?? "";
  const current = details.match(/^Official errata\/current(?: \([^\n]*\))?: ([\s\S]*)$/m);
  const parts = (current?.[1] ?? details).split(" · ");
  while (/^(trait|range|damage|burden|base major|base severe|base score):/i.test(parts[0] ?? "")) {
    parts.shift();
  }
  const rules = parts.join(" · ").trim();
  return /^[—–-]$/.test(rules) ? "" : rules;
}

export const daggerheartRelicNames = new Set([
  "Stride Relic",
  "Bolster Relic",
  "Control Relic",
  "Attune Relic",
  "Charm Relic",
  "Enlighten Relic",
]);

export function daggerheartGearBurden(
  item: Pick<DaggerheartEquipmentItem, "metadata">
) {
  return String(item.metadata?.burden ?? "").toLowerCase();
}

export function daggerheartIsTwoHanded(
  item: Pick<DaggerheartEquipmentItem, "metadata">
) {
  return daggerheartGearBurden(item).includes("two");
}

export function daggerheartIsMagicWeapon(
  item: Pick<DaggerheartEquipmentItem, "metadata">
) {
  return String(item.metadata?.weapon_kind ?? "").toLowerCase() === "magic";
}

export function daggerheartEquipmentConfigurationError({
  weapons,
  armor,
  inventory,
  hasSpellcastTrait,
}: {
  weapons: DaggerheartEquipmentItem[];
  armor: DaggerheartEquipmentItem[];
  inventory: DaggerheartEquipmentItem[];
  hasSpellcastTrait: boolean;
}) {
  const equippedPrimaries = weapons.filter(
    (item) => item.category === "weapon_primary" && item.equipped !== false
  );
  const equippedSecondaries = weapons.filter(
    (item) => item.category === "weapon_secondary" && item.equipped !== false
  );
  const equippedArmor = armor.filter(
    (item) => item.category === "armor" && item.equipped !== false
  );

  if (equippedPrimaries.length > 1) {
    return "Only one primary weapon can be equipped at a time.";
  }
  if (equippedSecondaries.length > 1) {
    return "Only one secondary weapon can be equipped at a time.";
  }
  if (equippedArmor.length > 1) {
    return "Only one armor set can be equipped at a time.";
  }

  const equippedPrimary = equippedPrimaries[0];
  const equippedSecondary = equippedSecondaries[0];
  if (
    equippedPrimary &&
    daggerheartIsTwoHanded(equippedPrimary) &&
    equippedSecondary
  ) {
    return "A two-handed primary weapon cannot be used with an equipped secondary weapon.";
  }

  const equippedRelics = inventory.filter(
    (item) => daggerheartRelicNames.has(item.name) && item.equipped === true
  );
  if (equippedRelics.length > 1) {
    return "Only one Relic can be equipped at a time.";
  }

  const illegalMagic = weapons.find(
    (item) =>
      item.equipped !== false &&
      daggerheartIsMagicWeapon(item) &&
      !hasSpellcastTrait
  );
  if (illegalMagic) {
    return `${illegalMagic.name} is a magic weapon and requires a Spellcast trait.`;
  }

  return null;
}
