"use client";

import type { SupportedDie } from "@/components/dice/diceUtils";
import type { VttDiceEnvelope, VttDiceMode, VttDiceResultToast } from "./useVttDice";

const QUICK_DICE: SupportedDie[] = [4, 6, 8, 10, 12, 20, 100];

function modeLabel(mode: VttDiceMode) {
  if (mode === "advantage") return "ADV";
  if (mode === "disadvantage") return "DIS";
  return "N";
}

export function VttDiceBar({
  isFullscreen,
  counts,
  modifier,
  mode,
  expression,
  physicalCount,
  maxPhysicalDice,
  canUseD20Mode,
  canRoll,
  activeRoll,
  latestResult,
  error,
  appearanceName,
  appearanceSwatch,
  historyCount,
  historyOpen,
  onAddDie,
  onRemoveDie,
  onModifier,
  onMode,
  onClear,
  onHistory,
  onRoll,
}: {
  isFullscreen: boolean;
  counts: Record<SupportedDie, number>;
  modifier: number;
  mode: VttDiceMode;
  expression: string;
  physicalCount: number;
  maxPhysicalDice: number;
  canUseD20Mode: boolean;
  canRoll: boolean;
  activeRoll: VttDiceEnvelope | null;
  latestResult: VttDiceResultToast | null;
  error: string | null;
  appearanceName: string;
  appearanceSwatch: string;
  historyCount: number;
  historyOpen: boolean;
  onAddDie: (sides: SupportedDie) => void;
  onRemoveDie: (sides: SupportedDie) => void;
  onModifier: (value: number) => void;
  onMode: (mode: VttDiceMode) => void;
  onClear: () => void;
  onHistory: () => void;
  onRoll: () => void;
}) {
  const busy = Boolean(activeRoll);
  const limitExceeded = physicalCount > maxPhysicalDice;

  return (
    <div className={`pointer-events-none absolute inset-x-2 z-30 flex justify-center ${isFullscreen ? "bottom-3" : "bottom-14"}`}>
      <div className="w-full max-w-[1180px]">
        {latestResult ? (
          <div className="mb-2 flex justify-center">
            <div className="rounded-2xl border border-yellow-400/35 bg-slate-950/92 px-5 py-3 text-center shadow-2xl backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300">{latestResult.rollerName} rolled</p>
              <p className="mt-1 text-sm font-bold text-slate-200">
                {latestResult.expression}{latestResult.mode === "normal" ? "" : ` · ${latestResult.mode}`}
              </p>
              <p className="mt-1 text-2xl font-black text-white">{latestResult.total}</p>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-auto rounded-[22px] border border-slate-700/80 bg-slate-950/90 p-2 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black text-slate-100 sm:text-xs">{activeRoll ? `${activeRoll.rollerName} is rolling…` : expression}</p>
              <p className={`text-[9px] font-bold uppercase tracking-[0.14em] ${limitExceeded ? "text-rose-300" : "text-slate-500"}`}>
                {physicalCount}/{maxPhysicalDice} physical dice
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-800 bg-black/30 px-2.5 py-1.5">
              <span className="h-3.5 w-3.5 rounded-full border border-white/15" style={{ background: appearanceSwatch }} />
              <span className="hidden text-[9px] font-bold text-slate-400 sm:inline">{appearanceName}</span>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {QUICK_DICE.map((sides) => {
              const count = counts[sides];
              return (
                <div key={sides} className={`flex shrink-0 overflow-hidden rounded-xl border ${count > 0 ? "border-yellow-400/45 bg-yellow-400/10" : "border-slate-800 bg-slate-900/85"}`}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAddDie(sides)}
                    className={`min-h-10 min-w-12 px-2.5 text-xs font-black transition disabled:opacity-40 ${count > 0 ? "text-yellow-100" : "text-slate-300 hover:text-white"}`}
                    title={`Add d${sides}`}
                  >
                    d{sides}{count > 0 ? <span className="ml-1 text-[9px] text-yellow-300">×{count}</span> : null}
                  </button>
                  {count > 0 ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemoveDie(sides)}
                      className="min-h-10 border-l border-yellow-400/20 px-2 text-sm font-black text-yellow-300/80 hover:bg-yellow-400/10 hover:text-yellow-100 disabled:opacity-40"
                      title={`Remove d${sides}`}
                    >
                      −
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900/85">
              <button type="button" disabled={busy} onClick={() => onModifier(modifier - 1)} className="min-h-9 px-2.5 text-sm font-black text-slate-400 hover:text-white disabled:opacity-40">−</button>
              <input
                type="number"
                value={modifier}
                disabled={busy}
                onChange={(event) => onModifier(Number(event.target.value) || 0)}
                className="h-9 w-12 border-x border-slate-800 bg-transparent text-center text-xs font-black text-slate-100 outline-none disabled:opacity-40"
                aria-label="Dice modifier"
              />
              <button type="button" disabled={busy} onClick={() => onModifier(modifier + 1)} className="min-h-9 px-2.5 text-sm font-black text-slate-400 hover:text-white disabled:opacity-40">+</button>
            </div>

            <div className="flex overflow-hidden rounded-xl border border-slate-800 bg-slate-900/85">
              {(["normal", "advantage", "disadvantage"] as VttDiceMode[]).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  disabled={busy || (entry !== "normal" && !canUseD20Mode)}
                  onClick={() => onMode(entry)}
                  className={`min-h-9 min-w-9 border-r border-slate-800 px-2 text-[10px] font-black last:border-r-0 disabled:opacity-25 ${mode === entry ? (entry === "advantage" ? "bg-emerald-400/15 text-emerald-200" : entry === "disadvantage" ? "bg-rose-400/15 text-rose-200" : "bg-cyan-400/15 text-cyan-100") : "text-slate-500 hover:text-slate-200"}`}
                  title={entry === "normal" ? "Normal d20" : entry === "advantage" ? "Advantage" : "Disadvantage"}
                >
                  {modeLabel(entry)}
                </button>
              ))}
            </div>

            <button type="button" disabled={busy} onClick={onClear} className="min-h-9 rounded-xl border border-slate-800 bg-slate-900/80 px-3 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 hover:text-slate-200 disabled:opacity-40">
              Clear
            </button>

            <button
              type="button"
              onClick={onHistory}
              className={`min-h-9 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.08em] ${historyOpen ? "border-cyan-300/55 bg-cyan-300/15 text-cyan-100" : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-100"}`}
            >
              History{historyCount > 0 ? ` · ${historyCount}` : ""}
            </button>

            <button
              type="button"
              disabled={!canRoll}
              onClick={onRoll}
              className="ml-auto min-h-10 rounded-xl border border-yellow-400/55 bg-yellow-400/15 px-5 text-xs font-black uppercase tracking-[0.14em] text-yellow-100 shadow-lg hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {busy ? "Rolling…" : "🎲 Roll"}
            </button>
          </div>

          {error ? <p className="mt-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-200">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
