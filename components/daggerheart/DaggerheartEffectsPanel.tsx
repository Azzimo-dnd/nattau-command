"use client";

import type {
  DaggerheartEffectResult,
  DaggerheartEffectState,
  DaggerheartEffectStat,
  DaggerheartManualStatModifiers,
} from "@/lib/daggerheart/effects";

const statLabels: Record<DaggerheartEffectStat, string> = {
  agility: "Agility",
  strength: "Strength",
  finesse: "Finesse",
  instinct: "Instinct",
  presence: "Presence",
  knowledge: "Knowledge",
  evasion: "Evasion",
  proficiency: "Proficiency",
  damage_proficiency_bonus: "Damage Proficiency bonus",
  primary_damage_proficiency_bonus: "Primary damage Proficiency bonus",
  hope_max: "Hope max",
  hp_max: "HP max",
  stress_max: "Stress max",
  armor_score: "Armor Score",
  major_threshold: "Major Threshold",
  severe_threshold: "Severe Threshold",
  domain_loadout_max: "Domain Loadout",
  consumable_clear_bonus: "Consumable Recovery",
};

const primaryStats: DaggerheartEffectStat[] = [
  "evasion",
  "proficiency",
  "armor_score",
  "major_threshold",
  "severe_threshold",
  "hp_max",
  "stress_max",
  "hope_max",
  "domain_loadout_max",
];

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function DaggerheartEffectsPanel({
  result,
  manualModifiers,
  effectState,
  onManualModifierChange,
  onToggleEffects,
}: {
  result: DaggerheartEffectResult;
  manualModifiers: DaggerheartManualStatModifiers;
  effectState: DaggerheartEffectState;
  onManualModifierChange: (stat: DaggerheartEffectStat, value: number) => void;
  onToggleEffects: (effectKeys: string[]) => void;
}) {
  const activeIds = new Set(effectState.active_effect_ids ?? []);
  const toggleGroups = Object.values(
    result.toggles.reduce<Record<string, typeof result.toggles>>(
      (groups, toggle) => {
        const key = toggle.bundle_id ?? toggle.key;
        groups[key] = [...(groups[key] ?? []), toggle];
        return groups;
      },
      {}
    )
  );

  const activeChoices = new Map<string, number>();
  for (const group of toggleGroups) {
    const choiceGroup = group[0]?.choice_group;
    if (!choiceGroup) continue;
    const active = group.every((toggle) => activeIds.has(toggle.key));
    if (active) {
      activeChoices.set(choiceGroup, (activeChoices.get(choiceGroup) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {primaryStats.map((stat) => {
          const contributions = result.breakdown[stat] ?? [];
          const manual = manualModifiers[stat] ?? 0;
          const value =
            stat === "armor_score"
              ? result.stats.armor_score
              : result.stats[stat];
          const contributionTotal = contributions.reduce(
            (sum, item) => sum + item.value,
            0
          );
          const baseline = value - contributionTotal;

          return (
            <details
              key={stat}
              className="group rounded-xl border border-[#3b252e] bg-black/20 open:border-[#6c3c4b]"
            >
              <summary className="cursor-pointer list-none p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#927780]">
                  {statLabels[stat]}
                </p>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <span className="text-3xl font-black text-[#ead7dc]">
                    {value}
                  </span>
                  {contributions.length > 0 && (
                    <span className="rounded-full border border-[#4c303a] bg-[#241219] px-2 py-1 text-[10px] font-bold text-[#c18b9a]">
                      {contributions.length} effect{contributions.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </summary>

              <div className="border-t border-[#322129] px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#8e7980]">
                    {result.equippedArmor &&
                    ["armor_score", "major_threshold", "severe_threshold"].includes(stat)
                      ? "Armor/base value"
                      : "Base value"}
                  </span>
                  <span className="font-semibold text-[#cbb7bd]">{baseline}</span>
                </div>
                {result.equippedArmor &&
                  ["armor_score", "major_threshold", "severe_threshold"].includes(stat) && (
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#8e7980]">Equipped armor</span>
                      <span className="font-semibold text-[#cbb7bd]">
                        {result.equippedArmor.name}
                      </span>
                    </div>
                  )}

                {contributions.length > 0 ? (
                  <div className="space-y-2">
                    {contributions.map((item) => (
                      <div
                        key={item.effect_key}
                        className="flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#cdb8bf]">
                            {item.label}
                            {item.temporary ? " · active" : ""}
                          </p>
                          <p className="mt-0.5 text-[#78666c]">{item.source}</p>
                        </div>
                        <span
                          className={
                            item.value >= 0
                              ? "font-black text-emerald-300/80"
                              : "font-black text-rose-300/85"
                          }
                        >
                          {item.operation === "set"
                            ? `→ ${item.result_value}`
                            : item.operation === "minimum"
                              ? `min ${item.result_value}`
                              : signed(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#79676d]">
                    No structured modifiers currently affect this stat.
                  </p>
                )}

                <label className="mt-3 block border-t border-[#2d1d23] pt-3">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#806b72]">
                    GM / Homebrew modifier
                  </span>
                  <input
                    type="number"
                    value={manual}
                    onChange={(event) =>
                      onManualModifierChange(stat, Number(event.target.value) || 0)
                    }
                    className="min-h-9 w-full rounded-lg border border-[#49303a] bg-[#0d080b] px-2 text-sm text-[#dbcbd0] outline-none focus:border-[#8b465a]"
                  />
                </label>
              </div>
            </details>
          );
        })}
      </div>

      {result.toggles.length > 0 && (
        <div className="rounded-2xl border border-[#402832] bg-black/15 p-4">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9c6273]">
              Situational effects
            </p>
            <p className="mt-1 text-xs leading-5 text-[#827078]">
              These effects only change the sheet when you tell it that their narrative condition is currently true.
            </p>
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            {toggleGroups.map((group) => {
              const first = group[0];
              if (!first) return null;
              const keys = group.map((toggle) => toggle.key);
              const active = group.every((toggle) => activeIds.has(toggle.key));
              const choiceCount = first.choice_group
                ? activeChoices.get(first.choice_group) ?? 0
                : 0;
              const choiceLimit = first.choice_limit ?? 0;
              const limitReached =
                !active &&
                Boolean(first.choice_group) &&
                choiceLimit > 0 &&
                choiceCount >= choiceLimit;
              const statSummary = group
                .map(
                  (toggle) =>
                    `${statLabels[toggle.stat]} ${signed(toggle.value)}`
                )
                .join(" · ");

              return (
                <button
                  key={first.bundle_id ?? first.key}
                  type="button"
                  disabled={limitReached}
                  onClick={() => onToggleEffects(keys)}
                  className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    active
                      ? "border-[#9c5065] bg-[#421824]/70"
                      : "border-[#39252d] bg-[#120b0f] hover:border-[#654052]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#dbc8ce]">{first.label}</p>
                      <p className="mt-0.5 text-[11px] text-[#816c73]">
                        {first.source} · {statSummary}
                      </p>
                      {first.choice_group && choiceLimit > 0 && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8d707a]">
                          Choice {choiceCount}/{choiceLimit}
                          {limitReached ? " · limit reached" : ""}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                        active
                          ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-200"
                          : "border-[#4a3038] bg-black/20 text-[#8b737a]"
                      }`}
                    >
                      {active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {first.description && (
                    <p className="mt-2 text-xs leading-5 text-[#a18c93]">
                      {first.description}
                    </p>
                  )}
                  {first.duration && (
                    <p className="mt-1 text-[11px] leading-5 text-[#756269]">
                      {first.duration}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
