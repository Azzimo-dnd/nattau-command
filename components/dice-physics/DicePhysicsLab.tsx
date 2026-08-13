"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DiceAppearancePicker } from "./DiceAppearancePicker";
import {
  DEFAULT_CAMPAIGN_DICE_PHYSICS,
  createDiceRuntimeSettings,
} from "./dicePhysicsDefaults";
import { getSharedDiceSoundEngine } from "./diceSound";
import { PhysicsDiceScene } from "./PhysicsDiceScene";
import { useCampaignDiceConfiguration } from "./useCampaignDiceConfiguration";
import type {
  CampaignDicePhysicsSettings,
  DiceCameraMode,
  DiceLabStatus,
  DiceLabTheme,
  PhysicsDieKind,
  PhysicsRollRequest,
  PhysicsRollResult,
} from "./dicePhysicsTypes";

const DIE_OPTIONS: PhysicsDieKind[] = ["d4", "d6", "d8", "d10", "d12", "d20"];
const CAMERA_OPTIONS: Array<{ value: DiceCameraMode; label: string }> = [
  { value: "table", label: "Table" },
  { value: "top", label: "Top" },
  { value: "close", label: "Close" },
];

function createRollId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function RangeControl({
  label,
  value,
  minimum,
  maximum,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-2xl border border-white/10 bg-black/15 p-3">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold opacity-80">
        <span>{label}</span>
        <span className="font-mono text-[11px] opacity-80">
          {value.toFixed(step < 0.1 ? 3 : step < 1 ? 2 : 1)}{suffix}
        </span>
      </span>
      <input
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-current"
      />
    </label>
  );
}

export function DicePhysicsLab({
  theme,
  campaignName,
  campaignId,
  currentUserId,
}: {
  theme: DiceLabTheme;
  campaignName: string;
  campaignId: string;
  currentUserId: string;
}) {
  const configuration = useCampaignDiceConfiguration({ campaignId, currentUserId });
  const [physics, setPhysics] = useState<CampaignDicePhysicsSettings>(
    DEFAULT_CAMPAIGN_DICE_PHYSICS
  );
  const [dieKind, setDieKind] = useState<PhysicsDieKind>("d20");
  const [count, setCount] = useState(2);
  const [debug, setDebug] = useState(false);
  const [cameraMode, setCameraMode] = useState<DiceCameraMode>("table");
  const [request, setRequest] = useState<PhysicsRollRequest | null>(null);
  const [status, setStatus] = useState<DiceLabStatus>("idle");
  const [result, setResult] = useState<PhysicsRollResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const soundEngine = useMemo(() => getSharedDiceSoundEngine(), []);
  const appearanceRef = useRef(configuration.appearance);

  useEffect(() => {
    appearanceRef.current = configuration.appearance;
  }, [configuration.appearance]);

  useEffect(() => {
    if (!configuration.loading) setPhysics(configuration.physics);
  }, [configuration.loading, configuration.physics]);


  useEffect(() => {
    const canvas = document.createElement("canvas");
    if (!(canvas.getContext("webgl2") || canvas.getContext("webgl"))) {
      setWebglError("WebGL is unavailable in this browser.");
    }
  }, []);

  const themeClasses =
    theme === "barovia"
      ? {
          shell: "text-[#eadde1]",
          panel: "border-[#4d2c37] bg-[#130d11]/88",
          soft: "border-[#462832] bg-black/20",
          accent: "text-[#d98da2]",
          button: "border-[#9c4d64] bg-[#6b2137] text-[#fff0f3] hover:bg-[#7d2941]",
          secondary: "border-[#5e3442] bg-black/20 text-[#d4b7c0] hover:border-[#8e465c]",
        }
      : {
          shell: "text-slate-100",
          panel: "border-slate-700/80 bg-slate-900/82",
          soft: "border-slate-700/70 bg-slate-950/45",
          accent: "text-yellow-300",
          button: "border-yellow-500/50 bg-yellow-500/15 text-yellow-200 hover:bg-yellow-500/25",
          secondary: "border-slate-700 bg-slate-950/45 text-slate-300 hover:border-yellow-600/45",
        };

  const isBusy = status === "rolling" || status === "rerolling";

  function updatePhysics<Key extends keyof CampaignDicePhysicsSettings>(
    key: Key,
    value: CampaignDicePhysicsSettings[Key]
  ) {
    setPhysics((current) => ({ ...current, [key]: value }));
    setSaveMessage(null);
  }

  async function startRoll(requestedCount = count) {
    if (webglError || isBusy) return;
    const safeCount = Math.min(24, Math.max(1, requestedCount));
    setCount(safeCount);
    if (configuration.appearance.sound) await soundEngine.unlock();
    const rollId = createRollId();
    const startedAt = performance.now();
    setResult(null);
    setStatus("rolling");
    setRequest({
      rollId,
      startedAt,
      dice: Array.from({ length: safeCount }, (_, index) => ({
        id: `${rollId}-${index}`,
        kind: dieKind,
        groupIndex: 0,
        logicalDieIndex: index,
      })),
      settings: createDiceRuntimeSettings(physics, configuration.appearance, {
        debug,
        cameraMode,
      }),
    });
  }

  async function saveForCampaign() {
    const saved = await configuration.savePhysics(physics);
    setSaveMessage(
      saved
        ? `Saved. Every ${campaignName} player roll now uses these physics values.`
        : "The settings could not be saved."
    );
  }

  return (
    <section className={`space-y-5 ${themeClasses.shell}`}>
      {(configuration.error || saveMessage) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            configuration.error
              ? "border-red-500/35 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {configuration.error || saveMessage}
        </div>
      )}

      <div className="grid gap-5 2xl:grid-cols-[360px_minmax(0,1fr)_330px]">
        <aside className={`order-2 rounded-3xl border p-4 sm:p-5 2xl:order-1 ${themeClasses.panel}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.26em] ${themeClasses.accent}`}>
                Campaign physics
              </p>
              <h2 className="mt-2 font-serif text-2xl font-black">Throw controls</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.16em] opacity-70">
              GM only
            </span>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold opacity-70">Physical die</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {DIE_OPTIONS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setDieKind(kind)}
                  className={`min-h-11 rounded-xl border text-sm font-black uppercase transition disabled:opacity-45 ${
                    dieKind === kind ? themeClasses.button : themeClasses.secondary
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className={`rounded-2xl border p-3 ${themeClasses.soft}`}>
              <span className="text-xs font-semibold opacity-75">Dice count</span>
              <input
                type="number"
                min={1}
                max={24}
                value={count}
                disabled={isBusy}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCount(Math.min(24, Math.max(1, Number(event.target.value) || 1)))
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono outline-none"
              />
            </label>
            <div className={`rounded-2xl border p-3 ${themeClasses.soft}`}>
              <p className="text-xs font-semibold opacity-75">Status</p>
              <p className={`mt-3 text-sm font-black uppercase ${themeClasses.accent}`}>
                {status}
              </p>
            </div>
          </div>

          <div className={`mt-4 rounded-2xl border p-3 ${themeClasses.soft}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold opacity-75">Stress tests</p>
                <p className="mt-1 text-[10px] opacity-50">Same engine limit as player rolls: 24 physical bodies.</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-55">1–24</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[6, 12, 18, 24].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={isBusy || Boolean(webglError)}
                  onClick={() => void startRoll(preset)}
                  className={`min-h-10 rounded-xl border text-xs font-black ${themeClasses.secondary}`}
                >
                  {preset}d
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <RangeControl label="Throw impulse" value={physics.throwForce} minimum={2.8} maximum={14} step={0.1} onChange={(value) => updatePhysics("throwForce", value)} />
            <RangeControl label="Torque impulse" value={physics.spinForce} minimum={1} maximum={18} step={0.1} onChange={(value) => updatePhysics("spinForce", value)} />
            <RangeControl label="Restitution" value={physics.restitution} minimum={0} maximum={0.8} step={0.01} onChange={(value) => updatePhysics("restitution", value)} />
            <RangeControl label="Die friction" value={physics.dieFriction} minimum={0.05} maximum={1.5} step={0.01} onChange={(value) => updatePhysics("dieFriction", value)} />
            <RangeControl label="Tray friction" value={physics.trayFriction} minimum={0.05} maximum={1.6} step={0.01} onChange={(value) => updatePhysics("trayFriction", value)} />
          </div>

          <button
            type="button"
            disabled={isBusy || configuration.savingPhysics}
            onClick={() => void saveForCampaign()}
            className={`mt-4 min-h-12 w-full rounded-2xl border px-4 text-xs font-black uppercase tracking-[0.14em] disabled:opacity-45 ${themeClasses.button}`}
          >
            {configuration.savingPhysics ? "Saving…" : "Save for all campaign rolls"}
          </button>
        </aside>

        <div className="order-1 min-w-0 2xl:order-2">
          <div className={`relative h-[clamp(320px,48dvh,470px)] overflow-hidden rounded-3xl border shadow-2xl sm:h-[620px] ${themeClasses.panel}`}>
            {webglError ? (
              <div className="flex h-full items-center justify-center p-8 text-center text-red-300">
                {webglError}
              </div>
            ) : (
              <PhysicsDiceScene
                request={request}
                theme={theme}
                onStatus={setStatus}
                onComplete={setResult}
                onImpact={(force) => {
                  if (appearanceRef.current.sound) soundEngine.impact(force);
                }}
              />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
              <div className="rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-xs backdrop-blur-md">
                <p className="font-bold">{campaignName}</p>
                <p className="mt-1 opacity-60">Shared values apply to player rolls</p>
              </div>
              {debug && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-950/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200 backdrop-blur-md">
                  Collider debug
                </div>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 pt-16">
              <div className="flex gap-2">
                {CAMERA_OPTIONS.map((camera) => (
                  <button
                    key={camera.value}
                    type="button"
                    onClick={() => setCameraMode(camera.value)}
                    className={`min-h-10 rounded-xl border px-3 text-xs font-semibold backdrop-blur-md ${
                      cameraMode === camera.value
                        ? themeClasses.button
                        : "border-white/15 bg-black/35 text-white/70"
                    }`}
                  >
                    {camera.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={isBusy || Boolean(webglError)}
                onClick={() => void startRoll()}
                className={`min-h-12 min-w-36 rounded-2xl border px-6 text-sm font-black uppercase tracking-[0.16em] shadow-xl disabled:opacity-40 ${themeClasses.button}`}
              >
                {isBusy ? "Rolling…" : "Test roll"}
              </button>
            </div>
          </div>

          {result && (
            <div className={`mt-4 rounded-3xl border p-5 ${themeClasses.panel}`}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-[0.24em] ${themeClasses.accent}`}>
                    Physical result
                  </p>
                  <p className="mt-2 text-4xl font-black">
                    {result.dice.reduce((sum, die) => sum + die.value, 0)}
                  </p>
                </div>
                <p className="text-xs opacity-60">
                  {(result.durationMs / 1000).toFixed(2)}s · peak {result.peakImpact.toFixed(1)} · {result.simulationProfile}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {result.dice.map((die) => (
                  <span key={die.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 font-black">
                    {die.value}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <div className={`rounded-xl border p-3 ${themeClasses.soft}`}><span className="opacity-55">Profile</span><strong className="mt-1 block">{result.simulationProfile}</strong></div>
                <div className={`rounded-xl border p-3 ${themeClasses.soft}`}><span className="opacity-55">Die scale</span><strong className="mt-1 block">{Math.round(result.dieScale * 100)}%</strong></div>
                <div className={`rounded-xl border p-3 ${themeClasses.soft}`}><span className="opacity-55">Tray</span><strong className="mt-1 block">{result.trayWidth.toFixed(1)} × {result.trayDepth.toFixed(1)}</strong></div>
                <div className={`rounded-xl border p-3 ${themeClasses.soft}`}><span className="opacity-55">Escapes</span><strong className="mt-1 block">{result.escapeCount}</strong></div>
                <div className={`rounded-xl border p-3 ${themeClasses.soft}`}><span className="opacity-55">Rescued dice</span><strong className="mt-1 block">{result.rescuedDice}</strong></div>
                <div className={`rounded-xl border p-3 ${themeClasses.soft}`}><span className="opacity-55">Timeout rescues</span><strong className="mt-1 block">{result.timeoutRescues}</strong></div>
              </div>
            </div>
          )}
        </div>

        <aside className="order-3 space-y-5">
          <DiceAppearancePicker
            theme={theme}
            value={configuration.appearance}
            disabled={isBusy || configuration.loading}
            saving={configuration.savingAppearance}
            onChange={(value) => void configuration.saveAppearance(value)}
          />

          <div className={`rounded-3xl border p-5 ${themeClasses.panel}`}>
            <p className={`text-xs font-bold uppercase tracking-[0.26em] ${themeClasses.accent}`}>
              Solver tuning
            </p>
            <div className="mt-4 space-y-3">
              <RangeControl label="Linear damping" value={physics.linearDamping} minimum={0} maximum={1.5} step={0.01} onChange={(value) => updatePhysics("linearDamping", value)} />
              <RangeControl label="Angular damping" value={physics.angularDamping} minimum={0} maximum={2} step={0.01} onChange={(value) => updatePhysics("angularDamping", value)} />
              <RangeControl label="Gravity" value={physics.gravity} minimum={-20} maximum={-3} step={0.1} suffix=" m/s²" onChange={(value) => updatePhysics("gravity", value)} />
              <RangeControl label="Clear-face threshold" value={physics.cockedThreshold} minimum={0.78} maximum={0.995} step={0.005} onChange={(value) => updatePhysics("cockedThreshold", value)} />
            </div>

            <button
              type="button"
              onClick={() => setDebug((current) => !current)}
              className={`mt-4 min-h-11 w-full rounded-xl border px-3 text-xs font-bold ${
                debug ? themeClasses.button : themeClasses.secondary
              }`}
            >
              Debug {debug ? "on" : "off"}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setPhysics(DEFAULT_CAMPAIGN_DICE_PHYSICS);
                setResult(null);
                setRequest(null);
                setStatus("idle");
                setSaveMessage(null);
              }}
              className={`mt-3 min-h-11 w-full rounded-xl border px-4 text-xs font-bold ${themeClasses.secondary}`}
            >
              Restore recommended values
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
