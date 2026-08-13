"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { CampaignDiceLog } from "./CampaignDiceLog";
import { MobileDiceSheet } from "./MobileDiceSheet";
import type {
  CampaignDiceRollRow,
  DiceAppRole,
  RollVisibility,
} from "./diceTypes";
import {
  formatModifier,
  parseDiceExpression,
  type ParsedExpression,
  type RolledGroup,
} from "./diceUtils";
import { useCampaignDiceLog } from "./useCampaignDiceLog";
import { CampaignPhysicsDiceTrayClient } from "@/components/dice-physics/CampaignPhysicsDiceTrayClient";
import { DiceAppearancePicker } from "@/components/dice-physics/DiceAppearancePicker";
import { createDiceRuntimeSettings } from "@/components/dice-physics/dicePhysicsDefaults";
import {
  buildPhysicsDiceFromGroups,
  physicsResultToGroups,
  totalRolledGroups,
} from "@/components/dice-physics/diceRollPlan";
import { getSharedDiceSoundEngine } from "@/components/dice-physics/diceSound";
import { useCampaignDiceConfiguration } from "@/components/dice-physics/useCampaignDiceConfiguration";
import type {
  PhysicsDieRequest,
  PhysicsRollRequest,
  PhysicsRollResult,
} from "@/components/dice-physics/dicePhysicsTypes";

type DaggerheartMode = "action" | "reaction" | "gm" | "damage";
type DualityMode = "normal" | "advantage" | "disadvantage";
type DualityOutcomeKey =
  | "critical_success"
  | "success_with_hope"
  | "success_with_fear"
  | "failure_with_hope"
  | "failure_with_fear";

type PendingDualityRoll = {
  kind: "duality";
  rollId: string;
  mode: "action" | "reaction";
  dualityMode: DualityMode;
  modifier: number;
  difficulty: number;
  isAttack: boolean;
  visibility: RollVisibility;
  title: string;
  expression: string;
};

type PendingGmRoll = {
  kind: "gm";
  rollId: string;
  attackBonus: number;
  targetEvasion: number;
  visibility: RollVisibility;
};

type PendingDamageRoll = {
  kind: "damage";
  rollId: string;
  parsed: ParsedExpression;
  criticalDamage: boolean;
  maximumDiceResult: number;
  visibility: RollVisibility;
};

type PendingRoll = PendingDualityRoll | PendingGmRoll | PendingDamageRoll;

type LocalResult = {
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
  damageGroups?: RolledGroup[];
  critical?: boolean;
  physics: PhysicsRollResult;
};

type DaggerheartDiceRollerProps = {
  campaignId: string;
  currentUserId: string;
  currentUserName: string;
  role: DiceAppRole;
};

const tabs: Array<{ key: DaggerheartMode; label: string; hint: string }> = [
  { key: "action", label: "Action", hint: "Duality Dice" },
  { key: "reaction", label: "Reaction", hint: "No Hope or Fear gain" },
  { key: "gm", label: "GM Attack", hint: "d20 vs Evasion" },
  { key: "damage", label: "Damage", hint: "Weapon or spell dice" },
];

function createRollId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

function physicsMetadata(
  result: PhysicsRollResult,
  appearance: { cosmeticId: string; numberSize: string }
) {
  return {
    engine: "rapier",
    roll_id: result.rollId,
    duration_ms: Math.round(result.durationMs),
    peak_impact: result.peakImpact,
    forced_settles: result.forcedSettles,
    escape_count: result.escapeCount,
    rescued_dice: result.rescuedDice,
    timeout_rescues: result.timeoutRescues,
    simulation_profile: result.simulationProfile,
    die_scale: result.dieScale,
    tray_width: result.trayWidth,
    tray_depth: result.trayDepth,
    cosmetic_id: appearance.cosmeticId,
    number_size: appearance.numberSize,
  };
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
  const [visibility, setVisibility] = useState<RollVisibility>("campaign");
  const [rolling, setRolling] = useState(false);
  const [request, setRequest] = useState<PhysicsRollRequest | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [latest, setLatest] = useState<LocalResult | null>(null);
  const pendingRef = useRef<PendingRoll | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const configuration = useCampaignDiceConfiguration({ campaignId, currentUserId });
  const diceLog = useCampaignDiceLog({ campaignId, currentUserId });

  function focusTrayOnMobile() {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 1279px)").matches) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    window.setTimeout(() => {
      trayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  async function beginPhysicalRoll(pending: PendingRoll, dice: PhysicsDieRequest[]) {
    setLocalError(null);
    diceLog.setError(null);
    setLatest(null);
    setRolling(true);
    pendingRef.current = pending;

    if (configuration.appearance.sound) {
      await getSharedDiceSoundEngine().unlock();
    }

    focusTrayOnMobile();
    setRequest({
      rollId: pending.rollId,
      startedAt: performance.now(),
      dice,
      settings: createDiceRuntimeSettings(
        configuration.physics,
        configuration.appearance,
        { cameraMode: "table" }
      ),
    });
  }

  async function rollDuality(rollMode: "action" | "reaction") {
    if (rolling || diceLog.saving) return;
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 99) {
      setLocalError("Difficulty must be between 1 and 99.");
      return;
    }

    const rollId = createRollId();
    const dice: PhysicsDieRequest[] = [
      {
        id: `${rollId}-hope`,
        kind: "d12",
        groupIndex: 0,
        logicalDieIndex: 0,
        tone: "hope",
      },
      {
        id: `${rollId}-fear`,
        kind: "d12",
        groupIndex: 1,
        logicalDieIndex: 0,
        tone: "fear",
      },
    ];
    if (dualityMode !== "normal") {
      dice.push({
        id: `${rollId}-duality-d6`,
        kind: "d6",
        groupIndex: 2,
        logicalDieIndex: 0,
        tone: "normal",
      });
    }

    const advantageExpression =
      dualityMode === "normal"
        ? ""
        : ` ${dualityMode === "advantage" ? "+" : "-"} d6`;
    const title = rollMode === "action" ? "Action Roll" : "Reaction Roll";

    await beginPhysicalRoll(
      {
        kind: "duality",
        rollId,
        mode: rollMode,
        dualityMode,
        modifier,
        difficulty,
        isAttack,
        visibility,
        title,
        expression: `Hope d12 + Fear d12 ${formatModifier(modifier)}${advantageExpression}`,
      },
      dice
    );
  }

  async function rollGmAttack() {
    if (rolling || diceLog.saving || role !== "dm") return;
    if (!Number.isFinite(targetEvasion) || targetEvasion < 1) {
      setLocalError("Target Evasion must be at least 1.");
      return;
    }

    const rollId = createRollId();
    await beginPhysicalRoll(
      {
        kind: "gm",
        rollId,
        attackBonus: gmAttackBonus,
        targetEvasion,
        visibility,
      },
      buildPhysicsDiceFromGroups([{ diceCount: 1, sides: 20 }], `barovia-gm-${rollId}`)
    );
  }

  async function rollDamage() {
    if (rolling || diceLog.saving) return;
    const parsed = parseDiceExpression(damageExpression);
    if (!parsed) {
      setLocalError("Use a valid damage formula such as 1d8+3, 2d10+4 or 3d6.");
      return;
    }

    const rollId = createRollId();
    const maximumDiceResult = parsed.groups.reduce(
      (sum, group) => sum + group.diceCount * group.sides,
      0
    );

    try {
      await beginPhysicalRoll(
        {
          kind: "damage",
          rollId,
          parsed,
          criticalDamage,
          maximumDiceResult,
          visibility,
        },
        buildPhysicsDiceFromGroups(parsed.groups, `barovia-damage-${rollId}`)
      );
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "The physical damage roll could not be prepared."
      );
      setRolling(false);
    }
  }

  async function handlePhysicsComplete(physics: PhysicsRollResult) {
    const pending = pendingRef.current;
    if (!pending || pending.rollId !== physics.rollId) return;

    let localResult: LocalResult;
    let savedRoll: CampaignDiceRollRow | null = null;

    if (pending.kind === "duality") {
      const hopeDie = physics.dice.find((die) => die.tone === "hope")?.value ?? 0;
      const fearDie = physics.dice.find((die) => die.tone === "fear")?.value ?? 0;
      const advantageDie = physics.dice.find(
        (die) => die.kind === "d6" && die.tone === "normal"
      )?.value;
      const advantageModifier =
        advantageDie === undefined
          ? 0
          : pending.dualityMode === "advantage"
            ? advantageDie
            : -advantageDie;
      const total = hopeDie + fearDie + pending.modifier + advantageModifier;
      const outcomeKey = resolveDualityOutcome({
        hope: hopeDie,
        fear: fearDie,
        total,
        difficulty: pending.difficulty,
      });
      const outcome = outcomeLabel(outcomeKey);
      const note = getDualityNote(outcomeKey, pending.mode, pending.isAttack);

      savedRoll = await diceLog.saveRoll({
        roll_kind:
          pending.mode === "action" ? "daggerheart_action" : "daggerheart_reaction",
        title: pending.title,
        expression: pending.expression,
        total,
        outcome,
        visibility: pending.visibility,
        details: {
          hope_die: hopeDie,
          fear_die: fearDie,
          advantage_die: advantageDie ?? null,
          advantage_mode: pending.dualityMode,
          modifier: pending.modifier,
          difficulty: pending.difficulty,
          outcome_key: outcomeKey,
          is_attack: pending.isAttack,
          rules_version: "Daggerheart SRD 1.0",
          rules_note: note,
          rolled_by: currentUserName,
          physics: physicsMetadata(physics, configuration.appearance),
        },
      });

      localResult = {
        savedRoll,
        mode: pending.mode,
        title: pending.title,
        total,
        outcome,
        note,
        hopeDie,
        fearDie,
        advantageDie,
        advantageMode: pending.dualityMode,
        critical: outcomeKey === "critical_success",
        physics,
      };
    } else if (pending.kind === "gm") {
      const naturalD20 = physics.dice[0]?.value ?? 0;
      const total = naturalD20 + pending.attackBonus;
      const critical = naturalD20 === 20;
      const success = critical || total >= pending.targetEvasion;
      const outcome = critical ? "Critical Hit" : success ? "Hit" : "Miss";
      const note = critical
        ? "A natural 20 automatically succeeds. Roll damage normally, then add the maximum possible result of the damage dice."
        : success
          ? "The attack meets or beats the target's Evasion. Roll damage."
          : "The attack total is lower than the target's Evasion.";

      savedRoll = await diceLog.saveRoll({
        roll_kind: "daggerheart_gm",
        title: "Adversary Attack",
        expression: `d20 ${formatModifier(pending.attackBonus)} vs Evasion ${pending.targetEvasion}`,
        total,
        outcome,
        visibility: pending.visibility,
        details: {
          natural_d20: naturalD20,
          attack_bonus: pending.attackBonus,
          target_evasion: pending.targetEvasion,
          critical,
          success,
          rules_version: "Daggerheart SRD 1.0",
          rules_note: note,
          rolled_by: currentUserName,
          physics: physicsMetadata(physics, configuration.appearance),
        },
      });

      localResult = {
        savedRoll,
        mode: "gm",
        title: "Adversary Attack",
        total,
        outcome,
        note,
        naturalD20,
        critical,
        physics,
      };
    } else {
      const damageGroups = physicsResultToGroups(pending.parsed.groups, physics);
      const diceTotal = totalRolledGroups(damageGroups);
      const total =
        diceTotal +
        pending.parsed.modifier +
        (pending.criticalDamage ? pending.maximumDiceResult : 0);
      const outcome = pending.criticalDamage ? "Critical Damage" : "Damage Roll";
      const note = pending.criticalDamage
        ? `Critical damage adds the maximum possible result of the damage dice: +${pending.maximumDiceResult}.`
        : "Apply the result using the target's damage thresholds, resistances and armor rules.";
      const expression = pending.criticalDamage
        ? `${pending.parsed.normalizedExpression} + max dice (${pending.maximumDiceResult})`
        : pending.parsed.normalizedExpression;

      savedRoll = await diceLog.saveRoll({
        roll_kind: "daggerheart_damage",
        title: outcome,
        expression,
        total,
        outcome,
        visibility: pending.visibility,
        details: {
          groups: damageGroups,
          formula_modifier: pending.parsed.modifier,
          critical_damage: pending.criticalDamage,
          maximum_dice_result: pending.maximumDiceResult,
          rules_version: "Daggerheart SRD 1.0",
          rolled_by: currentUserName,
          physics: physicsMetadata(physics, configuration.appearance),
        },
      });

      localResult = {
        savedRoll,
        mode: "damage",
        title: outcome,
        total,
        outcome,
        note,
        damageGroups,
        critical: pending.criticalDamage,
        physics,
      };
    }

    setLatest(localResult);
    pendingRef.current = null;
    setRolling(false);
  }

  function performCurrentRoll() {
    if (mode === "action") return void rollDuality("action");
    if (mode === "reaction") return void rollDuality("reaction");
    if (mode === "gm") return void rollGmAttack();
    return void rollDamage();
  }

  async function handleClearMine() {
    if (!window.confirm("Delete all of your saved Barovia rolls?")) return;
    await diceLog.clearMyRolls();
  }

  return (
    <section className="space-y-4 pb-24 xl:space-y-6 xl:pb-0">
      <div className="grid gap-4 xl:grid-cols-[410px_1fr] xl:gap-6">
        <div className="contents xl:block xl:space-y-6">
          <div className="order-1 rounded-3xl border border-[#4b2935] bg-[#120d11]/90 p-4 sm:p-5 xl:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#a7566d] sm:text-xs sm:tracking-[0.35em]">The Duality</p>
                <h2 className="mt-2 font-serif text-xl font-black text-[#eadbd2] sm:mt-3 sm:text-2xl">Choose the Physical Roll</h2>
              </div>
              <div className="flex gap-2 xl:hidden">
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="min-h-11 rounded-xl border border-[#432832] bg-black/25 px-3 text-xs font-bold text-[#c7b6bc]"
                >
                  History
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="min-h-11 rounded-xl border border-[#9b4860]/60 bg-[#5a1825]/30 px-3 text-xs font-bold text-[#efc7d1]"
                >
                  My Dice
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  disabled={rolling || diceLog.saving || (tab.key === "gm" && role !== "dm")}
                  onClick={() => setMode(tab.key)}
                  className={`min-h-14 rounded-2xl border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-35 sm:min-h-16 sm:p-3 ${
                    mode === tab.key
                      ? "border-[#a14b63] bg-[#5a1825]/35 text-[#efd2da]"
                      : "border-[#432832] bg-black/20 text-[#a9929a] hover:border-[#6f3547]"
                  }`}
                >
                  <span className="block text-sm font-semibold">{tab.label}</span>
                  <span className="mt-1 hidden text-[10px] uppercase tracking-wide opacity-70 sm:block">{tab.hint}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
              {(mode === "action" || mode === "reaction") && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm text-[#c7b6bc]">
                      Modifier
                      <input
                        type="number"
                        value={modifier}
                        disabled={rolling || diceLog.saving}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setModifier(Number(event.target.value) || 0)}
                        className="mt-2 w-full rounded-xl border border-[#4a2c37] bg-black/30 px-3 py-3 text-[#eadbd2] outline-none focus:border-[#9b4860] sm:px-4"
                      />
                    </label>
                    <label className="text-sm text-[#c7b6bc]">
                      Difficulty
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={difficulty}
                        disabled={rolling || diceLog.saving}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setDifficulty(Number(event.target.value) || 1)}
                        className="mt-2 w-full rounded-xl border border-[#4a2c37] bg-black/30 px-3 py-3 text-[#eadbd2] outline-none focus:border-[#9b4860] sm:px-4"
                      />
                    </label>
                  </div>

                  <div>
                    <p className="text-sm text-[#c7b6bc]">Advantage or disadvantage</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(["normal", "advantage", "disadvantage"] as DualityMode[]).map((entry) => (
                        <button
                          key={entry}
                          type="button"
                          disabled={rolling || diceLog.saving}
                          onClick={() => setDualityMode(entry)}
                          className={`min-h-11 rounded-xl border px-2 text-[11px] transition sm:text-xs ${
                            dualityMode === entry
                              ? "border-[#9b4860] bg-[#5a1825]/35 text-[#efc7d1]"
                              : "border-[#432832] bg-black/20 text-[#8f8187] hover:border-[#6f3547]"
                          }`}
                        >
                          {dualityModeLabel(entry)}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 hidden text-xs leading-5 text-[#7e7076] xl:block">Advantage adds a physical d6. Disadvantage subtracts it.</p>
                  </div>

                  {mode === "action" && (
                    <label className="flex items-center gap-3 rounded-xl border border-[#432832] bg-black/20 px-3 py-2.5 text-sm text-[#bda5ad] sm:px-4 sm:py-3">
                      <input
                        type="checkbox"
                        checked={isAttack}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setIsAttack(event.target.checked)}
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
                      disabled={rolling || diceLog.saving}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setGmAttackBonus(Number(event.target.value) || 0)}
                      className="mt-2 w-full rounded-xl border border-[#4a2c37] bg-black/30 px-3 py-3 text-[#eadbd2] outline-none focus:border-[#9b4860] sm:px-4"
                    />
                  </label>
                  <label className="text-sm text-[#c7b6bc]">
                    Target Evasion
                    <input
                      type="number"
                      min={1}
                      value={targetEvasion}
                      disabled={rolling || diceLog.saving}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setTargetEvasion(Number(event.target.value) || 1)}
                      className="mt-2 w-full rounded-xl border border-[#4a2c37] bg-black/30 px-3 py-3 text-[#eadbd2] outline-none focus:border-[#9b4860] sm:px-4"
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
                      disabled={rolling || diceLog.saving}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setDamageExpression(event.target.value)}
                      placeholder="1d8+3"
                      className="mt-2 w-full rounded-xl border border-[#4a2c37] bg-black/30 px-4 py-3 text-[#eadbd2] outline-none placeholder:text-[#654c55] focus:border-[#9b4860]"
                    />
                  </label>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {["1d6", "1d8+3", "2d10+4", "3d12"].map((formula) => (
                      <button
                        key={formula}
                        type="button"
                        disabled={rolling || diceLog.saving}
                        onClick={() => setDamageExpression(formula)}
                        className="min-h-10 shrink-0 rounded-lg border border-[#432832] bg-black/20 px-3 text-xs text-[#a9929a] hover:border-[#7d3b50] disabled:opacity-40"
                      >
                        {formula}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 flex items-center gap-3 rounded-xl border border-[#432832] bg-black/20 px-3 py-2.5 text-sm text-[#bda5ad] sm:px-4 sm:py-3">
                    <input
                      type="checkbox"
                      checked={criticalDamage}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setCriticalDamage(event.target.checked)}
                      className="h-4 w-4 accent-[#8a2638]"
                    />
                    Critical damage
                  </label>
                </div>
              )}

              <label className="flex items-center gap-3 rounded-xl border border-[#432832] bg-black/20 px-3 py-2.5 text-sm text-[#bda5ad] sm:px-4 sm:py-3">
                <input
                  type="checkbox"
                  checked={visibility === "private"}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setVisibility(event.target.checked ? "private" : "campaign")}
                  className="h-4 w-4 accent-[#8a2638]"
                />
                Whisper to the Mists — private roll
              </label>

              {(localError || diceLog.error || configuration.error) && (
                <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {localError || diceLog.error || configuration.error}
                </p>
              )}

              <button
                type="button"
                disabled={rolling || diceLog.saving || configuration.loading || (mode === "gm" && role !== "dm")}
                onClick={performCurrentRoll}
                className="hidden min-h-12 w-full rounded-xl border border-[#a14b63] bg-[#7a2236] px-4 font-bold text-[#f2dfe4] transition hover:bg-[#8a2940] disabled:cursor-not-allowed disabled:opacity-50 xl:block"
              >
                {rolling
                  ? "The physical dice turn…"
                  : diceLog.saving
                    ? "Inscribing the result…"
                    : mode === "action"
                      ? "Roll Hope & Fear"
                      : mode === "reaction"
                        ? "Make Reaction Roll"
                        : mode === "gm"
                          ? "Roll Adversary Attack"
                          : "Roll Physical Damage"}
              </button>
            </div>
          </div>

          <div className="order-4 hidden xl:block">
            <DiceAppearancePicker
              theme="barovia"
              value={configuration.appearance}
              disabled={rolling || configuration.loading}
              saving={configuration.savingAppearance}
              onChange={(value) => void configuration.saveAppearance(value)}
            />
          </div>
        </div>

        <div className="contents xl:block xl:space-y-5">
          <div ref={trayRef} className="relative order-2 min-w-0 scroll-mt-4">
            <CampaignPhysicsDiceTrayClient
              theme="barovia"
              request={request}
              onComplete={(result) => void handlePhysicsComplete(result)}
            />

            {!rolling && latest && (
              <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-[#8f4057]/60 bg-[#120a0f]/90 p-3 shadow-2xl backdrop-blur-md xl:hidden">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-[#c9788d]">{latest.title}</p>
                    <p className="mt-1 truncate font-serif text-lg font-black text-[#f0d4dc]">{latest.outcome}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                      {latest.hopeDie !== undefined && latest.fearDie !== undefined && (
                        <>
                          <span className="rounded-lg border border-[#c6ad73]/30 bg-[#e8d9af]/10 px-2 py-1 text-[#fff1bf]">Hope {latest.hopeDie}</span>
                          <span className="rounded-lg border border-[#8f4057]/50 bg-[#5a1825]/25 px-2 py-1 text-[#f0b8c6]">Fear {latest.fearDie}</span>
                        </>
                      )}
                      {latest.naturalD20 !== undefined && (
                        <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[#d6c8cd]">d20 {latest.naturalD20}</span>
                      )}
                      {latest.damageGroups?.flatMap((group) => group.results).slice(0, 8).map((value, index) => (
                        <span key={`${value}-${index}`} className="rounded-lg border border-[#713143]/40 bg-[#5a1825]/20 px-2 py-1 text-[#edcbd4]">{value}</span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#765e67]">Total</p>
                    <p className="text-4xl font-black leading-none text-[#ead7dc]">{latest.total}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="order-3 hidden xl:block">
            {!rolling && latest ? (
              <div className="rounded-3xl border border-[#713143]/55 bg-[radial-gradient(circle_at_80%_10%,rgba(118,30,51,0.28),transparent_38%),rgba(20,12,17,0.82)] p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-sm text-[#a9929a]">{latest.title}</p>
                    <p className="mt-2 font-serif text-3xl font-black text-[#edcbd4]">{latest.outcome}</p>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a99da1]">{latest.note}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-6xl font-black text-[#ead7dc]">{latest.total}</p>
                    <p className="mt-2 text-xs text-[#765e67]">
                      Physical resolution: {(latest.physics.durationMs / 1000).toFixed(2)}s · profile {latest.physics.simulationProfile} · {latest.savedRoll ? "saved" : "database save failed"}
                    </p>
                  </div>
                </div>

                {latest.hopeDie !== undefined && latest.fearDie !== undefined && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#c6ad73]/40 bg-[#e8d9af]/10 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#d8c18b]">Hope d12</p>
                      <p className="mt-2 text-4xl font-black text-[#fff1bf]">{latest.hopeDie}</p>
                    </div>
                    <div className="rounded-2xl border border-[#8f4057]/60 bg-[#5a1825]/25 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#c9788d]">Fear d12</p>
                      <p className="mt-2 text-4xl font-black text-[#f0b8c6]">{latest.fearDie}</p>
                    </div>
                  </div>
                )}

                {latest.advantageDie !== undefined && (
                  <div className="mt-4 rounded-xl border border-[#4d3d44] bg-black/20 px-4 py-3 text-sm text-[#9e9297]">
                    {dualityModeLabel(latest.advantageMode ?? "normal")} d6: <strong className="text-[#d6c8cd]">{latest.advantageDie}</strong>
                  </div>
                )}

                {latest.naturalD20 !== undefined && (
                  <div className="mt-4 rounded-xl border border-[#4d3d44] bg-black/20 px-4 py-3 text-sm text-[#9e9297]">
                    Natural d20: <strong className="text-[#d6c8cd]">{latest.naturalD20}</strong>
                  </div>
                )}

                {latest.damageGroups && (
                  <div className="mt-5 space-y-3">
                    {latest.damageGroups.map((group, groupIndex) => (
                      <div key={`${group.sides}-${groupIndex}`} className="rounded-2xl border border-[#432832] bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#765e67]">{group.diceCount}d{group.sides}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {group.results.map((value, index) => (
                            <span key={`${value}-${index}`} className="rounded-xl border border-[#713143]/45 bg-[#5a1825]/20 px-4 py-2 font-bold text-[#edcbd4]">
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : !rolling ? (
              <div className="rounded-3xl border border-[#432832] bg-black/20 p-6 text-sm leading-6 text-[#8f8187]">
                Your color, texture and number size are personal. Hope and Fear remain visually distinct, while throw force, bounce, friction and gravity come from the GM&apos;s Barovia settings.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="hidden xl:block">
        <CampaignDiceLog
          variant="barovia"
          rolls={diceLog.rolls}
          loading={diceLog.loading}
          currentUserId={currentUserId}
          role={role}
          onRefresh={() => void diceLog.refresh()}
          onDelete={(rollId) => void diceLog.deleteRoll(rollId)}
          onClearMine={() => void handleClearMine()}
        />
      </div>

      <MobileDiceSheet open={settingsOpen} title="My Dice" onClose={() => setSettingsOpen(false)} tone="barovia">
        <DiceAppearancePicker
          theme="barovia"
          value={configuration.appearance}
          disabled={rolling || configuration.loading}
          saving={configuration.savingAppearance}
          onChange={(value) => void configuration.saveAppearance(value)}
        />
      </MobileDiceSheet>

      <MobileDiceSheet open={historyOpen} title="Roll History" onClose={() => setHistoryOpen(false)} tone="barovia">
        <CampaignDiceLog
          variant="barovia"
          rolls={diceLog.rolls}
          loading={diceLog.loading}
          currentUserId={currentUserId}
          role={role}
          onRefresh={() => void diceLog.refresh()}
          onDelete={(rollId) => void diceLog.deleteRoll(rollId)}
          onClearMine={() => void handleClearMine()}
        />
      </MobileDiceSheet>

      <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#4b2935] bg-[#120d11]/94 px-3 pt-2 shadow-2xl backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1 pl-1">
            <p className="truncate text-xs font-bold text-[#eadbd2]">
              {mode === "action" ? "Action Roll" : mode === "reaction" ? "Reaction Roll" : mode === "gm" ? "Adversary Attack" : damageExpression}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[#765e67]">{visibility === "private" ? "Private" : "Campaign"}</p>
          </div>
          <button
            type="button"
            disabled={rolling || diceLog.saving || configuration.loading || (mode === "gm" && role !== "dm")}
            onClick={performCurrentRoll}
            className="min-h-12 min-w-36 rounded-xl border border-[#a14b63] bg-[#7a2236] px-4 text-sm font-black text-[#f2dfe4] disabled:opacity-50"
          >
            {rolling ? "ROLLING…" : diceLog.saving ? "SAVING…" : "ROLL"}
          </button>
        </div>
      </div>
    </section>
  );
}
