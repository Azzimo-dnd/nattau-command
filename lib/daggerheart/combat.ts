export function weaponRulesText(weapon: {
  rules_text?: string;
  details?: string;
}) {
  // Hydrated rules are authoritative, including weapons with no feature.
  if (typeof weapon.rules_text === "string") {
    const rules = weapon.rules_text.trim();
    return /^[—–-]$/.test(rules) ? "" : rules;
  }

  // Older saved sheets keep rules after the stat line in `details`.
  // Prefer the current section if that snapshot also contains original rules.
  const details = weapon.details?.trim() ?? "";
  const current = details.match(/^Official errata\/current(?: \([^\n]*\))?: ([\s\S]*)$/m);
  const parts = (current?.[1] ?? details).split(" · ");
  while (/^(trait|range|damage|burden|base major|base severe|base score):/i.test(parts[0] ?? "")) {
    parts.shift();
  }
  const rules = parts.join(" · ").trim();
  return /^[—–-]$/.test(rules) ? "" : rules;
}

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
