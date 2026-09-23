export function effectiveDamage(
  raw: string,
  proficiency: number,
  extraBonus = 0
) {
  const compact = raw.replace(/\s+/g, "");
  const typeMatch = compact.match(/(phy\/mag|mag\/phy|phy|mag)$/i);
  const kind = typeMatch?.[1]?.toLowerCase() ?? "";
  const expression = typeMatch
    ? compact.slice(0, -typeMatch[1].length)
    : compact;
  const match = expression.match(/^d(\d+)(?:\+d(\d+))?([+-]\d+)?$/i);
  if (!match) return raw || "—";

  const [, firstDie, secondDie, modifier = ""] = match;
  const dice = [
    `${Math.max(1, proficiency)}d${firstDie}`,
    ...(secondDie ? [`${Math.max(1, proficiency)}d${secondDie}`] : []),
  ];
  const baseModifier = modifier ? Number(modifier) : 0;
  const totalModifier = baseModifier + extraBonus;
  const renderedModifier =
    totalModifier === 0
      ? ""
      : totalModifier > 0
        ? `+${totalModifier}`
        : String(totalModifier);
  const type =
    kind === "phy"
      ? " physical"
      : kind === "mag"
        ? " magic"
        : kind === "phy/mag" || kind === "mag/phy"
          ? " physical/magic"
          : "";
  return `${dice.join("+")}${renderedModifier}${type}`;
}
