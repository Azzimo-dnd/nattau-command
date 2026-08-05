import type { DiceGroup, RolledGroup, SupportedDie } from "@/components/dice/diceUtils";
import type {
  PhysicsDieKind,
  PhysicsDieRequest,
  PhysicsDieResult,
  PhysicsDieTone,
  PhysicsRollResult,
} from "./dicePhysicsTypes";

export const MAX_PHYSICAL_DICE = 24;

function kindForSides(sides: Exclude<SupportedDie, 100>): PhysicsDieKind {
  return `d${sides}` as PhysicsDieKind;
}

export function countPhysicalDice(groups: DiceGroup[]) {
  return groups.reduce(
    (sum, group) => sum + group.diceCount * (group.sides === 100 ? 2 : 1),
    0
  );
}

export function buildPhysicsDiceFromGroups(
  groups: DiceGroup[],
  idPrefix: string,
  tone: PhysicsDieTone = "normal"
): PhysicsDieRequest[] {
  const physicalCount = countPhysicalDice(groups);
  if (physicalCount > MAX_PHYSICAL_DICE) {
    throw new Error(
      `The physics beta supports up to ${MAX_PHYSICAL_DICE} physical dice in one throw. This formula needs ${physicalCount}.`
    );
  }

  const dice: PhysicsDieRequest[] = [];
  groups.forEach((group, groupIndex) => {
    for (let dieIndex = 0; dieIndex < group.diceCount; dieIndex += 1) {
      if (group.sides === 100) {
        dice.push({
          id: `${idPrefix}-g${groupIndex}-d${dieIndex}-tens`,
          kind: "d10",
          groupIndex,
          logicalDieIndex: dieIndex,
          percentilePart: "tens",
          tone,
        });
        dice.push({
          id: `${idPrefix}-g${groupIndex}-d${dieIndex}-ones`,
          kind: "d10",
          groupIndex,
          logicalDieIndex: dieIndex,
          percentilePart: "ones",
          tone,
        });
      } else {
        dice.push({
          id: `${idPrefix}-g${groupIndex}-d${dieIndex}`,
          kind: kindForSides(group.sides),
          groupIndex,
          logicalDieIndex: dieIndex,
          tone,
        });
      }
    }
  });
  return dice;
}

function percentileValue(results: PhysicsDieResult[]) {
  const tens = results.find((die) => die.percentilePart === "tens")?.value ?? 0;
  const ones = results.find((die) => die.percentilePart === "ones")?.value ?? 0;
  const total = tens + ones;
  return total === 0 ? 100 : total;
}

export function physicsResultToGroups(
  sourceGroups: DiceGroup[],
  result: PhysicsRollResult
): RolledGroup[] {
  return sourceGroups.map((group, groupIndex) => {
    const values = Array.from({ length: group.diceCount }, (_, logicalDieIndex) => {
      const matching = result.dice.filter(
        (die) =>
          die.groupIndex === groupIndex && die.logicalDieIndex === logicalDieIndex
      );
      if (group.sides === 100) return percentileValue(matching);
      return matching[0]?.value ?? 0;
    });

    return {
      ...group,
      results: values,
    };
  });
}

export function totalRolledGroups(groups: RolledGroup[]) {
  return groups.reduce(
    (sum, group) => sum + group.results.reduce((groupSum, value) => groupSum + value, 0),
    0
  );
}
