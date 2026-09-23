"use client";

import type { DaggerheartDerivedStats } from "@/lib/daggerheart/effects";
import { effectiveDamage } from "@/lib/daggerheart/combat";

type Weapon = {
  instance_id?: string;
  name: string;
  category?: string;
  equipped?: boolean;
  metadata?: Record<string, unknown>;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function traitValue(stats: DaggerheartDerivedStats, trait: string) {
  const key = trait.toLowerCase() as keyof DaggerheartDerivedStats;
  const value = stats[key];
  return typeof value === "number" ? value : 0;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function damageBonusFromMetadata(
  metadata: Record<string, unknown> | undefined,
  stats: DaggerheartDerivedStats,
  level: number
) {
  const source = text(metadata?.damage_bonus_from).toLowerCase();
  if (source === "level") return level;
  if (
    ["agility", "strength", "finesse", "instinct", "presence", "knowledge"].includes(source)
  ) {
    return traitValue(stats, source);
  }
  return 0;
}

export function DaggerheartCombatPanel({
  weapons,
  stats,
  level,
}: {
  weapons: Weapon[];
  stats: DaggerheartDerivedStats;
  level: number;
}) {
  const equipped = weapons.filter((weapon) => {
    if (
      weapon.equipped === false ||
      !["weapon_primary", "weapon_secondary", "beastform", "brawler_strike"].includes(
        weapon.category ?? ""
      )
    ) {
      return false;
    }
    if (weapon.category === "beastform") {
      return Boolean(text(weapon.metadata?.trait) && text(weapon.metadata?.damage));
    }
    return true;
  });

  if (equipped.length === 0) {
    return (
      <p className="rounded-xl border border-[#34242b] bg-black/15 p-4 text-sm text-[#806f75]">
        No weapon or active Beastform attack is available. Equip a weapon or enter a Beastform to create its live attack profile.
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {equipped.map((weapon) => {
        const trait = text(weapon.metadata?.trait);
        const range = text(weapon.metadata?.range);
        const damage = text(weapon.metadata?.damage);
        const burden = text(weapon.metadata?.burden);
        const modifier = traitValue(stats, trait);
        const damageBonus = damageBonusFromMetadata(weapon.metadata, stats, level);
        const damageProficiency =
          stats.proficiency +
          stats.damage_proficiency_bonus +
          (weapon.category === "weapon_primary"
            ? stats.primary_damage_proficiency_bonus
            : 0);

        return (
          <div
            key={weapon.instance_id ?? `${weapon.category}:${weapon.name}`}
            className="rounded-2xl border border-[#49303a] bg-gradient-to-br from-[#211219] to-[#0e090c] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#936675]">
                  {weapon.category === "weapon_secondary"
                    ? "Secondary weapon"
                    : weapon.category === "beastform"
                      ? "Beastform attack"
                      : weapon.category === "brawler_strike"
                        ? "Brawler's Strike"
                        : "Primary weapon"}
                </p>
                <h4 className="mt-1 font-serif text-xl font-black text-[#ead8dd]">
                  {weapon.name}
                </h4>
              </div>
              <span className="rounded-full border border-emerald-900/45 bg-emerald-950/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200/90">
                Equipped
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-[#35242b] bg-black/20 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#78666c]">
                  Attack trait
                </p>
                <p className="mt-1 text-sm font-black text-[#d4c0c6]">
                  {trait || "—"} {trait ? signed(modifier) : ""}
                </p>
              </div>
              <div className="rounded-lg border border-[#35242b] bg-black/20 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#78666c]">
                  Range
                </p>
                <p className="mt-1 text-sm font-black text-[#d4c0c6]">
                  {range || "—"}
                </p>
              </div>
              <div className="rounded-lg border border-[#35242b] bg-black/20 p-2.5 sm:col-span-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#78666c]">
                  Current damage · Proficiency {damageProficiency}
                </p>
                <p className="mt-1 text-sm font-black text-[#e3cbd2]">
                  {effectiveDamage(damage, damageProficiency, damageBonus)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#806d74]">
              {burden && <span>{burden}</span>}
              {damageBonus !== 0 && (
                <span className="rounded-full border border-[#4a3038] bg-black/20 px-2 py-0.5 text-[#bd8d9b]">
                  Dynamic damage {damageBonus > 0 ? "+" : ""}{damageBonus}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
