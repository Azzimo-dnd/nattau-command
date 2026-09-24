export type DaggerheartEquipmentItem = {
  name: string;
  category?: string;
  equipped?: boolean;
  metadata?: Record<string, unknown>;
};

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
