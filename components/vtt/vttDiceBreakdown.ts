import type {RolledGroup} from "@/components/dice/diceUtils";

/** Authoritative outcome produced by the roller, identical on every display. */
export function formatVttDiceBreakdown(groups:RolledGroup[]):string {
 return groups
  .filter(group=>group && Array.isArray(group.results)&&group.results.length>0&&
    typeof group.sides==="number"&&group.results.every((n)=>Number.isInteger(n)&&n>=1))
  .map(group=>`d${group.sides}: ${group.results.join(", ")}`)
  .join(" · ");
}
