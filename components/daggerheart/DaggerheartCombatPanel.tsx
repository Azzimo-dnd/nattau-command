"use client";

import { useEffect, useState } from "react";
import type { DaggerheartDerivedStats } from "@/lib/daggerheart/effects";
import { daggerheartTraits } from "@/lib/daggerheart/catalog";
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
  rolling = false,
  onRollAttack,
  onRollDamage,
}: {
  weapons: Weapon[];
  stats: DaggerheartDerivedStats;
  level: number;
  rolling?: boolean;
  onRollAttack?: (roll: {
    title: string;
    trait: string;
    modifier: number;
    source: string;
  }) => void;
  onRollDamage?: (roll: {
    title: string;
    expression: string;
    damageType?: string;
    source: string;
  }) => void;
}) {
  const [brawlerTrait, setBrawlerTrait] = useState<string>("");

  const configuredBrawlerTrait =
    weapons.find((weapon) => weapon.category === "brawler_strike")
      ?.metadata?.trait;
  const configuredBrawlerTraitText =
    typeof configuredBrawlerTrait === "string" ? configuredBrawlerTrait : "";

  useEffect(() => {
    if (
      configuredBrawlerTraitText &&
      daggerheartTraits.includes(
        configuredBrawlerTraitText.toLowerCase() as (typeof daggerheartTraits)[number]
      )
    ) {
      setBrawlerTrait(configuredBrawlerTraitText.toLowerCase());
    }
  }, [configuredBrawlerTraitText]);

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
    <div className="grid gap-3">
      {equipped.map((weapon) => {
        const configuredTrait = text(weapon.metadata?.trait);
        const trait =
          weapon.category === "brawler_strike"
            ? brawlerTrait || configuredTrait
            : configuredTrait;
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
        const currentDamage = effectiveDamage(damage, damageProficiency, damageBonus);
        const damageTypeMatch = currentDamage.match(/\s+(physical\/magic|physical|magic)$/i);
        const damageType = damageTypeMatch?.[1]?.toLowerCase();
        const damageExpression = damageTypeMatch
          ? currentDamage.slice(0, -damageTypeMatch[0].length)
          : currentDamage;

        const weaponKind =
          weapon.category === "weapon_secondary"
            ? "Secondary weapon"
            : weapon.category === "beastform"
              ? "Beastform attack"
              : weapon.category === "brawler_strike"
                ? "Brawler's Strike"
                : "Primary weapon";

        return (
          <article
            key={weapon.instance_id ?? `${weapon.category}:${weapon.name}`}
            className="rounded-2xl border border-[#49303a] bg-[#160e13]/88 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a77685]">
                  {weaponKind}
                </p>
                <h4 className="mt-1 break-words font-serif text-xl font-black text-[#ead8dd]">
                  {weapon.name}
                </h4>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                {range && (
                  <span className="rounded-full border border-[#4b323b] bg-black/20 px-3 py-1.5 font-semibold text-[#baa1a9]">
                    {range}
                  </span>
                )}
                <span className="rounded-full border border-emerald-900/45 bg-emerald-950/20 px-3 py-1.5 font-bold text-emerald-200/90">
                  Equipped
                </span>
              </div>
            </div>

            {weapon.category === "brawler_strike" && (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-semibold text-[#b69aa4]">
                  Attack trait · choose for this strike
                </span>
                <select
                  value={trait}
                  onChange={(event) => setBrawlerTrait(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-[#5b3844] bg-[#100a0e] px-3 text-sm font-bold capitalize text-[#e5d1d7] outline-none transition focus:border-[#a6536b] focus:ring-2 focus:ring-[#6e263b]/30"
                  aria-label="Brawler's Strike attack trait"
                >
                  <option value="">Choose trait</option>
                  {daggerheartTraits.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry[0].toUpperCase() + entry.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!trait || !onRollAttack || rolling}
                onClick={() =>
                  onRollAttack?.({
                    title: `${weapon.name} · Attack`,
                    trait,
                    modifier,
                    source: weapon.name,
                  })
                }
                className="min-h-14 rounded-xl border border-[#9b5065] bg-[#551b2c]/55 px-4 py-3 text-left transition hover:border-[#bd667e] hover:bg-[#692238]/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c96b84] disabled:cursor-not-allowed disabled:border-[#3b2a30] disabled:bg-[#171015] disabled:opacity-55"
                aria-label={trait ? `Roll ${weapon.name} attack using ${trait} ${signed(modifier)}` : `Choose a trait before rolling ${weapon.name} attack`}
              >
                <span className="block text-xs font-bold uppercase tracking-[0.1em] text-[#d49aaa]">
                  {rolling ? "Rolling…" : "🎲 Attack"}
                </span>
                <span className="mt-1 block text-base font-black capitalize text-[#f1dce2]">
                  {trait ? `${trait} ${signed(modifier)}` : "Choose trait"}
                </span>
              </button>

              <button
                type="button"
                disabled={!damageExpression || damageExpression === "—" || !onRollDamage || rolling}
                onClick={() =>
                  onRollDamage?.({
                    title: `${weapon.name} · Damage`,
                    expression: damageExpression,
                    damageType,
                    source: weapon.name,
                  })
                }
                className="min-h-14 rounded-xl border border-[#755063] bg-[#281722] px-4 py-3 text-left transition hover:border-[#9b6278] hover:bg-[#351b28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86a80] disabled:cursor-not-allowed disabled:opacity-55"
                aria-label={`Roll ${weapon.name} damage: ${currentDamage}`}
              >
                <span className="block text-xs font-bold uppercase tracking-[0.1em] text-[#bd93a0]">
                  {rolling ? "Rolling…" : "🎲 Damage"}
                </span>
                <span className="mt-1 block text-base font-black text-[#ead6dc]">
                  {currentDamage}
                </span>
                <span className="mt-1 block text-xs text-[#9c828b]">
                  Proficiency {damageProficiency}
                </span>
              </button>
            </div>

            {(burden || damageBonus !== 0) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#907881]">
                {burden && <span>{burden}</span>}
                {damageBonus !== 0 && (
                  <span className="rounded-full border border-[#4a3038] bg-black/20 px-2.5 py-1 text-[#bd8d9b]">
                    Dynamic damage {damageBonus > 0 ? "+" : ""}{damageBonus}
                  </span>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
