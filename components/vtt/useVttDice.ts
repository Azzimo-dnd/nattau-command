"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeVttChannel } from "./vttRealtime";
import { createClient } from "@/lib/supabase/client";
import { useCampaignDiceConfiguration } from "@/components/dice-physics/useCampaignDiceConfiguration";
import {
  buildPhysicsDiceFromGroups,
  countPhysicalDice,
  physicsResultToGroups,
  totalRolledGroups,
} from "@/components/dice-physics/diceRollPlan";
import { createDiceRuntimeSettings } from "@/components/dice-physics/dicePhysicsDefaults";
import { getSharedDiceSoundEngine } from "@/components/dice-physics/diceSound";
import { getDiceCosmetic } from "@/components/dice-physics/diceCosmetics";
import type { PhysicsRollRequest, PhysicsRollResult } from "@/components/dice-physics/dicePhysicsTypes";
import type { DiceGroup, RolledGroup, SupportedDie } from "@/components/dice/diceUtils";
import { resolveDuality, type DualityResult } from "./vttDuality";
import { useVttDiceHistory } from "./useVttDiceHistory";

export type VttRollKind = "custom" | "duality";

export type VttDiceMode = "normal" | "advantage" | "disadvantage";

export type VttDiceEnvelope = {
  rollId: string;
  sceneId: string;
  rollerId: string;
  rollerName: string;
  expression: string;
  mode: VttDiceMode;
  modifier: number;
  sourceGroups: DiceGroup[];
  rollKind?: VttRollKind;
  request: PhysicsRollRequest;
  createdAt: number;
};

export type VttDiceResultToast = {
  rollId: string;
  sceneId: string;
  rollerId: string;
  rollerName: string;
  expression: string;
  mode: VttDiceMode;
  total: number;
  keptDie: number | null;
  duality?: DualityResult;
};

type PendingLocalRoll = {
  envelope: VttDiceEnvelope;
};

type Counts = Record<SupportedDie, number>;

const DIE_ORDER: SupportedDie[] = [4, 6, 8, 10, 12, 20, 100];
const MAX_VTT_PHYSICAL_DICE = 12;

function emptyCounts(): Counts {
  return { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 };
}

function defaultCounts(): Counts {
  return { ...emptyCounts(), 20: 1 };
}

function createRollId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function groupsFromCounts(counts: Counts): DiceGroup[] {
  return DIE_ORDER
    .map((sides) => ({ diceCount: counts[sides], sides }))
    .filter((group) => group.diceCount > 0);
}

function expressionFromGroups(groups: DiceGroup[], modifier: number) {
  const dice = groups.map((group) => `${group.diceCount}d${group.sides}`).join(" + ");
  if (!dice) return "No dice";
  if (modifier === 0) return dice;
  return `${dice} ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}`;
}

function isEnvelope(value: unknown): value is VttDiceEnvelope {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<VttDiceEnvelope>;
  return typeof record.rollId === "string"
    && typeof record.sceneId === "string"
    && typeof record.rollerId === "string"
    && typeof record.rollerName === "string"
    && typeof record.expression === "string"
    && record.request !== null && typeof record.request === "object"
    && Array.isArray(record.request.dice) && record.request.dice.length > 0 && record.request.dice.length <= MAX_VTT_PHYSICAL_DICE
    && record.request.dice.every((die) => ["d4", "d6", "d8", "d10", "d12", "d20"].includes(die.kind))
    && ["normal", "advantage", "disadvantage"].includes(record.mode ?? "")
    && Number.isFinite(record.modifier)
    && Array.isArray(record.sourceGroups);
}

function isResultToast(value: unknown): value is VttDiceResultToast {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<VttDiceResultToast>;
  return typeof record.rollId === "string"
    && typeof record.sceneId === "string"
    && typeof record.rollerId === "string"
    && typeof record.rollerName === "string"
    && typeof record.expression === "string"
    && typeof record.total === "number";
}

function d20ModeAllowed(groups: DiceGroup[]) {
  return groups.length === 1 && groups[0].sides === 20 && groups[0].diceCount === 1;
}

export function useVttDice({
  campaignId,
  currentUserId,
  currentUserName,
  sceneId,
  daggerheart = false,
  sharedScene = false,
}: {
  campaignId: string;
  currentUserId: string;
  currentUserName: string;
  sceneId: string | null;
  daggerheart?: boolean;
  sharedScene?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const configuration = useCampaignDiceConfiguration({ campaignId, currentUserId });
  const {
    rolls: historyRolls,
    loading: historyLoading,
    saving: historySaving,
    clearing: historyClearing,
    error: historyError,
    saveRoll: saveHistoryRoll,
    clearScene: clearHistory,
  } = useVttDiceHistory(sceneId);
  const soundEngine = useMemo(() => getSharedDiceSoundEngine(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sceneIdRef = useRef<string | null>(sceneId);
  const activeRef = useRef<VttDiceEnvelope | null>(null);
  const pendingLocalRef = useRef<PendingLocalRoll | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const remoteWatchdogRef = useRef<number | null>(null);

  const [rollKind, setRollKind] = useState<VttRollKind>(daggerheart ? "duality" : "custom");
  const [counts, setCounts] = useState<Counts>(() => daggerheart ? { ...emptyCounts(), 12: 2 } : defaultCounts());
  const [modifier, setModifier] = useState(0);
  const [mode, setMode] = useState<VttDiceMode>("normal");
  const [activeRoll, setActiveRoll] = useState<VttDiceEnvelope | null>(null);
  const [latestResult, setLatestResult] = useState<VttDiceResultToast | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const groups = useMemo(() => groupsFromCounts(counts), [counts]);
  const duality = rollKind === "duality";
  const canUseD20Mode = useMemo(() => duality || d20ModeAllowed(groups), [duality, groups]);
  const effectiveMode = canUseD20Mode ? mode : "normal";
  const physicalGroups = useMemo(
    () => duality
      ? [{ diceCount: 2, sides: 12 as const }, ...(effectiveMode === "normal" ? [] : [{ diceCount: 1, sides: 6 as const }])]
      : canUseD20Mode && effectiveMode !== "normal" ? [{ diceCount: 2, sides: 20 as const }] : groups,
    [canUseD20Mode, duality, effectiveMode, groups],
  );
  const physicalCount = useMemo(() => countPhysicalDice(physicalGroups), [physicalGroups]);
  const expression = useMemo(() => duality ? `Hope d12 + Fear d12${modifier ? ` ${modifier > 0 ? "+" : "−"} ${Math.abs(modifier)}` : ""}${effectiveMode === "normal" ? "" : effectiveMode === "advantage" ? " + d6" : " − d6"}` : expressionFromGroups(groups, modifier), [duality, effectiveMode, groups, modifier]);
  const cosmetic = useMemo(
    () => getDiceCosmetic(configuration.appearance.cosmeticId),
    [configuration.appearance.cosmeticId],
  );

  const [rollSceneId, setRollSceneId] = useState(sceneId);
  if (rollSceneId !== sceneId) {
    setRollSceneId(sceneId);
    setLatestResult(null);
    setActiveRoll(null);
  }

  useEffect(() => {
    sceneIdRef.current = sceneId;
    activeRef.current = null;
    pendingLocalRef.current = null;
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    if (remoteWatchdogRef.current) window.clearTimeout(remoteWatchdogRef.current);
  }, [sceneId]);

  const clearActiveAfter = useCallback((rollId: string, milliseconds = 3200) => {
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      if (activeRef.current?.rollId !== rollId) return;
      activeRef.current = null;
      setActiveRoll(null);
    }, milliseconds);
  }, []);

  const beginEnvelope = useCallback((envelope: VttDiceEnvelope) => {
    if (envelope.sceneId !== sceneIdRef.current) return;
    if (activeRef.current?.rollId === envelope.rollId) return;
    // The first beta deliberately serializes shared throws. A second simultaneous
    // broadcast is ignored rather than letting two physics worlds overlap.
    if (activeRef.current) return;
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    if (remoteWatchdogRef.current) window.clearTimeout(remoteWatchdogRef.current);
    setLatestResult(null);
    activeRef.current = envelope;
    setActiveRoll(envelope);
  }, []);

  useEffect(() => {
    if (!sceneId || !sharedScene) return;
    const channel = supabase
      .channel(`vtt:dice:${sceneId}`, { config: { private: true } })
      .on("broadcast", { event: "roll-start" }, ({ payload }) => {
        if (!isEnvelope(payload)) return;
        if (payload.sceneId !== sceneIdRef.current) return;
        if (payload.rollerId === currentUserId && pendingLocalRef.current?.envelope.rollId === payload.rollId) return;
        beginEnvelope({
          ...payload,
          request: { ...payload.request, startedAt: performance.now() },
        });
      })
      .on("broadcast", { event: "roll-result" }, ({ payload }) => {
        if (!isResultToast(payload) || payload.sceneId !== sceneIdRef.current) return;
        setLatestResult(payload);
        if (activeRef.current?.rollId === payload.rollId) clearActiveAfter(payload.rollId);
      });

    const unsubscribe = subscribeVttChannel(supabase, channel);
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      unsubscribe();
    };
  }, [beginEnvelope, clearActiveAfter, currentUserId, sceneId, sharedScene, supabase]);

  useEffect(() => () => {
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    if (remoteWatchdogRef.current) window.clearTimeout(remoteWatchdogRef.current);
  }, []);

  const addDie = useCallback((sides: SupportedDie) => {
    if (activeRef.current) return;
    setRollKind("custom");
    setMode("normal");
    setCounts((current) => ({ ...current, [sides]: Math.min(12, current[sides] + 1) }));
  }, []);

  const removeDie = useCallback((sides: SupportedDie) => {
    if (activeRef.current) return;
    setRollKind("custom");
    setMode("normal");
    setCounts((current) => ({ ...current, [sides]: Math.max(0, current[sides] - 1) }));
  }, []);

  const clearDice = useCallback(() => {
    if (activeRef.current) return;
    setRollKind("custom");
    setCounts(emptyCounts());
    setModifier(0);
    setMode("normal");
  }, []);

  const roll = useCallback(async () => {
    if (!sceneId || activeRef.current || configuration.loading || historySaving) return;
    if (groups.length === 0) {
      setLocalError("Add at least one die before rolling.");
      return;
    }
    if (physicalCount > MAX_VTT_PHYSICAL_DICE) {
      setLocalError(`VTT quick rolls support up to ${MAX_VTT_PHYSICAL_DICE} physical dice. Use the full Dice Roller for larger throws.`);
      return;
    }

    const rollId = createRollId();
    try {
      const dice = buildPhysicsDiceFromGroups(physicalGroups, `vtt-${rollId}`).map((die) => duality && die.groupIndex === 0 ? { ...die, tone: die.logicalDieIndex === 0 ? "hope" as const : "fear" as const } : die);
      const envelope: VttDiceEnvelope = {
        rollId,
        sceneId,
        rollerId: currentUserId,
        rollerName: currentUserName,
        expression,
        mode: effectiveMode,
        modifier,
        sourceGroups: duality ? physicalGroups : groups,
        rollKind,
        request: {
          rollId,
          startedAt: performance.now(),
          dice,
          settings: createDiceRuntimeSettings(
            configuration.physics,
            configuration.appearance,
            { cameraMode: "table" },
          ),
        },
        createdAt: Date.now(),
      };

      setLocalError(null);
      setLatestResult(null);
      pendingLocalRef.current = { envelope };
      activeRef.current = envelope;
      setActiveRoll(envelope);

      if (configuration.appearance.sound) await soundEngine.unlock();
      void channelRef.current?.send({ type: "broadcast", event: "roll-start", payload: envelope });
    } catch (cause) {
      pendingLocalRef.current = null;
      activeRef.current = null;
      setActiveRoll(null);
      setLocalError(cause instanceof Error ? cause.message : "Could not prepare the VTT dice roll.");
    }
  }, [configuration.appearance, configuration.loading, configuration.physics, currentUserId, currentUserName, duality, effectiveMode, expression, groups, historySaving, modifier, physicalCount, physicalGroups, rollKind, sceneId, soundEngine]);

  const handlePhysicsComplete = useCallback(async (physicsResult: PhysicsRollResult) => {
    const envelope = activeRef.current;
    if (!envelope || envelope.rollId !== physicsResult.rollId) return;

    if (envelope.rollerId !== currentUserId) {
      if (remoteWatchdogRef.current) window.clearTimeout(remoteWatchdogRef.current);
      remoteWatchdogRef.current = window.setTimeout(() => {
        if (activeRef.current?.rollId === envelope.rollId) {
          activeRef.current = null;
          setActiveRoll(null);
        }
      }, 5200);
      return;
    }

    const pending = pendingLocalRef.current;
    if (!pending || pending.envelope.rollId !== physicsResult.rollId) return;

    let rolledGroups: RolledGroup[];
    let keptDie: number | null = null;
    let keptIndex: number | null = null;
    let total: number;

    let dualityResult: DualityResult | undefined;
    if (envelope.rollKind === "duality") {
      try {
        dualityResult = resolveDuality(
          physicsResult.dice.find((die) => die.tone === "hope")?.value ?? 0,
          physicsResult.dice.find((die) => die.tone === "fear")?.value ?? 0,
          envelope.modifier, envelope.mode,
          physicsResult.dice.find((die) => die.groupIndex === 1)?.value ?? null,
        );
      } catch (cause) {
        pendingLocalRef.current = null;
        setLocalError(cause instanceof Error ? cause.message : "Could not read Duality Dice.");
        clearActiveAfter(envelope.rollId, 500);
        return;
      }
      rolledGroups = physicsResultToGroups(envelope.sourceGroups, physicsResult);
      total = dualityResult.total;
    } else if (envelope.mode !== "normal") {
      const values = physicsResult.dice.map((die) => die.value).slice(0, 2);
      keptIndex = envelope.mode === "advantage"
        ? (values[0] >= values[1] ? 0 : 1)
        : (values[0] <= values[1] ? 0 : 1);
      keptDie = values[keptIndex] ?? 0;
      rolledGroups = [{ diceCount: 2, sides: 20, results: values }];
      total = keptDie + envelope.modifier;
    } else {
      rolledGroups = physicsResultToGroups(envelope.sourceGroups, physicsResult);
      total = totalRolledGroups(rolledGroups) + envelope.modifier;
    }

    const toast: VttDiceResultToast = {
      rollId: envelope.rollId,
      sceneId: envelope.sceneId,
      rollerId: envelope.rollerId,
      rollerName: envelope.rollerName,
      expression: envelope.expression,
      mode: envelope.mode,
      total,
      keptDie,
      duality: dualityResult,
    };

    pendingLocalRef.current = null;
    await saveHistoryRoll({
      rollKey: envelope.rollId,
      sceneId: envelope.sceneId,
      expression: envelope.expression,
      mode: envelope.mode,
      modifier: envelope.modifier,
      total,
      details: {
        groups: rolledGroups,
        ...(dualityResult ? { duality: dualityResult, system: "daggerheart", roll_kind: "action" } : {}),
        kept_die: keptDie,
        kept_index: keptIndex,
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
          table_width: physicsResult.trayWidth,
          table_depth: physicsResult.trayDepth,
          cosmetic_id: envelope.request.settings.cosmeticId,
          number_size: envelope.request.settings.numberSize,
        },
      },
    });

    if (sceneIdRef.current !== envelope.sceneId) return;
    setLatestResult(toast);
    void channelRef.current?.send({ type: "broadcast", event: "roll-result", payload: toast });
    clearActiveAfter(envelope.rollId);
  }, [clearActiveAfter, currentUserId, saveHistoryRoll]);

  const handleImpact = useCallback((force: number) => {
    const envelope = activeRef.current;
    if (!envelope?.request.settings.sound) return;
    soundEngine.impact(force);
  }, [soundEngine]);

  const error = localError ?? configuration.error ?? historyError;
  const canRoll = Boolean(sceneId)
    && groups.length > 0
    && physicalCount <= MAX_VTT_PHYSICAL_DICE
    && !activeRoll
    && !configuration.loading
    && !historySaving;

  return {
    rollKind,
    selectDuality: () => {
      if (!daggerheart || activeRef.current) return;
      setRollKind("duality"); setCounts({ ...emptyCounts(), 12: 2 }); setMode("normal");
    },
    selectAdversary: () => {
      if (activeRef.current) return;
      setRollKind("custom"); setCounts(defaultCounts()); setMode("normal");
    },
    counts,
    modifier,
    mode: effectiveMode,
    groups,
    expression,
    physicalCount,
    maxPhysicalDice: MAX_VTT_PHYSICAL_DICE,
    canUseD20Mode,
    canRoll,
    activeRoll,
    latestResult,
    error,
    appearanceName: cosmetic.name,
    appearanceSwatch: cosmetic.swatch,
    configurationLoading: configuration.loading,
    historyRolls,
    historyLoading,
    historyClearing,
    historyError,
    clearHistory,
    addDie,
    removeDie,
    clearDice,
    setModifier: (value: number) => {
      if (!activeRef.current) setModifier(Math.max(-99, Math.min(99, Math.round(value))));
    },
    setMode: (value: VttDiceMode) => {
      if (!activeRef.current && (value === "normal" || canUseD20Mode)) setMode(value);
    },
    roll,
    handlePhysicsComplete,
    handleImpact,
  };
}
