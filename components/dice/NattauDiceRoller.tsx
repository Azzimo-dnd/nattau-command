"use client";

import type { ChangeEvent } from "react";
import { useMemo, useRef, useState } from "react";
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
  type SupportedDie,
} from "./diceUtils";
import { useCampaignDiceLog } from "./useCampaignDiceLog";
import { CampaignPhysicsDiceTrayClient } from "@/components/dice-physics/CampaignPhysicsDiceTrayClient";
import { DiceAppearancePicker } from "@/components/dice-physics/DiceAppearancePicker";
import {
  buildPhysicsDiceFromGroups,
  physicsResultToGroups,
  totalRolledGroups,
} from "@/components/dice-physics/diceRollPlan";
import { createDiceRuntimeSettings } from "@/components/dice-physics/dicePhysicsDefaults";
import { getSharedDiceSoundEngine } from "@/components/dice-physics/diceSound";
import { useCampaignDiceConfiguration } from "@/components/dice-physics/useCampaignDiceConfiguration";
import type {
  PhysicsRollRequest,
  PhysicsRollResult,
} from "@/components/dice-physics/dicePhysicsTypes";

type D20Mode = "normal" | "advantage" | "disadvantage";

type LocalNattauResult = {
  savedRoll: CampaignDiceRollRow | null;
  expression: string;
  total: number;
  mode: D20Mode;
  groups: RolledGroup[];
  keptDie: number | null;
  keptIndex: number | null;
  modifier: number;
  physics: PhysicsRollResult;
};

type PendingNattauRoll = {
  rollId: string;
  parsed: ParsedExpression;
  expressionLabel: string;
  finalModifier: number;
  finalMode: D20Mode;
  visibility: RollVisibility;
};

type NattauDiceRollerProps = {
  campaignId: string;
  currentUserId: string;
  currentUserName: string;
  role: DiceAppRole;
};

const quickDice: SupportedDie[] = [4, 6, 8, 10, 12, 20, 100];

function createRollId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  const [visibility, setVisibility] = useState<RollVisibility>("campaign");
  const [rolling, setRolling] = useState(false);
  const [request, setRequest] = useState<PhysicsRollRequest | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [latest, setLatest] = useState<LocalNattauResult | null>(null);
  const pendingRef = useRef<PendingNattauRoll | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const configuration = useCampaignDiceConfiguration({ campaignId, currentUserId });
  const diceLog = useCampaignDiceLog({ campaignId, currentUserId });
  const d20ModeAllowed = useMemo(() => canUseD20Mode(expression), [expression]);

  function focusTrayOnMobile() {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 1279px)").matches) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    window.setTimeout(() => {
      trayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  async function performRoll(
    requestedExpression = expression,
    requestedMode = mode
  ) {
    if (rolling || diceLog.saving) return;
    const parsed = parseDiceExpression(requestedExpression);
    if (!parsed) {
      setLocalError(
        "Use a valid formula such as 1d20, 2d6+3, 2d4+3d8 or 1d20+2d6+4."
      );
      return;
    }

    const useD20Mode =
      parsed.groups.length === 1 &&
      parsed.groups[0].diceCount === 1 &&
      parsed.groups[0].sides === 20;
    const finalMode = useD20Mode ? requestedMode : "normal";
    const physicalGroups =
      useD20Mode && finalMode !== "normal"
        ? [{ diceCount: 2, sides: 20 as const }]
        : parsed.groups;
    const rollId = createRollId();

    try {
      const physicalDice = buildPhysicsDiceFromGroups(
        physicalGroups,
        `nattau-${rollId}`
      );
      const expressionLabel = `${parsed.normalizedExpression}${
        extraModifier === 0 ? "" : formatModifier(extraModifier)
      }`;
      const finalModifier = parsed.modifier + extraModifier;

      setLocalError(null);
      diceLog.setError(null);
      setLatest(null);
      setRolling(true);
      pendingRef.current = {
        rollId,
        parsed,
        expressionLabel,
        finalModifier,
        finalMode,
        visibility,
      };

      if (configuration.appearance.sound) {
        await getSharedDiceSoundEngine().unlock();
      }

      focusTrayOnMobile();
      setRequest({
        rollId,
        startedAt: performance.now(),
        dice: physicalDice,
        settings: createDiceRuntimeSettings(
          configuration.physics,
          configuration.appearance,
          { cameraMode: "table" }
        ),
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "The physical throw could not be prepared.");
      setRolling(false);
    }
  }

  async function handlePhysicsComplete(physicsResult: PhysicsRollResult) {
    const pending = pendingRef.current;
    if (!pending || pending.rollId !== physicsResult.rollId) return;

    let groups: RolledGroup[];
    let keptIndex: number | null = null;
    let keptDie: number | null = null;
    let total: number;

    if (pending.finalMode !== "normal") {
      const values = physicsResult.dice.map((die) => die.value).slice(0, 2);
      keptIndex =
        pending.finalMode === "advantage"
          ? values[0] >= values[1]
            ? 0
            : 1
          : values[0] <= values[1]
            ? 0
            : 1;
      keptDie = values[keptIndex];
      groups = [{ diceCount: 2, sides: 20, results: values }];
      total = keptDie + pending.finalModifier;
    } else {
      groups = physicsResultToGroups(pending.parsed.groups, physicsResult);
      total = totalRolledGroups(groups) + pending.finalModifier;
    }

    const savedRoll = await diceLog.saveRoll({
      roll_kind: "generic",
      title: `${pending.expressionLabel} · ${modeLabel(pending.finalMode)}`,
      expression: pending.expressionLabel,
      total,
      outcome: `Rolled by ${currentUserName}`,
      visibility: pending.visibility,
      details: {
        mode: pending.finalMode,
        groups,
        kept_die: keptDie,
        kept_index: keptIndex,
        formula_modifier: pending.parsed.modifier,
        extra_modifier: extraModifier,
        final_modifier: pending.finalModifier,
        physics: {
          engine: "rapier",
          roll_id: physicsResult.rollId,
          duration_ms: Math.round(physicsResult.durationMs),
          peak_impact: physicsResult.peakImpact,
          forced_settles: physicsResult.forcedSettles,
          escape_count: physicsResult.escapeCount,
          rescued_dice: physicsResult.rescuedDice,
          timeout_rescues: physicsResult.timeoutRescues,
          simulation_profile: physicsResult.simulationProfile,
          die_scale: physicsResult.dieScale,
          tray_width: physicsResult.trayWidth,
          tray_depth: physicsResult.trayDepth,
          cosmetic_id: configuration.appearance.cosmeticId,
          number_size: configuration.appearance.numberSize,
        },
      },
    });

    setLatest({
      savedRoll,
      expression: pending.expressionLabel,
      total,
      mode: pending.finalMode,
      groups,
      keptDie,
      keptIndex,
      modifier: pending.finalModifier,
      physics: physicsResult,
    });
    pendingRef.current = null;
    setRolling(false);
  }

  function rollQuickDie(sides: SupportedDie) {
    const quickExpression = `1d${sides}`;
    setExpression(quickExpression);
    void performRoll(quickExpression, sides === 20 ? mode : "normal");
  }

  async function handleClearMine() {
    if (!window.confirm("Delete all of your saved Nattau rolls?")) return;
    await diceLog.clearMyRolls();
  }

  return (
    <section className="space-y-4 pb-24 xl:space-y-6 xl:pb-0">
      <div className="grid gap-4 xl:grid-cols-[390px_1fr] xl:gap-6">
        <div className="contents xl:block xl:space-y-6">
          <div className="order-1 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-yellow-500 sm:text-xs sm:tracking-[0.35em]">Roll Command</p>
                <h2 className="mt-2 text-xl font-bold text-slate-100 sm:mt-3 sm:text-2xl">Prepare Physical Roll</h2>
              </div>
              <div className="flex gap-2 xl:hidden">
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-xs font-bold text-slate-300"
                >
                  History
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="min-h-11 rounded-xl border border-yellow-500/35 bg-yellow-500/10 px-3 text-xs font-bold text-yellow-300"
                >
                  My Dice
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
              <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-3">
                <label className="block text-sm font-medium text-slate-300">
                  Dice formula
                  <input
                    value={expression}
                    inputMode="text"
                    disabled={rolling || diceLog.saving}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setExpression(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500 disabled:opacity-60 sm:px-4"
                    placeholder="1d20"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-300">
                  Modifier
                  <input
                    type="number"
                    value={extraModifier}
                    disabled={rolling || diceLog.saving}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setExtraModifier(Number(event.target.value) || 0)}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none focus:border-yellow-500 disabled:opacity-60"
                  />
                </label>
              </div>

              <p className="hidden text-xs leading-5 text-slate-500 xl:block">
                Physical d4, d6, d8, d10, d12, d20 and percentile dice. The engine automatically adapts tray size and die scale for large throws.
              </p>

              <div>
                <p className="text-sm font-medium text-slate-300">d20 mode</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["normal", "advantage", "disadvantage"] as D20Mode[]).map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      disabled={rolling || diceLog.saving || !d20ModeAllowed}
                      onClick={() => setMode(entry)}
                      className={`min-h-11 rounded-xl border px-2 text-[11px] transition disabled:opacity-35 sm:text-xs ${
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
                  ))}
                </div>
              </div>

              <div className="xl:hidden">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quick Dice</p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {quickDice.map((sides) => (
                    <button
                      key={sides}
                      type="button"
                      disabled={rolling || diceLog.saving}
                      onClick={() => rollQuickDie(sides)}
                      className="min-h-11 min-w-14 shrink-0 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm font-bold text-slate-300 active:border-yellow-500 active:text-yellow-300 disabled:opacity-45"
                    >
                      d{sides}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-300 sm:px-4 sm:py-3">
                <input
                  type="checkbox"
                  checked={visibility === "private"}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setVisibility(event.target.checked ? "private" : "campaign")}
                  className="h-4 w-4 accent-yellow-500"
                />
                Private roll
              </label>

              {(localError || diceLog.error || configuration.error) && (
                <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {localError || diceLog.error || configuration.error}
                </p>
              )}

              <button
                type="button"
                disabled={rolling || diceLog.saving || configuration.loading}
                onClick={() => void performRoll()}
                className="hidden min-h-12 w-full rounded-xl border border-yellow-500 bg-yellow-500 px-4 font-bold text-slate-950 transition hover:bg-yellow-400 disabled:opacity-60 xl:block"
              >
                {rolling ? "Dice in motion…" : diceLog.saving ? "Saving…" : "Roll Physical Dice"}
              </button>
            </div>
          </div>

          <div className="order-4 hidden rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:block">
            <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">Quick Dice</p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {quickDice.map((sides) => (
                <button
                  key={sides}
                  type="button"
                  disabled={rolling || diceLog.saving}
                  onClick={() => rollQuickDie(sides)}
                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-950/70 text-sm font-bold text-slate-300 hover:border-yellow-600/50 hover:text-yellow-300 disabled:opacity-45"
                >
                  d{sides}
                </button>
              ))}
            </div>
          </div>

          <div className="order-5 hidden xl:block">
            <DiceAppearancePicker
              theme="nattau"
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
              theme="nattau"
              request={request}
              onComplete={(result) => void handlePhysicsComplete(result)}
            />

            {!rolling && latest && (
              <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-yellow-500/25 bg-slate-950/88 p-3 shadow-2xl backdrop-blur-md xl:hidden">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-400">{latest.expression} · {modeLabel(latest.mode)}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-300">
                      {latest.groups.flatMap((group) => group.results).slice(0, 10).map((value, index) => (
                        <span key={`${value}-${index}`} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1">{value}</span>
                      ))}
                      {latest.groups.flatMap((group) => group.results).length > 10 && (
                        <span className="px-1 py-1 text-slate-500">+more</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Total</p>
                    <p className="text-4xl font-black leading-none text-white">{latest.total}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="order-3 hidden xl:block">
            {latest ? (
              <div className="rounded-3xl border border-slate-700 bg-slate-900/85 p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-sm text-slate-400">{latest.expression} · {modeLabel(latest.mode)}</p>
                    <p className="mt-3 text-6xl font-black text-slate-100">{latest.total}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      Physical resolution: {(latest.physics.durationMs / 1000).toFixed(2)}s · profile {latest.physics.simulationProfile}
                      {latest.savedRoll ? " · saved" : " · database save failed"}
                    </p>
                  </div>
                  {latest.keptDie !== null && (
                    <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-4 text-center">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-yellow-400">Kept d20</p>
                      <p className="mt-2 text-4xl font-black text-yellow-200">{latest.keptDie}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  {latest.groups.map((group, groupIndex) => (
                    <div key={`${group.sides}-${groupIndex}`} className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{group.diceCount}d{group.sides}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.results.map((value, index) => (
                          <span
                            key={`${value}-${index}`}
                            className={`rounded-xl border px-4 py-2 font-bold ${
                              latest.keptIndex !== null && index !== latest.keptIndex
                                ? "border-slate-800 bg-slate-900 text-slate-600 line-through"
                                : "border-yellow-500/25 bg-yellow-500/10 text-yellow-200"
                            }`}
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-sm leading-6 text-slate-400">
                Your color and number-size choice is personal. Throw force, bounce, friction and gravity are loaded from the GM&apos;s campaign settings.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden xl:block">
        <CampaignDiceLog
          variant="nattau"
          rolls={diceLog.rolls}
          loading={diceLog.loading}
          currentUserId={currentUserId}
          role={role}
          onRefresh={() => void diceLog.refresh()}
          onDelete={(rollId) => void diceLog.deleteRoll(rollId)}
          onClearMine={() => void handleClearMine()}
        />
      </div>

      <MobileDiceSheet open={settingsOpen} title="My Dice" onClose={() => setSettingsOpen(false)} tone="nattau">
        <DiceAppearancePicker
          theme="nattau"
          value={configuration.appearance}
          disabled={rolling || configuration.loading}
          saving={configuration.savingAppearance}
          onChange={(value) => void configuration.saveAppearance(value)}
        />
      </MobileDiceSheet>

      <MobileDiceSheet open={historyOpen} title="Roll History" onClose={() => setHistoryOpen(false)} tone="nattau">
        <CampaignDiceLog
          variant="nattau"
          rolls={diceLog.rolls}
          loading={diceLog.loading}
          currentUserId={currentUserId}
          role={role}
          onRefresh={() => void diceLog.refresh()}
          onDelete={(rollId) => void diceLog.deleteRoll(rollId)}
          onClearMine={() => void handleClearMine()}
        />
      </MobileDiceSheet>

      <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-700/80 bg-slate-950/92 px-3 pt-2 shadow-2xl backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1 pl-1">
            <p className="truncate text-xs font-bold text-slate-200">{expression}{extraModifier === 0 ? "" : formatModifier(extraModifier)}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">{modeLabel(mode)} · {visibility === "private" ? "Private" : "Campaign"}</p>
          </div>
          <button
            type="button"
            disabled={rolling || diceLog.saving || configuration.loading}
            onClick={() => void performRoll()}
            className="min-h-12 min-w-36 rounded-xl border border-yellow-500 bg-yellow-500 px-5 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {rolling ? "ROLLING…" : diceLog.saving ? "SAVING…" : "ROLL"}
          </button>
        </div>
      </div>
    </section>
  );
}
