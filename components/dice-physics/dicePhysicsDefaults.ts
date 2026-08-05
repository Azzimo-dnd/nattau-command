import type {
  CampaignDicePhysicsSettings,
  DiceAppearanceSettings,
  DiceRuntimeSettings,
} from "./dicePhysicsTypes";
import { DEFAULT_DICE_COSMETIC_ID } from "./diceCosmetics";

export const DEFAULT_CAMPAIGN_DICE_PHYSICS: CampaignDicePhysicsSettings = {
  throwForce: 10,
  spinForce: 7.2,
  dieFriction: 0.64,
  trayFriction: 1,
  restitution: 0.6,
  linearDamping: 0.12,
  angularDamping: 0.18,
  gravity: -9.81,
  cockedThreshold: 0.925,
};

export const DEFAULT_DICE_APPEARANCE: DiceAppearanceSettings = {
  cosmeticId: DEFAULT_DICE_COSMETIC_ID,
  numberSize: "large",
  sound: true,
};

export function createDiceRuntimeSettings(
  physics: CampaignDicePhysicsSettings,
  appearance: DiceAppearanceSettings,
  options?: { debug?: boolean; cameraMode?: DiceRuntimeSettings["cameraMode"] }
): DiceRuntimeSettings {
  return {
    ...physics,
    ...appearance,
    debug: options?.debug ?? false,
    cameraMode: options?.cameraMode ?? "table",
  };
}

function finiteOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeCampaignDicePhysics(
  value: Partial<CampaignDicePhysicsSettings> | null | undefined
): CampaignDicePhysicsSettings {
  const defaults = DEFAULT_CAMPAIGN_DICE_PHYSICS;
  return {
    throwForce: clamp(finiteOr(value?.throwForce, defaults.throwForce), 2.8, 14),
    spinForce: clamp(finiteOr(value?.spinForce, defaults.spinForce), 1, 18),
    dieFriction: clamp(finiteOr(value?.dieFriction, defaults.dieFriction), 0.05, 1.5),
    trayFriction: clamp(finiteOr(value?.trayFriction, defaults.trayFriction), 0.05, 1.6),
    restitution: clamp(finiteOr(value?.restitution, defaults.restitution), 0, 0.8),
    linearDamping: clamp(finiteOr(value?.linearDamping, defaults.linearDamping), 0, 1.5),
    angularDamping: clamp(finiteOr(value?.angularDamping, defaults.angularDamping), 0, 2),
    gravity: clamp(finiteOr(value?.gravity, defaults.gravity), -20, -3),
    cockedThreshold: clamp(
      finiteOr(value?.cockedThreshold, defaults.cockedThreshold),
      0.78,
      0.995
    ),
  };
}
