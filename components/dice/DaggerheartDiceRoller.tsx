"use client";

import { useState } from "react";
import { AnimatedDiceTray } from "./AnimatedDiceTray";
import { CampaignDiceLog } from "./CampaignDiceLog";
import { DualityDiceTray } from "./DualityDiceTray";
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
  wait,
} from "./diceUtils";
import { useCampaignDiceLog } from "./useCampaignDiceLog";

type DaggerheartMode = "action" | "reaction" | "gm" | "damage";
type DualityMode = "normal" | "advantage" | "disadvantage";
type DualityOutcomeKey =
  | "critical_success"
  | "success_with_hope"
  | "success_with_fear"
  | "failure_with_hope"
  | "failure_with_fear";

type LocalResult = {
  rollToken: number;
  savedRoll: CampaignDiceRollRow | null;
  mode: DaggerheartMode;
  title: string;
  total: number;
  outcome: string;
  note: string;
  hopeDie?: number;
  fearDie?: number;
  advantageDie?: number;
  advantageMode?: DualityMode;
  naturalD20?: number;
  damageGroups?: Array<{
    diceCount: number;
    sides: number;
    results: number[];
  }>;
  dice: AnimatedDieSpec[];
  omittedCount: number;
  critical?: boolean;
};

type DaggerheartDiceRollerProps = {
  campaignId: string;
  currentUserId: string;
  currentUserName: string;
  role: DiceAppRole;
};

const tabs: Array<{ key: DaggerheartMode; label: string; hint: string }> = [
  { key: "action", label: "Action", hint: "Duality Dice" },
  { key: "reaction", label: "Reaction", hint: "No Hope or Fear" },
  { key: "gm", label: "GM Attack", hint: "d20 vs Evasion" },
  { key: "damage", label: "Damage", hint: "Weapon or spell dice" },
];

function dualityModeLabel(mode: DualityMode) {
  if (mode === "advantage") return "Advantage";
  if (mode === "disadvantage") return "Disadvantage";
  return "Normal";
}

function outcomeLabel(key: DualityOutcomeKey) {
  switch (key) {
    case "critical_success":
      return "Critical Success";
    case "success_with_hope":
      return "Success with Hope";
    case "success_with_fear":
      return "Success with Fear";
    case "failure_with_hope":
      return "Failure with Hope";
    case "failure_with_fear":
      return "Failure with Fear";
  }
}

function resolveDualityOutcome({
  hope,
  fear,
  total,
  difficulty,
}: {
  hope: number;
  fear: number;
  total: number;
  difficulty: number;
}): DualityOutcomeKey {
  if (hope === fear) return "critical_success";

  const success = total >= difficulty;
  const withHope = hope > fear;

  if (success && withHope) return "success_with_hope";
  if (success) return "success_with_fear";
  if (withHope) return "failure_with_hope";
  return "failure_with_fear";
}

function getDualityNote(
  outcome: DualityOutcomeKey,
  rollMode: "action" | "reaction",
  isAttack: boolean
) {
  if (rollMode === "reaction") {
    if (outcome === "critical_success") {
      return "Critical reaction: you automatically succeed and ignore effects that would still apply on a normal success. Reaction rolls do not generate Hope or Fear.";
    }
    return "Reaction rolls resolve success or failure normally, but they do not generate Hope or Fear and do not trigger additional GM moves.";
  }

  switch (outcome) {
    case "critical_success":
      return isAttack
        ? "Automatically succeeds. Gain 1 Hope, clear 1 Stress, and deal critical damage."
        : "Automatically succeeds with a bonus. Gain 1 Hope and clear 1 Stress.";
    case "success_with_hope":
      return "You succeed and gain 1 Hope.";
    case "success_with_fear":
      return "You succeed with a cost or complication. The GM gains 1 Fear.";
    case "failure_with_hope":
      return "You fail with a minor consequence and gain 1 Hope. The spotlight swings to the GM.";
    case "failure_with_fear":
      return "You fail with a major consequence. The GM gains 1 Fear and takes the spotlight.";
  }
}

export function DaggerheartDiceRoller({
  campaignId,
  currentUserId,
  currentUserName,
  role,
}: DaggerheartDiceRollerProps) {
  const [mode, setMode] = useState<DaggerheartMode>("action");
  const [dualityMode, setDualityMode] = useState<DualityMode>("normal");
  const [modifier, setModifier] = useState(0);
  const [difficulty, setDifficulty] = useState(15);
  const [isAttack, setIsAttack] = useState(false);
  const [gmAttackBonus, setGmAttackBonus] = useState(3);
  const [targetEvasion, setTargetEvasion] = useState(12);
  const [damageExpression, setDamageExpression] = useState("1d8+3");
  const [criticalDamage, setCriticalDamage] = useState(false);
  const [visibility, setVisibility] =
    useState<RollVisibility>("campaign");
  const [rolling, setRolling] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [pending, setPending] = useState<LocalResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [latest, setLatest] = useState<LocalResult | null>(null);

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

  async function rollDuality(rollMode: "action" | "reaction") {
    if (rolling || saving) return;
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 99) {
      setLocalError("Difficulty must be between 1 and 99.");
      return;
    }

    setLocalError(null);
    setError(null);

    const hopeDie = rollDie(12);
    const fearDie = rollDie(12);
    const advantageDie =
      dualityMode === "normal" ? undefined : rollDie(6);
    const advantageModifier =
      advantageDie === undefined
        ? 0
        : dualityMode === "advantage"
          ? advantageDie
          : -advantageDie;
    const total = hopeDie + fearDie + modifier + advantageModifier;
    const outcomeKey = resolveDualityOutcome({
      hope: hopeDie,
      fear: fearDie,
      total,
      difficulty,
    });
    const outcome = outcomeLabel(outcomeKey);
    const note = getDualityNote(outcomeKey, rollMode, isAttack);
    const title = rollMode === "action" ? "Action Roll" : "Reaction Roll";
    const advantageExpression =
      advantageDie === undefined
        ? ""
        : ` ${dualityMode === "advantage" ? "+" : "-"} d6`;
    const rollExpression = `Hope d12 + Fear d12 ${formatModifier(modifier)}${advantageExpression}`;
    const rollToken = Date.now();

    const draft: LocalResult = {
      rollToken,
      savedRoll: null,
      mode: rollMode,
      title,
      total,
      outcome,
      note,
      hopeDie,
      fearDie,
      advantageDie,
      advantageMode: dualityMode,
      dice: [],
      omittedCount: 0,
      critical: outcomeKey === "critical_success",
    };

    setPending(draft);
    setAnimationKey((current) => current + 1);
    setRolling(true);

    const savePromise = saveRoll({
      roll_kind:
        rollMode === "action"
          ? "daggerheart_action"
          : "daggerheart_reaction",
      title,
      expression: rollExpression,
      total,
      outcome,
      visibility,
      details: {
        hope_die: hopeDie,
        fear_die: fearDie,
        advantage_die: advantageDie ?? null,
        advantage_mode: dualityMode,
        modifier,
        difficulty,
        outcome_key: outcomeKey,
        is_attack: isAttack,
        rules_version: "Daggerheart SRD 1.0 · 2025-09-09",
        rules_note: note,
        rolled_by: currentUserName,
      },
    });

    await wait(DICE_ANIMATION_MS);
    setLatest(draft);
    setPending(null);
    setRolling(false);

    const savedRoll = await savePromise;
    setLatest((current) =>
      current?.rollToken === rollToken ? { ...current, savedRoll } : current
    );
  }

  async function rollGmAttack() {
    if (rolling || saving) return;
    if (!Number.isFinite(targetEvasion) || targetEvasion < 1) {
      setLocalError("Target Evasion must be at least 1.");
      return;
    }

    setLocalError(null);
    setError(null);

    const naturalD20 = rollDie(20);
    const total = naturalD20 + gmAttackBonus;
    const critical = naturalD20 === 20;
    const success = critical || total >= targetEvasion;
    const outcome = critical ? "Critical Hit" : success ? "Hit" : "Miss";
    const note = critical
      ? "A natural 20 automatically succeeds. Roll damage normally, then add the maximum possible result of the damage dice."
      : success
        ? "The attack meets or beats the target's Evasion. Roll damage."
        : "The attack total is lower than the target's Evasion.";
    const visual = flattenRolledGroups(
      [{ diceCount: 1, sides: 20, results: [naturalD20] }],
      { tone: "barovia", idPrefix: `barovia-gm-${Date.now()}` }
    );
    const rollToken = Date.now();

    const draft: LocalResult = {
      rollToken,
      savedRoll: null,
      mode: "gm",
      title: "Adversary Attack",
      total,
      outcome,
      note,
      naturalD20,
      dice: visual.dice,
      omittedCount: visual.omittedCount,
      critical,
    };

    setPending(draft);
    setAnimationKey((current) => current + 1);
    setRolling(true);

    const savePromise = saveRoll({
      roll_kind: "daggerheart_gm",
      title: "Adversary Attack",
      expression: `d20 ${formatModifier(gmAttackBonus)} vs Evasion ${targetEvasion}`,
      total,
      outcome,
      visibility,
      details: {
        natural_d20: naturalD20,
        attack_bonus: gmAttackBonus,
        target_evasion: targetEvasion,
        critical,
        success,
        rules_version: "Daggerheart SRD 1.0 · 2025-09-09",
        rules_note: note,
        rolled_by: currentUserName,
      },
    });

    await wait(DICE_ANIMATION_MS);
    setLatest(draft);
    setPending(null);
    setRolling(false);

    const savedRoll = await savePromise;
    setLatest((current) =>
      current?.rollToken === rollToken ? { ...current, savedRoll } : current
    );
  }

  async function rollDamage() {
    if (rolling || saving) return;
    const parsed = parseDiceExpression(damageExpression);

    if (!parsed) {
      setLocalError(
        "Use a valid damage formula such as 1d8+3, 2d10+4 or 3d6."
      );
      return;
    }

    setLocalError(null);
    setError(null);

    const rolled = rollParsedExpression(parsed);
    const maximumDiceResult = parsed.groups.reduce(
      (sum, group) => sum + group.diceCount * group.sides,
      0
    );
    const total = rolled.total + (criticalDamage ? maximumDiceResult : 0);
    const outcome = criticalDamage ? "Critical Damage" : "Damage Roll";
    const note = criticalDamage
      ? `Critical damage adds the maximum possible result of the damage dice: +${maximumDiceResult}.`
      : "Apply the result using the target's damage thresholds, resistances and armor rules.";
    const visual = flattenRolledGroups(rolled.groups, {
      tone: "barovia",
      idPrefix: `barovia-damage-${Date.now()}`,
    });
    const rollToken = Date.now();

    const draft: LocalResult = {
      rollToken,
      savedRoll: null,
      mode: "damage",
      title: outcome,
      total,
      outcome,
      note,
      damageGroups: rolled.groups,
      dice: visual.dice,
      omittedCount: visual.omittedCount,
      critical: criticalDamage,
    };

    setPending(draft);
    setAnimationKey((current) => current + 1);
    setRolling(true);

    const savePromise = saveRoll({
      roll_kind: "daggerheart_damage",
      title: outcome,
      expression: criticalDamage
        ? `${parsed.normalizedExpression} + max dice (${maximumDiceResult})`
        : parsed.normalizedExpression,
      total,
      outcome,
      visibility,
      details: {
        groups: rolled.groups,
        formula_modifier: parsed.modifier,
        critical_damage: criticalDamage,
        maximum_dice_result: maximumDiceResult,
        rules_version: "Daggerheart SRD 1.0 · 2025-09-09",
        rolled_by: currentUserName,
      },
    });

    await wait(DICE_ANIMATION_MS);
    setLatest(draft);
    setPending(null);
    setRolling(false);

    const savedRoll = await savePromise;
    setLatest((current) =>
      current?.rollToken === rollToken ? { ...current, savedRoll } : current
    );
  }

  function performCurrentRoll() {
    if (mode === "action") return void rollDuality("action");
    if (mode === "reaction") return void rollDuality("reaction");
    if (mode === "gm") return void rollGmAttack();
    return void rollDamage();
  }

  async function handleClearMine() {
    if (!window.confirm("Delete all of your saved Barovia rolls?")) return;
    await clearMyRolls();
  }

  const visualResult = pending ?? latest;
  const visualMode = visualResult?.mode ?? mode;
  const isDualityVisual = visualMode === "action" || visualMode === "reaction";

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[410px_1fr]">
        <div className="rounded-3xl border border-[#4b2935] bg-[#120d11]/90 p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-[#a7566d]">
            The Duality
          </p>
          <h2 className="mt-3 font-serif text-2xl font-black text-[#eadbd2]">
            Choose the Roll
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                disabled={rolling || saving || (tab.key === "gm" && role !== "dm")}
                onClick={() => setMode(tab.key)}
                className={`min-h-16 rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  mode === tab.key
                    ? "border-[#a14b63] bg-[#5a1825]/35 text-[#efd2da]"
                    : "border-[#432832] bg-black/20 text-[#a9929a] hover:border-[#6f3547]"
                }`}
              >
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className="mt-1 block text-[10px] uppercase tracking-wide opacity-70">
                  {tab.hint}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {(mode === "action" || mode === "reaction") && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm text-[#c7b6bc]">
                    Modifier
                    <input
                      type="number"
                      value={modifier}
                      disabled={rolling || saving}
                      onChange={(event) =>
                        setModifier(Number(event.target.value) || 0)
                      }
                      className="mt-2 w-full rounded-xl border border-[#4a2c37] bg-black/30 px-4 py-3 text-[#eadbd2] outline-none focus:border-[#9b4860]"
                    />
                  </label>
                  <label className="text-sm text-[#c7b6bc]">
                    Difficulty
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={difficulty}
                      disabled={rolling || saving}
                      onChange={(event) =>
                        setDifficulty(Number(event.target.value) || 1)
                      }
                      className="mt-2 w-full rounded-xl border border-[#4a2c37] bg-black/30 px-4 py-3 text-[#eadbd2] outline-none focus:border-[#9b4860]"
                    />
                  </label>
                </div>

                <div>
                  <p className="text-sm text-[#c7b6bc]">
                    Advantage or disadvantage
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["normal", "advantage", "disadvantage"] as DualityMode[]).map(
                      (entry) => (
                        <button
                          key={entry}
                          type="button"
                          disabled={rolling || saving}
                          onClick={() => setDualityMode(entry)}
                          className={`min-h-11 rounded-xl border px-2 text-xs transition ${
                            dualityMode === entry
                              ? "border-[#9b4860] bg-[#5a1825]/35 text-[#efc7d1]"
                              : "border-[#432832] bg-black/20 text-[#8f8187] hover:border-[#6f3547]"
                          }`}
                        >
                          {dualityModeLabel(entry)}
                        </button>
                      )
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#7e7076]">
                    Advantage adds a d6. Disadvantage subtracts a d6.
                  </p>
                </div>

                {mode === "action" && (
                  <label className="flex items-center gap-3 rounded-xl border border-[#432832] bg-black/20 px-4 py-3 text-sm text-[#bda5ad]">
                    <input
                      type="checkbox"
                      checked={isAttack}
                      onChange={(event) => setIsAttack(event.target.checked)}
                      className="h-4 w-4 accent-[#8a2638]"
                    />
                    This is an attack roll
                  </label>
                )}
              </>
            )}

            {mode === "gm" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-[#c7b6bc]">
                  Attack bonus
                  <input
                    type="number"
                    value={gmAttackBonus}
                    disabled={rolling || saving}
                    onChange={(event) =>
                      setGmAttackBonus(Number(event.target.value) || 0)
                    }
                    className="mt-2 w-full rounded-xl border border-[#4a2c37] bg-black/30 px-4 py-3 text-[#eadbd2] outline-none focus:border-[#9b4860]"
                  />
                </label>
                <label className="text-sm text-[#c7b6bc]">
                  Target Evasion
                  <input
                    type="number"
                    min={1}
                    value={targetEvasion}
                    disabled={rolling || saving}
                    onChange={(event) =>
                      setTargetEvasion(Number(event.target.value) || 1)
                    }
                    className="mt-2 w-full rounded-xl border border-[#4a2c37] bg-black/30 px-4 py-3 text-[#eadbd2] outline-none focus:border-[#9b4860]"
                  />
                </label>
              </div>
            )}

            {mode === "damage" && (
              <div>
                <label className="text-sm text-[#c7b6bc]">
                  Damage formula
                  <input
                    value={damageExpression}
                    disabled={rolling || saving}
                    onChange={(event) => setDamageExpression(event.target.value)}
                    placeholder="1d8+3"
                    className="mt-2 w-full rounded-xl border border-[#4a2c37] bg-black/30 px-4 py-3 text-[#eadbd2] outline-none placeholder:text-[#654c55] focus:border-[#9b4860]"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["1d6", "1d8+3", "2d10+4", "3d12"].map((formula) => (
                    <button
                      key={formula}
                      type="button"
                      onClick={() => setDamageExpression(formula)}
                      className="rounded-lg border border-[#432832] bg-black/20 px-3 py-2 text-xs text-[#a9929a] hover:border-[#7d3b50]"
                    >
                      {formula}
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-3 rounded-xl border border-[#432832] bg-black/20 px-4 py-3 text-sm text-[#bda5ad]">
                  <input
                    type="checkbox"
                    checked={criticalDamage}
                    onChange={(event) => setCriticalDamage(event.target.checked)}
                    className="h-4 w-4 accent-[#8a2638]"
                  />
                  Critical damage — add the maximum result of all damage dice
                </label>
              </div>
            )}

            <label className="flex items-center gap-3 rounded-xl border border-[#432832] bg-black/20 px-4 py-3 text-sm text-[#bda5ad]">
              <input
                type="checkbox"
                checked={visibility === "private"}
                onChange={(event) =>
                  setVisibility(event.target.checked ? "private" : "campaign")
                }
                className="h-4 w-4 accent-[#8a2638]"
              />
              Whisper to the Mists — private roll
            </label>

            {(localError || error) && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {localError || error}
              </p>
            )}

            <button
              type="button"
              disabled={rolling || saving || (mode === "gm" && role !== "dm")}
              onClick={performCurrentRoll}
              className="min-h-12 w-full rounded-xl border border-[#a14b63] bg-[#7a2236] px-4 font-bold text-[#f2dfe4] transition hover:bg-[#8a2940] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rolling
                ? "The dice turn..."
                : saving
                  ? "Inscribing the result..."
                  : mode === "action"
                    ? "Roll Hope & Fear"
                    : mode === "reaction"
                      ? "Make Reaction Roll"
                      : mode === "gm"
                        ? "Roll Adversary Attack"
                        : "Roll Damage"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-[#4b2935] bg-[#120d11]/90 p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-[#a7566d]">
            The Mists Answer
          </p>
          <h2 className="mt-3 font-serif text-2xl font-black text-[#eadbd2]">
            Latest Outcome
          </h2>

          <div className="mt-5">
            {isDualityVisual ? (
              <DualityDiceTray
                hope={visualResult?.hopeDie ?? null}
                fear={visualResult?.fearDie ?? null}
                advantage={visualResult?.advantageDie ?? null}
                advantageMode={visualResult?.advantageMode ?? dualityMode}
                rolling={rolling}
                animationKey={animationKey}
                outcome={!rolling ? visualResult?.outcome ?? null : null}
                critical={!rolling && Boolean(visualResult?.critical)}
                reaction={visualMode === "reaction"}
              />
            ) : (
              <AnimatedDiceTray
                variant="barovia"
                dice={visualResult?.dice ?? []}
                rolling={rolling}
                animationKey={animationKey}
                omittedCount={visualResult?.omittedCount ?? 0}
                critical={!rolling && Boolean(visualResult?.critical)}
                label={
                  rolling
                    ? visualMode === "gm"
                      ? "The adversary strikes"
                      : "Damage dice in motion"
                    : visualResult?.title ?? "Stone dice tray"
                }
                emptyMessage={
                  visualMode === "gm"
                    ? "The adversary's d20 waits in shadow."
                    : "Choose a damage formula and cast the dice into the Mists."
                }
              />
            )}
          </div>

          {!rolling && latest ? (
            <div className="mt-5 rounded-3xl border border-[#713143]/55 bg-[radial-gradient(circle_at_80%_10%,rgba(118,30,51,0.28),transparent_38%),rgba(20,12,17,0.82)] p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-sm text-[#a9929a]">{latest.title}</p>
                  <p className="mt-2 font-serif text-3xl font-black text-[#edcbd4]">
                    {latest.outcome}
                  </p>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a99da1]">
                    {latest.note}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-6xl font-black text-[#ead7dc]">
                    {latest.total}
                  </p>
                  <p className="mt-2 text-xs text-[#765e67]">
                    {saving
                      ? "The result is being inscribed..."
                      : latest.savedRoll
                        ? latest.savedRoll.visibility === "private"
                          ? "Saved as a private whisper"
                          : "Saved to the Barovia campaign log"
                        : "Rolled, but database saving failed"}
                  </p>
                </div>
              </div>

              {latest.advantageDie !== undefined && (
                <div className="mt-5 rounded-xl border border-[#4d3d44] bg-black/20 px-4 py-3 text-sm text-[#9e9297]">
                  {dualityModeLabel(latest.advantageMode ?? "normal")} d6: {" "}
                  <strong className="text-[#d6c8cd]">
                    {latest.advantageDie}
                  </strong>
                </div>
              )}
            </div>
          ) : !rolling ? (
            <div className="mt-5 rounded-3xl border border-[#432832] bg-black/20 p-6 text-sm leading-6 text-[#8f8187]">
              Roll the Duality Dice to learn whether the Mists answer with Hope
              or Fear. Action and reaction rolls use two d12s; the Game Master
              uses a single d20 for adversary attacks.
            </div>
          ) : null}
        </div>
      </div>

      <CampaignDiceLog
        variant="barovia"
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
