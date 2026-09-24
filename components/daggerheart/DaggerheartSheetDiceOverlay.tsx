"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_PHYSICAL_DICE,
  buildPhysicsDiceFromGroups,
  countPhysicalDice,
  physicsResultToGroups,
  totalRolledGroups,
} from "@/components/dice-physics/diceRollPlan";
import { createDiceRuntimeSettings } from "@/components/dice-physics/dicePhysicsDefaults";
import { getSharedDiceSoundEngine } from "@/components/dice-physics/diceSound";
import { useCampaignDiceConfiguration } from "@/components/dice-physics/useCampaignDiceConfiguration";
import type {
  PhysicsDieRequest,
  PhysicsRollRequest,
  PhysicsRollResult,
} from "@/components/dice-physics/dicePhysicsTypes";
import { useCampaignDiceLog } from "@/components/dice/useCampaignDiceLog";
import {
  formatModifier,
  parseDiceExpression,
  type DiceGroup,
  type ParsedExpression,
  type SupportedDie,
} from "@/components/dice/diceUtils";

const ScreenDiceCanvas = dynamic(
  () =>
    import("@/components/daggerheart/DaggerheartScreenDiceCanvas").then(
      (module) => module.DaggerheartScreenDiceCanvas
    ),
  { ssr: false }
);

const QUICK_DICE: SupportedDie[] = [4, 6, 8, 10, 12, 20, 100];

export type DaggerheartSheetRollIntent =
  | {
      id: string;
      kind: "duality";
      title: string;
      modifier: number;
      source?: string;
    }
  | {
      id: string;
      kind: "damage";
      title: string;
      expression: string;
      damageType?: string;
      source?: string;
    };

type PendingRoll =
  | {
      kind: "duality";
      rollId: string;
      title: string;
      modifier: number;
      source?: string;
    }
  | {
      kind: "formula";
      rollId: string;
      title: string;
      parsed: ParsedExpression;
      rollKind: "daggerheart_damage" | "generic";
      damageType?: string;
      source?: string;
    };

type LatestResult = {
  title: string;
  total: number;
  outcome: string;
  detail: string;
};

function createRollId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyCounts(): Record<SupportedDie, number> {
  return { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 };
}

function physicsMetadata(result: PhysicsRollResult, cosmeticId: string, numberSize: string) {
  return {
    engine: "rapier",
    presentation: "character_sheet_overlay",
    roll_id: result.rollId,
    duration_ms: Math.round(result.durationMs),
    peak_impact: result.peakImpact,
    forced_settles: result.forcedSettles,
    escape_count: result.escapeCount,
    rescued_dice: result.rescuedDice,
    timeout_rescues: result.timeoutRescues,
    simulation_profile: result.simulationProfile,
    die_scale: result.dieScale,
    table_width: result.trayWidth,
    table_depth: result.trayDepth,
    cosmetic_id: cosmeticId,
    number_size: numberSize,
  };
}

export function DaggerheartSheetDiceOverlay({
  campaignId,
  currentUserId,
  externalIntent,
  onExternalIntentConsumed,
}: {
  campaignId: string;
  currentUserId: string;
  externalIntent: DaggerheartSheetRollIntent | null;
  onExternalIntentConsumed: () => void;
}) {
  const [request, setRequest] = useState<PhysicsRollRequest | null>(null);
  const [counts, setCounts] = useState<Record<SupportedDie, number>>(emptyCounts);
  const [modifier, setModifier] = useState(0);
  const [latest, setLatest] = useState<LatestResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const pendingRef = useRef<PendingRoll | null>(null);
  const clearDiceTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const clearResultTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const configuration = useCampaignDiceConfiguration({ campaignId, currentUserId });
  const diceLog = useCampaignDiceLog({ campaignId, currentUserId });
  const soundEngine = useMemo(() => getSharedDiceSoundEngine(), []);

  useEffect(
    () => () => {
      if (clearDiceTimerRef.current) window.clearTimeout(clearDiceTimerRef.current);
      if (clearResultTimerRef.current) window.clearTimeout(clearResultTimerRef.current);
    },
    []
  );

  const beginPhysicalRoll = useCallback(
    async (pending: PendingRoll, dice: PhysicsDieRequest[]) => {
      if (request || configuration.loading || dice.length === 0) return false;
      setLocalError(null);
      setLatest(null);
      pendingRef.current = pending;

      if (configuration.appearance.sound) {
        await soundEngine.unlock();
      }

      setRequest({
        rollId: pending.rollId,
        startedAt: performance.now(),
        dice,
        settings: createDiceRuntimeSettings(
          configuration.physics,
          configuration.appearance,
          { cameraMode: "top" }
        ),
      });
      return true;
    },
    [
      configuration.appearance,
      configuration.loading,
      configuration.physics,
      request,
      soundEngine,
    ]
  );

  const beginDuality = useCallback(
    async (title: string, rollModifier: number, source?: string) => {
      const rollId = createRollId();
      return beginPhysicalRoll(
        {
          kind: "duality",
          rollId,
          title,
          modifier: rollModifier,
          source,
        },
        [
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
        ]
      );
    },
    [beginPhysicalRoll]
  );

  const beginFormula = useCallback(
    async (
      title: string,
      expression: string,
      rollKind: "daggerheart_damage" | "generic",
      damageType?: string,
      source?: string
    ) => {
      const parsed = parseDiceExpression(expression);
      if (!parsed) {
        setLocalError(`Could not read dice formula: ${expression}`);
        return false;
      }

      const rollId = createRollId();
      try {
        return await beginPhysicalRoll(
          {
            kind: "formula",
            rollId,
            title,
            parsed,
            rollKind,
            damageType,
            source,
          },
          buildPhysicsDiceFromGroups(parsed.groups, `sheet-${rollId}`)
        );
      } catch (error) {
        setLocalError(error instanceof Error ? error.message : "Could not prepare the physical roll.");
        return false;
      }
    },
    [beginPhysicalRoll]
  );

  useEffect(() => {
    if (!externalIntent || request || configuration.loading) return;

    const run = async () => {
      const started =
        externalIntent.kind === "duality"
          ? await beginDuality(
              externalIntent.title,
              externalIntent.modifier,
              externalIntent.source
            )
          : await beginFormula(
              externalIntent.title,
              externalIntent.expression,
              "daggerheart_damage",
              externalIntent.damageType,
              externalIntent.source
            );
      if (started) onExternalIntentConsumed();
    };

    void run();
  }, [
    beginDuality,
    beginFormula,
    configuration.loading,
    externalIntent,
    onExternalIntentConsumed,
    request,
  ]);

  const manualGroups = useMemo<DiceGroup[]>(
    () =>
      QUICK_DICE.filter((sides) => counts[sides] > 0).map((sides) => ({
        sides,
        diceCount: counts[sides],
      })),
    [counts]
  );
  const manualPhysicalCount = countPhysicalDice(manualGroups);

  const manualExpression = useMemo(() => {
    const dice = manualGroups.map(
      (group) => `${group.diceCount === 1 ? "" : group.diceCount}d${group.sides}`
    );
    if (dice.length === 0) return "Choose dice";
    const suffix = modifier === 0 ? "" : formatModifier(modifier);
    return `${dice.join("+")}${suffix}`;
  }, [manualGroups, modifier]);

  const handlePhysicsComplete = useCallback(
    async (physics: PhysicsRollResult) => {
      const pending = pendingRef.current;
      if (!pending || pending.rollId !== physics.rollId) return;

      let result: LatestResult;

      if (pending.kind === "duality") {
        const hope = physics.dice.find((die) => die.tone === "hope")?.value ?? 0;
        const fear = physics.dice.find((die) => die.tone === "fear")?.value ?? 0;
        const total = hope + fear + pending.modifier;
        const outcome =
          hope === fear ? "Critical Success" : hope > fear ? "Roll with Hope" : "Roll with Fear";
        const expression = `Hope d12 + Fear d12 ${formatModifier(pending.modifier)}`;

        await diceLog.saveRoll({
          roll_kind: "daggerheart_action",
          title: pending.title,
          expression,
          total,
          outcome,
          visibility: "campaign",
          details: {
            hope_die: hope,
            fear_die: fear,
            modifier: pending.modifier,
            source: pending.source ?? null,
            rules_version: "Daggerheart SRD 1.0",
            physics: physicsMetadata(
              physics,
              configuration.appearance.cosmeticId,
              configuration.appearance.numberSize
            ),
          },
        });

        result = {
          title: pending.title,
          total,
          outcome,
          detail: `Hope ${hope} · Fear ${fear}${
            pending.modifier === 0 ? "" : ` · ${formatModifier(pending.modifier)}`
          }`,
        };
      } else {
        const groups = physicsResultToGroups(pending.parsed.groups, physics);
        const total = totalRolledGroups(groups) + pending.parsed.modifier;
        const outcome =
          pending.rollKind === "daggerheart_damage"
            ? `Damage${pending.damageType ? ` · ${pending.damageType}` : ""}`
            : "Manual Roll";

        await diceLog.saveRoll({
          roll_kind: pending.rollKind,
          title: pending.title,
          expression: pending.parsed.normalizedExpression,
          total,
          outcome,
          visibility: "campaign",
          details: {
            groups,
            formula_modifier: pending.parsed.modifier,
            damage_type: pending.damageType ?? null,
            source: pending.source ?? null,
            physics: physicsMetadata(
              physics,
              configuration.appearance.cosmeticId,
              configuration.appearance.numberSize
            ),
          },
        });

        result = {
          title: pending.title,
          total,
          outcome,
          detail: pending.parsed.normalizedExpression,
        };
      }

      pendingRef.current = null;
      setLatest(result);

      if (clearDiceTimerRef.current) window.clearTimeout(clearDiceTimerRef.current);
      clearDiceTimerRef.current = window.setTimeout(() => setRequest(null), 1800);

      if (clearResultTimerRef.current) window.clearTimeout(clearResultTimerRef.current);
      clearResultTimerRef.current = window.setTimeout(() => setLatest(null), 5600);
    },
    [
      configuration.appearance.cosmeticId,
      configuration.appearance.numberSize,
      diceLog,
    ]
  );

  function addDie(sides: SupportedDie) {
    if (request) return;
    const next = { ...counts, [sides]: counts[sides] + 1 };
    const nextGroups = QUICK_DICE.filter((die) => next[die] > 0).map((die) => ({
      sides: die,
      diceCount: next[die],
    }));
    if (countPhysicalDice(nextGroups) > MAX_PHYSICAL_DICE) return;
    setCounts(next);
  }

  function removeDie(sides: SupportedDie) {
    if (request) return;
    setCounts((current) => ({
      ...current,
      [sides]: Math.max(0, current[sides] - 1),
    }));
  }

  function clearManualDice() {
    if (request) return;
    setCounts(emptyCounts());
    setModifier(0);
  }

  async function rollManual() {
    if (request || manualGroups.length === 0 || manualPhysicalCount > MAX_PHYSICAL_DICE) return;
    await beginFormula("Manual Roll", manualExpression, "generic");
  }

  async function rollManualDuality() {
    if (request) return;
    await beginDuality("Manual Duality Roll", modifier, "Floating dice bar");
  }

  const busy = Boolean(request);
  const error = localError ?? configuration.error ?? diceLog.error;

  return (
    <>
      {request && (
        <div className="pointer-events-none fixed inset-0 z-[80]">
          <ScreenDiceCanvas
            request={request}
            onComplete={handlePhysicsComplete}
            onImpact={(force) => {
              if (request.settings.sound) soundEngine.impact(force);
            }}
          />
        </div>
      )}

      {latest && (
        <div className="pointer-events-none fixed inset-x-3 top-4 z-[90] flex justify-center sm:top-6">
          <div className="max-w-[min(92vw,520px)] rounded-2xl border border-[#a6536b]/55 bg-[#10090e]/94 px-5 py-3 text-center shadow-2xl backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c77b90]">
              {latest.outcome}
            </p>
            <p className="mt-1 font-serif text-lg font-black text-[#f1dce2]">
              {latest.title}
            </p>
            <p className="mt-1 text-3xl font-black text-white">{latest.total}</p>
            <p className="mt-1 text-xs text-[#b99da6]">{latest.detail}</p>
          </div>
        </div>
      )}

      <div className="fixed inset-x-2 bottom-3 z-[70] flex justify-center sm:bottom-4">
        <div className="w-full max-w-[980px] rounded-2xl border border-[#5a3441]/90 bg-[#100a0e]/94 p-2 shadow-[0_18px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl sm:p-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              disabled={busy || configuration.loading}
              onClick={() => void rollManualDuality()}
              className="min-h-10 shrink-0 rounded-xl border border-[#a25067]/55 bg-[#521928]/45 px-3 text-[11px] font-black text-[#f0ced8] disabled:opacity-35"
              title="Roll Hope & Fear using the current modifier"
            >
              Hope/Fear
            </button>

            {QUICK_DICE.map((sides) => {
              const count = counts[sides];
              return (
                <div
                  key={sides}
                  className={`flex shrink-0 overflow-hidden rounded-xl border ${
                    count > 0
                      ? "border-[#b55b73]/55 bg-[#6b2437]/25"
                      : "border-[#3c2730] bg-black/25"
                  }`}
                >
                  <button
                    type="button"
                    disabled={busy || configuration.loading}
                    onClick={() => addDie(sides)}
                    className="min-h-10 min-w-12 px-2.5 text-xs font-black text-[#dfc6ce] disabled:opacity-35"
                    title={`Add d${sides}`}
                  >
                    d{sides}
                    {count > 0 && (
                      <span className="ml-1 text-[9px] text-[#e58da5]">×{count}</span>
                    )}
                  </button>
                  {count > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeDie(sides)}
                      className="min-h-10 border-l border-[#6d3b4a] px-2 text-sm font-black text-[#c37a8e] disabled:opacity-35"
                      title={`Remove d${sides}`}
                    >
                      −
                    </button>
                  )}
                </div>
              );
            })}

            <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-[#3c2730] bg-black/25">
              <button
                type="button"
                disabled={busy}
                onClick={() => setModifier((value) => Math.max(-99, value - 1))}
                className="min-h-10 px-2.5 text-sm font-black text-[#a98d96] disabled:opacity-35"
              >
                −
              </button>
              <span className="min-w-12 border-x border-[#3c2730] px-2 text-center text-xs font-black text-[#ead8dd]">
                {modifier >= 0 ? `+${modifier}` : modifier}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => setModifier((value) => Math.min(99, value + 1))}
                className="min-h-10 px-2.5 text-sm font-black text-[#a98d96] disabled:opacity-35"
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={clearManualDice}
              className="min-h-10 shrink-0 rounded-xl border border-[#3c2730] px-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#8f777f] disabled:opacity-35"
            >
              Clear
            </button>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="max-w-44 truncate text-[11px] font-bold text-[#d5bdc5]">
                  {manualExpression}
                </p>
                <p className="text-[9px] uppercase tracking-[0.1em] text-[#715d64]">
                  {manualPhysicalCount}/{MAX_PHYSICAL_DICE} physical dice
                </p>
              </div>
              <button
                type="button"
                disabled={
                  busy ||
                  configuration.loading ||
                  manualGroups.length === 0 ||
                  manualPhysicalCount > MAX_PHYSICAL_DICE
                }
                onClick={() => void rollManual()}
                className="min-h-10 rounded-xl border border-[#b45b73]/65 bg-[#6a2135]/45 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#f3d9e0] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {busy ? "Rolling…" : "🎲 Roll"}
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-[10px] text-rose-200">
              {error}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
