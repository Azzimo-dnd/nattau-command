export type DualityOutcome = "hope" | "fear" | "critical";
export type DualityResult = { hope: number; fear: number; advantageDie: number | null; outcome: DualityOutcome; total: number };

export function resolveDuality(hope: number, fear: number, modifier: number, mode: "normal" | "advantage" | "disadvantage", advantageDie: number | null = null): DualityResult {
  if (![hope, fear].every((die) => Number.isInteger(die) && die >= 1 && die <= 12) || !Number.isFinite(modifier)) throw new Error("Incomplete Hope/Fear roll. Roll again.");
  if (mode !== "normal" && (advantageDie === null || !Number.isInteger(advantageDie) || advantageDie < 1 || advantageDie > 6)) throw new Error("The advantage die did not settle. Roll again.");
  const adjustment = mode === "normal" ? 0 : (advantageDie ?? 0) * (mode === "advantage" ? 1 : -1);
  return { hope, fear, advantageDie: mode === "normal" ? null : advantageDie, outcome: hope === fear ? "critical" : hope > fear ? "hope" : "fear", total: hope + fear + modifier + adjustment };
}

export function dualityLabel(outcome: DualityOutcome) {
  return outcome === "critical" ? "Critical success" : outcome === "hope" ? "With Hope" : "With Fear";
}
