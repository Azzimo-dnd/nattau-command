import type { RolledGroup, SupportedDie } from "./diceUtils";

export const DICE_ANIMATION_MS = 1350;
export const MAX_VISIBLE_DICE = 14;

export type DiceVisualTone =
  | "nattau"
  | "barovia"
  | "hope"
  | "fear"
  | "advantage"
  | "muted";

export type DiceMotion =
  | "drop-left"
  | "drop-center"
  | "drop-right"
  | "duality-left"
  | "duality-right";

export type AnimatedDieSpec = {
  id: string;
  sides: SupportedDie;
  value: number | null;
  tone?: DiceVisualTone;
  label?: string;
  discarded?: boolean;
  motion?: DiceMotion;
  delayMs?: number;
};

export function flattenRolledGroups(
  groups: RolledGroup[],
  options?: {
    tone?: DiceVisualTone;
    discardedGlobalIndexes?: Set<number>;
    idPrefix?: string;
  }
) {
  const dice: AnimatedDieSpec[] = [];
  let globalIndex = 0;

  groups.forEach((group, groupIndex) => {
    group.results.forEach((value, dieIndex) => {
      const motionCycle: DiceMotion[] = [
        "drop-left",
        "drop-center",
        "drop-right",
      ];

      dice.push({
        id: `${options?.idPrefix ?? "die"}-${groupIndex}-${dieIndex}-${globalIndex}`,
        sides: group.sides,
        value,
        tone: options?.tone ?? "nattau",
        discarded: options?.discardedGlobalIndexes?.has(globalIndex) ?? false,
        motion: motionCycle[globalIndex % motionCycle.length],
        delayMs: Math.min(globalIndex * 65, 520),
      });

      globalIndex += 1;
    });
  });

  return {
    dice: dice.slice(0, MAX_VISIBLE_DICE),
    omittedCount: Math.max(0, dice.length - MAX_VISIBLE_DICE),
  };
}
