"use client";

import { useMemo, useState } from "react";
import { AnimatedDiceTray } from "./AnimatedDiceTray";
import { CampaignDiceLog } from "./CampaignDiceLog";
import {
  DICE_ANIMATION_MS,
  flattenRolledGroups,
  type AnimatedDieSpec,
} from "./diceAnimation";
import type {
  CampaignDiceRollRow,
  DiceAppRole,
  RollVisibility,
} from "./diceTypes";
import {
  formatModifier,
  parseDiceExpression,
  rollDie,
  rollParsedExpression,
  type RolledGroup,
  type SupportedDie,
  wait,
} from "./diceUtils";
import { useCampaignDiceLog } from "./useCampaignDiceLog";

type D20Mode = "normal" | "advantage" | "disadvantage";

type LocalNattauResult = {
  rollToken: number;
  savedRoll: CampaignDiceRollRow | null;
  expression: string;
  total: number;
  mode: D20Mode;
  groups: RolledGroup[];
  keptDie: number | null;
  keptIndex: number | null;
  modifier: number;
  dice: AnimatedDieSpec[];
  omittedCount: number;
};

type NattauDiceRollerProps = {
  campaignId: string;
  currentUserId: string;
  currentUserName: string;
  role: DiceAppRole;
};

const quickDice: SupportedDie[] = [4, 6, 8, 10, 12, 20, 100];

function modeLabel(mode: D20Mode) {
  if (mode === "advantage") return "Advantage";
  if (mode === "disadvantage") return "Disadvantage";
  return "Normal";
}

function canUseD20Mode(expression: string) {
  const parsed = parseDiceExpression(expression);
  return (
    parsed?.groups.length === 1 &&
    parsed.groups[0].diceCount === 1 &&
    parsed.groups[0].sides === 20
  );
}

export function NattauDiceRoller({
  campaignId,
  currentUserId,
  currentUserName,
  role,
}: NattauDiceRollerProps) {
  const [expression, setExpression] = useState("1d20");
  const [extraModifier, setExtraModifier] = useState(0);
  const [mode, setMode] = useState<D20Mode>("normal");
  const [visibility, setVisibility] =
    useState<RollVisibility>("campaign");
  const [rolling, setRolling] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [activeDice, setActiveDice] = useState<AnimatedDieSpec[]>([]);
  const [activeOmittedCount, setActiveOmittedCount] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [latest, setLatest] = useState<LocalNattauResult | null>(null);

  const {
    rolls,
    loading,
    saving,
    error,
    setError,
    refresh,
    saveRoll,
    deleteRoll,
    clearMyRolls,
  } = useCampaignDiceLog({ campaignId, currentUserId });

  const d20ModeAllowed = useMemo(
    () => canUseD20Mode(expression),
    [expression]
  );

  async function performRoll(
    requestedExpression = expression,
    requestedMode = mode
  ) {
    if (rolling || saving) return;

    const parsed = parseDiceExpression(requestedExpression);
    if (!parsed) {
      setLocalError(
        "Use a valid formula such as 1d20, 2d6+3, 2d4+3d8 or 1d20+2d6+4."
      );
      return;
    }

    setLocalError(null);
    setError(null);

    const finalModifier = parsed.modifier + extraModifier;
    const useD20Mode =
      parsed.groups.length === 1 &&
      parsed.groups[0].diceCount === 1 &&
      parsed.groups[0].sides === 20;
    const finalMode = useD20Mode ? requestedMode : "normal";

    let groups: RolledGroup[];
    let total: number;
    let keptDie: number | null = null;
    let keptIndex: number | null = null;

    if (useD20Mode && finalMode !== "normal") {
      const first = rollDie(20);
      const second = rollDie(20);
      keptIndex =
        finalMode === "advantage"
          ? first >= second
            ? 0
            : 1
          : first <= second
            ? 0
            : 1;
      keptDie = keptIndex === 0 ? first : second;
      groups = [{ diceCount: 2, sides: 20, results: [first, second] }];
      total = keptDie + finalModifier;
    } else {
      const rolled = rollParsedExpression(parsed);
      groups = rolled.groups;
      total = rolled.diceTotal + extraModifier + parsed.modifier;
    }

    const discardedIndexes = new Set<number>();
    if (keptIndex !== null) {
      discardedIndexes.add(keptIndex === 0 ? 1 : 0);
    }

    const visual = flattenRolledGroups(groups, {
      tone: "nattau",
      discardedGlobalIndexes: discardedIndexes,
      idPrefix: `nattau-${Date.now()}`,
    });

    const expressionLabel = `${parsed.normalizedExpression}${
      extraModifier === 0 ? "" : formatModifier(extraModifier)
    }`;
    const rollToken = Date.now();
    const draft: LocalNattauResult = {
      rollToken,
      savedRoll: null,
      expression: expressionLabel,
      total,
      mode: finalMode,
      groups,
      keptDie,
      keptIndex,
      modifier: finalModifier,
      dice: visual.dice,
      omittedCount: visual.omittedCount,
    };

    setActiveDice(visual.dice);
    setActiveOmittedCount(visual.omittedCount);
    setAnimationKey((current) => current + 1);
    setRolling(true);

    const savePromise = saveRoll({
      roll_kind: "generic",
      title: `${expressionLabel} · ${modeLabel(finalMode)}`,
      expression: expressionLabel,
      total,
      outcome: `Rolled by ${currentUserName}`,
      visibility,
      details: {
        mode: finalMode,
        groups,
        kept_die: keptDie,
        kept_index: keptIndex,
        formula_modifier: parsed.modifier,
        extra_modifier: extraModifier,
        final_modifier: finalModifier,
      },
    });

    await wait(DICE_ANIMATION_MS);
    setLatest(draft);
    setRolling(false);

    const savedRoll = await savePromise;
    setLatest((current) =>
      current?.rollToken === rollToken ? { ...current, savedRoll } : current
    );
  }

  function rollQuickDie(sides: SupportedDie) {
    const quickExpression = `1d${sides}`;
    setExpression(quickExpression);
    void performRoll(quickExpression, sides === 20 ? mode : "normal");
  }

  async function handleClearMine() {
    if (!window.confirm("Delete all of your saved Nattau rolls?")) return;
    await clearMyRolls();
  }

  const displayedDice = rolling ? activeDice : latest?.dice ?? [];
  const displayedOmittedCount = rolling
    ? activeOmittedCount
    : latest?.omittedCount ?? 0;

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
              Roll Command
            </p>
            <h2 className="mt-3 text-2xl font-bold text-slate-100">
              Prepare Roll
            </h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300">
                  Dice formula
                </label>
                <input
                  value={expression}
                  disabled={rolling || saving}
                  onChange={(event) => setExpression(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500 disabled:opacity-60"
                  placeholder="1d20, 2d6+3, 2d4+3d8"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Supported dice: d4, d6, d8, d10, d12, d20 and d100.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">
                  Extra modifier
                </label>
                <input
                  type="number"
                  value={extraModifier}
                  disabled={rolling || saving}
                  onChange={(event) =>
                    setExtraModifier(Number(event.target.value) || 0)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-yellow-500 disabled:opacity-60"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-300">d20 mode</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["normal", "advantage", "disadvantage"] as D20Mode[]).map(
                    (entry) => (
                      <button
                        key={entry}
                        type="button"
                        disabled={rolling || saving || !d20ModeAllowed}
                        onClick={() => setMode(entry)}
                        className={`min-h-11 rounded-xl border px-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-35 ${
                          mode === entry
                            ? entry === "advantage"
                              ? "border-green-500/60 bg-green-500/10 text-green-300"
                              : entry === "disadvantage"
                                ? "border-red-500/60 bg-red-500/10 text-red-300"
                                : "border-yellow-500/50 bg-yellow-500/10 text-yellow-300"
                            : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-yellow-600/40"
                        }`}
                      >
                        {modeLabel(entry)}
                      </button>
                    )
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Advantage and disadvantage apply only to a pure 1d20 roll.
                </p>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={visibility === "private"}
                  onChange={(event) =>
                    setVisibility(event.target.checked ? "private" : "campaign")
                  }
                  className="h-4 w-4 accent-yellow-500"
                />
                Private roll — hidden from other campaign members
              </label>

              {(localError || error) && (
                <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {localError || error}
                </p>
              )}

              <button
                type="button"
                disabled={rolling || saving}
                onClick={() => void performRoll()}
                className="min-h-12 w-full rounded-xl border border-yellow-500 bg-yellow-500 px-4 font-bold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rolling ? "Rolling..." : saving ? "Saving..." : "Roll Dice"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
              Quick Dice
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {quickDice.map((sides) => (
                <button
                  key={sides}
                  type="button"
                  disabled={rolling || saving}
                  onClick={() => rollQuickDie(sides)}
                  className="min-h-12 rounded-xl border border-slate-700 bg-slate-950/70 px-3 font-bold text-slate-200 transition hover:border-yellow-500 hover:text-yellow-300 disabled:opacity-50"
                >
                  d{sides}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Expedition Dice Tray
          </p>
          <h2 className="mt-3 text-2xl font-bold text-slate-100">
            Roll Outcome
          </h2>

          <div className="mt-5">
            <AnimatedDiceTray
              variant="nattau"
              dice={displayedDice}
              rolling={rolling}
              animationKey={animationKey}
              omittedCount={displayedOmittedCount}
              label={
                rolling
                  ? `${expression} is rolling`
                  : latest
                    ? `${latest.expression} · ${modeLabel(latest.mode)}`
                    : "Command table"
              }
              emptyMessage="The expedition dice are waiting on the command table."
            />
          </div>

          {!rolling && latest ? (
            <div className="mt-5 rounded-2xl border border-yellow-600/30 bg-yellow-500/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">
                    {latest.expression} · {modeLabel(latest.mode)}
                  </p>
                  <p className="mt-2 text-6xl font-black text-yellow-300">
                    {latest.total}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {saving
                      ? "The result is being saved..."
                      : latest.savedRoll
                        ? latest.savedRoll.visibility === "private"
                          ? "Saved privately in Supabase"
                          : "Saved to the Nattau campaign log"
                        : "The result was rolled, but saving failed"
                    }
                  </p>
                </div>
                {latest.modifier !== 0 && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
                    Modifier {formatModifier(latest.modifier)}
                  </span>
                )}
              </div>

              {latest.keptIndex !== null && (
                <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-xs text-slate-400">
                  The dimmed d20 was discarded by {modeLabel(latest.mode).toLowerCase()}.
                </p>
              )}
            </div>
          ) : !rolling ? (
            <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
              No roll yet. Prepare a formula and let the dice decide.
            </p>
          ) : null}
        </div>
      </div>

      <CampaignDiceLog
        variant="nattau"
        rolls={rolls}
        loading={loading}
        currentUserId={currentUserId}
        role={role}
        onRefresh={() => void refresh()}
        onDelete={(rollId) => void deleteRoll(rollId)}
        onClearMine={() => void handleClearMine()}
      />
    </section>
  );
}
