"use client";

import type { DaggerheartDerivedStats } from "@/lib/daggerheart/effects";

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

function effectiveDamage(raw: string, proficiency: number) {
  const compact = raw.replaceAll(" ", "");
  const match = compact.match(/^d(\d+)([+-]\d+)?(phy|mag)?$/i);
  if (!match) return raw || "—";

  const [, die, modifier = "", kind = ""] = match;
  const type =
    kind.toLowerCase() === "phy"
      ? " physical"
      : kind.toLowerCase() === "mag"
        ? " magic"
        : "";
  return `${Math.max(1, proficiency)}d${die}${modifier}${type}`;
}

export function DaggerheartCombatPanel({
  weapons,
  stats,
}: {
  weapons: Weapon[];
  stats: DaggerheartDerivedStats;
}) {
  const equipped = weapons.filter(
    (weapon) =>
      weapon.equipped !== false &&
      ["weapon_primary", "weapon_secondary"].includes(weapon.category ?? "")
  );

  if (equipped.length === 0) {
    return (
      <p className="rounded-xl border border-[#34242b] bg-black/15 p-4 text-sm text-[#806f75]">
        No weapon is equipped. Equip a weapon below to create its live attack profile.
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
                  Current damage · Proficiency {stats.proficiency}
                </p>
                <p className="mt-1 text-sm font-black text-[#e3cbd2]">
                  {effectiveDamage(damage, stats.proficiency)}
                </p>
              </div>
            </div>

            {burden && (
              <p className="mt-3 text-[11px] text-[#806d74]">
                {burden}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
