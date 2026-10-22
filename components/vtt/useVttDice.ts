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
import {shouldPublishVttDiceRoll} from "./vttDiceVisibility";
import {formatVttDiceBreakdown} from "./vttDiceBreakdown";

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
  breakdown?:string;
  duality?: DualityResult;
};

export type VttActiveDiceRoll={envelope:VttDiceEnvelope;slot:number};

type PendingLocalRoll = {
  envelope: VttDiceEnvelope;
  visibleToPlayers: boolean;
};

type Counts = Record<SupportedDie, number>;

const DIE_ORDER: SupportedDie[] = [4, 6, 8, 10, 12, 20, 100];
const MAX_VTT_PHYSICAL_DICE = 12;
export const MAX_SIMULTANEOUS_VTT_ROLLS=12;
const VTT_RESULT_TOAST_MS=10000;

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
    && typeof record.total === "number" && Number.isFinite(record.total)
    && (record.breakdown === undefined ||
      (typeof record.breakdown === "string" && record.breakdown.length <= 400));
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
  isDm = false,
}: {
  campaignId: string;
  currentUserId: string;
  currentUserName: string;
  sceneId: string | null;
  daggerheart?: boolean;
  sharedScene?: boolean;
  isDm?: boolean;
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
  const activeRollsRef=useRef(new Map<string,VttActiveDiceRoll>());
  const [activeRolls,setActiveRolls]=useState<VttActiveDiceRoll[]>([]);
  const clearTimersRef=useRef(new Map<string,number>());
  const resultTimersRef=useRef(new Map<string,number>());
  const seenResultsRef=useRef(new Set<string>());
  const pendingLocalRef=useRef<PendingLocalRoll|null>(null);

  const [rollKind, setRollKind] = useState<VttRollKind>(daggerheart ? "duality" : "custom");
  const [counts, setCounts] = useState<Counts>(() => daggerheart ? { ...emptyCounts(), 12: 2 } : defaultCounts());
  const [modifier, setModifier] = useState(0);
  const [mode, setMode] = useState<VttDiceMode>("normal");
  const [resultToasts,setResultToasts]=useState<VttDiceResultToast[]>([]);
  const activeRoll=activeRolls.find(r=>r.envelope.rollerId===currentUserId)?.envelope??null;
  const latestResult=resultToasts[0]??null;
  const [localError, setLocalError] = useState<string | null>(null);
  const [gmShareRoll,setGmShareRoll]=useState(true);
  const rollWillBeShared=shouldPublishVttDiceRoll(isDm,sharedScene,gmShareRoll);

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

  const [rollSceneId,setRollSceneId]=useState(sceneId);
  if(rollSceneId!==sceneId){setRollSceneId(sceneId);setActiveRolls([]);setResultToasts([]);}

  const removeActive=useCallback((rollId:string)=>{
    const timer=clearTimersRef.current.get(rollId);
    if(timer!==undefined){window.clearTimeout(timer);clearTimersRef.current.delete(rollId);}
    if(activeRollsRef.current.delete(rollId))setActiveRolls([...activeRollsRef.current.values()]);
  },[]);
  const clearActiveAfter=useCallback((rollId:string,milliseconds=3200)=>{
    const old=clearTimersRef.current.get(rollId);
    if(old!==undefined)window.clearTimeout(old);
    clearTimersRef.current.set(rollId,window.setTimeout(()=>removeActive(rollId),milliseconds));
  },[removeActive]);
  const beginEnvelope=useCallback((envelope:VttDiceEnvelope):boolean=>{
    if(envelope.sceneId!==sceneIdRef.current)return false;
    if(activeRollsRef.current.has(envelope.rollId))return true;
    if(activeRollsRef.current.size>=MAX_SIMULTANEOUS_VTT_ROLLS)return false;
    const taken=new Set([...activeRollsRef.current.values()].map(r=>r.slot));
    let slot=0;while(taken.has(slot))slot+=1;
    activeRollsRef.current.set(envelope.rollId,{envelope,slot});
    setActiveRolls([...activeRollsRef.current.values()]);
    clearActiveAfter(envelope.rollId,30000);
    return true;
  },[clearActiveAfter]);
  const showResult=useCallback((result:VttDiceResultToast)=>{
    if(seenResultsRef.current.has(result.rollId))return;
    seenResultsRef.current.add(result.rollId);
    setResultToasts(prev=>[result,...prev].slice(0,6));
    resultTimersRef.current.set(result.rollId,window.setTimeout(()=>{
      setResultToasts(prev=>prev.filter(r=>r.rollId!==result.rollId));
      resultTimersRef.current.delete(result.rollId);
      seenResultsRef.current.delete(result.rollId);
    },VTT_RESULT_TOAST_MS));
  },[]);

  useEffect(()=>{
    sceneIdRef.current=sceneId;
    activeRollsRef.current.clear();
    pendingLocalRef.current=null;
    seenResultsRef.current.clear();
    for(const t of clearTimersRef.current.values())window.clearTimeout(t);
    clearTimersRef.current.clear();
    for(const t of resultTimersRef.current.values())window.clearTimeout(t);
    resultTimersRef.current.clear();
    setActiveRolls([]);setResultToasts([]);
  },[sceneId]);
  useEffect(()=>{
    if(!sceneId||!sharedScene)return;
    const channel=supabase.channel(`vtt:dice:${sceneId}`,{config:{private:true}})
      .on("broadcast",{event:"roll-start"},({payload})=>{
        if(!isEnvelope(payload)||payload.sceneId!==sceneIdRef.current)return;
        if(payload.rollerId===currentUserId&&pendingLocalRef.current?.envelope.rollId===payload.rollId)return;
        beginEnvelope({...payload,request:{...payload.request,startedAt:performance.now()}});
      })
      .on("broadcast",{event:"roll-result"},({payload})=>{
        if(!isResultToast(payload)||payload.sceneId!==sceneIdRef.current)return;
        showResult(payload);
        if(activeRollsRef.current.has(payload.rollId))clearActiveAfter(payload.rollId,3200);
      });
    const unsubscribe=subscribeVttChannel(supabase,channel);
    channelRef.current=channel;
    return ()=>{channelRef.current=null;unsubscribe();};
  },[beginEnvelope,clearActiveAfter,currentUserId,sceneId,sharedScene,showResult,supabase]);
  useEffect(()=>()=>{for(const t of clearTimersRef.current.values())window.clearTimeout(t);for(const t of resultTimersRef.current.values())window.clearTimeout(t);},[]);

  const addDie = useCallback((sides: SupportedDie) => {
    if (pendingLocalRef.current) return;
    setRollKind("custom");
    setMode("normal");
    setCounts((current) => ({ ...current, [sides]: Math.min(12, current[sides] + 1) }));
  }, []);

  const removeDie = useCallback((sides: SupportedDie) => {
    if (pendingLocalRef.current) return;
    setRollKind("custom");
    setMode("normal");
    setCounts((current) => ({ ...current, [sides]: Math.max(0, current[sides] - 1) }));
  }, []);

  const clearDice = useCallback(() => {
    if (pendingLocalRef.current) return;
    setRollKind("custom");
    setCounts(emptyCounts());
    setModifier(0);
    setMode("normal");
  }, []);

  const roll = useCallback(async () => {
    if(!sceneId||pendingLocalRef.current||configuration.loading||historySaving||
       [...activeRollsRef.current.values()].some(r=>r.envelope.rollerId===currentUserId))return;
    if(activeRollsRef.current.size>=MAX_SIMULTANEOUS_VTT_ROLLS){setLocalError("VTT dice table is full. Try again when dice settle.");return;}
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
      const visibleToPlayers=shouldPublishVttDiceRoll(isDm,sharedScene,gmShareRoll);
      pendingLocalRef.current={envelope,visibleToPlayers};
      if(!beginEnvelope(envelope)){pendingLocalRef.current=null;setLocalError("VTT dice table is full.");return;}

      if (configuration.appearance.sound) await soundEngine.unlock();
      if(visibleToPlayers)void channelRef.current?.send({ type: "broadcast", event: "roll-start", payload: envelope });
    } catch (cause) {
      pendingLocalRef.current=null;
      removeActive(rollId);
      setLocalError(cause instanceof Error ? cause.message : "Could not prepare the VTT dice roll.");
    }
  }, [configuration.appearance, configuration.loading, configuration.physics, currentUserId, currentUserName, duality, effectiveMode, expression, groups, historySaving, modifier, physicalCount, physicalGroups, rollKind, sceneId, soundEngine, isDm, sharedScene, gmShareRoll,beginEnvelope,removeActive]);

  const handlePhysicsComplete = useCallback(async (physicsResult: PhysicsRollResult) => {
    const entry=activeRollsRef.current.get(physicsResult.rollId);
    if(!entry)return;
    const envelope=entry.envelope;
    if(envelope.rollerId!==currentUserId){
      if(!seenResultsRef.current.has(envelope.rollId))clearActiveAfter(envelope.rollId,5200);
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
      breakdown:formatVttDiceBreakdown(rolledGroups),
      duality: dualityResult,
    };

    pendingLocalRef.current = null;
    await saveHistoryRoll({
      rollKey: envelope.rollId,
      sceneId: envelope.sceneId,
      visibleToPlayers:pending.visibleToPlayers,
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
    showResult(toast);
    if(pending.visibleToPlayers)void channelRef.current?.send({ type: "broadcast", event: "roll-result", payload: toast });
    clearActiveAfter(envelope.rollId);
  }, [clearActiveAfter, currentUserId, saveHistoryRoll,showResult]);

  const handleImpact=useCallback((force:number,rollId:string)=>{
    if(!activeRollsRef.current.get(rollId)?.envelope.request.settings.sound)return;
    soundEngine.impact(force);
  },[soundEngine]);

  const error = localError ?? configuration.error ?? historyError;
  const canRoll = Boolean(sceneId)
    && groups.length > 0
    && physicalCount <= MAX_VTT_PHYSICAL_DICE
    && !pendingLocalRef.current
    && !activeRoll
    && activeRolls.length<MAX_SIMULTANEOUS_VTT_ROLLS
    && !configuration.loading
    && !historySaving;

  return {
    rollKind,
    selectDuality: () => {
      if (!daggerheart || pendingLocalRef.current) return;
      setRollKind("duality"); setCounts({ ...emptyCounts(), 12: 2 }); setMode("normal");
    },
    selectAdversary: () => {
      if (pendingLocalRef.current) return;
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
    activeRolls,
    resultToasts,
    latestResult,
    rollWillBeShared,
    gmShareRoll,
    setGmShareRoll:(next:boolean)=>{if(isDm&&!pendingLocalRef.current)setGmShareRoll(next);},
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
      if (!pendingLocalRef.current) setModifier(Math.max(-99, Math.min(99, Math.round(value))));
    },
    setMode: (value: VttDiceMode) => {
      if (!pendingLocalRef.current && (value === "normal" || canUseD20Mode)) setMode(value);
    },
    roll,
    handlePhysicsComplete,
    handleImpact,
  };
}
