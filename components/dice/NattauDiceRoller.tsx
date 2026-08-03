"use client";

import { useMemo, useState } from "react";
import { CampaignDiceLog } from "./CampaignDiceLog";
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
  savedRoll: CampaignDiceRollRow | null;
  expression: string;
  total: number;
  mode: D20Mode;
  groups: RolledGroup[];
  keptDie: number | null;
  modifier: number;
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

    setRolling(true);
    setLocalError(null);
    setError(null);
    await wait(450);

    const finalModifier = parsed.modifier + extraModifier;
    const useD20Mode =
      parsed.groups.length === 1 &&
      parsed.groups[0].diceCount === 1 &&
      parsed.groups[0].sides === 20;
    const finalMode = useD20Mode ? requestedMode : "normal";

    let groups: RolledGroup[];
    let total: number;
    let keptDie: number | null = null;

    if (useD20Mode && finalMode !== "normal") {
      const first = rollDie(20);
      const second = rollDie(20);
      keptDie =
        finalMode === "advantage"
          ? Math.max(first, second)
          : Math.min(first, second);
      groups = [{ diceCount: 2, sides: 20, results: [first, second] }];
      total = keptDie + finalModifier;
    } else {
      const rolled = rollParsedExpression(parsed);
      groups = rolled.groups;
      total = rolled.diceTotal + extraModifier + parsed.modifier;
    }

    const expressionLabel = `${parsed.normalizedExpression}${
      extraModifier === 0 ? "" : formatModifier(extraModifier)
    }`;

    const savedRoll = await saveRoll({
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
        formula_modifier: parsed.modifier,
        extra_modifier: extraModifier,
        final_modifier: finalModifier,
      },
    });

    setLatest({
      savedRoll,
      expression: expressionLabel,
      total,
      mode: finalMode,
      groups,
      keptDie,
      modifier: finalModifier,
    });
    setRolling(false);
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
                className="w-full min-h-12 rounded-xl border border-yellow-500 bg-yellow-500 px-4 font-bold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
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
            Latest Result
          </p>
          <h2 className="mt-3 text-2xl font-bold text-slate-100">
            Roll Outcome
          </h2>

          {rolling ? (
            <div className="mt-5 rounded-2xl border border-yellow-600/30 bg-yellow-500/10 p-5">
              <p className="text-sm text-slate-400">The dice are rolling...</p>
              <div className="mt-5 flex gap-3">
                {[0, 1, 2].map((value) => (
                  <span
                    key={value}
                    className="flex h-11 w-11 animate-bounce items-center justify-center rounded-xl border border-yellow-500 bg-yellow-500/15 text-2xl font-black text-yellow-300"
                  >
                    ?
                  </span>
                ))}
              </div>
            </div>
          ) : latest ? (
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
                    {latest.savedRoll
                      ? latest.savedRoll.visibility === "private"
                        ? "Saved privately in Supabase"
                        : "Saved to the Nattau campaign log"
                      : "The result was rolled, but saving failed"}
                  </p>
                </div>
                {latest.modifier !== 0 && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
                    Modifier {formatModifier(latest.modifier)}
                  </span>
                )}
              </div>

              <div className="mt-5 space-y-3">
                {latest.groups.map((group, groupIndex) => (
                  <div
                    key={`${group.sides}-${groupIndex}`}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {group.diceCount}d{group.sides}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.results.map((value, index) => {
                        const kept =
                          latest.keptDie === null || value === latest.keptDie;
                        return (
                          <span
                            key={`${value}-${index}`}
                            className={`rounded-xl border px-4 py-2 font-bold ${
                              kept
                                ? "border-yellow-500 bg-yellow-500/15 text-yellow-300"
                                : "border-slate-700 bg-slate-950/70 text-slate-500"
                            }`}
                          >
                            {value}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
              No roll yet. Prepare a formula and let the dice decide.
            </p>
          )}
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
