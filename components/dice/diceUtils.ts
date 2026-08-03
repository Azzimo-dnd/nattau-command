export type SupportedDie = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export type DiceGroup = {
  diceCount: number;
  sides: SupportedDie;
};

export type RolledGroup = DiceGroup & {
  results: number[];
};

export type ParsedExpression = {
  groups: DiceGroup[];
  modifier: number;
  normalizedExpression: string;
};

const SUPPORTED_DICE: SupportedDie[] = [4, 6, 8, 10, 12, 20, 100];

export function rollDie(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

export function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function formatModifier(modifier: number) {
  if (modifier === 0) return "+0";
  return modifier > 0 ? `+${modifier}` : `${modifier}`;
}

export function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSupportedDie(sides: number): sides is SupportedDie {
  return SUPPORTED_DICE.includes(sides as SupportedDie);
}

export function parseDiceExpression(expression: string): ParsedExpression | null {
  const cleanedExpression = expression.replace(/\s/g, "").toLowerCase();
  if (!cleanedExpression) return null;

  const tokens = cleanedExpression.match(/[+-]?[^+-]+/g);
  if (!tokens) return null;

  const groups: DiceGroup[] = [];
  let modifier = 0;

  for (const token of tokens) {
    const sign = token.startsWith("-") ? -1 : 1;
    const cleanToken = token.replace(/^[+-]/, "");
    const diceMatch = cleanToken.match(/^(\d*)d(\d+)$/);

    if (diceMatch) {
      if (sign === -1) return null;

      const diceCount = diceMatch[1] === "" ? 1 : Number(diceMatch[1]);
      const sides = Number(diceMatch[2]);

      if (!isSupportedDie(sides) || diceCount < 1 || diceCount > 30) {
        return null;
      }

      groups.push({ diceCount, sides });
      continue;
    }

    if (/^\d+$/.test(cleanToken)) {
      modifier += Number(cleanToken) * sign;
      continue;
    }

    return null;
  }

  const totalDiceCount = groups.reduce(
    (sum, group) => sum + group.diceCount,
    0
  );

  if (groups.length === 0 || totalDiceCount > 60) return null;

  return {
    groups,
    modifier,
    normalizedExpression: cleanedExpression,
  };
}

export function rollParsedExpression(parsed: ParsedExpression) {
  const groups: RolledGroup[] = parsed.groups.map((group) => ({
    ...group,
    results: Array.from({ length: group.diceCount }, () =>
      rollDie(group.sides)
    ),
  }));

  const diceTotal = groups.reduce(
    (total, group) =>
      total + group.results.reduce((groupTotal, value) => groupTotal + value, 0),
    0
  );

  return {
    groups,
    diceTotal,
    total: diceTotal + parsed.modifier,
  };
}

export function readNumber(
  details: Record<string, unknown> | null,
  key: string
) {
  const value = details?.[key];
  return typeof value === "number" ? value : null;
}

export function readString(
  details: Record<string, unknown> | null,
  key: string
) {
  const value = details?.[key];
  return typeof value === "string" ? value : null;
}
