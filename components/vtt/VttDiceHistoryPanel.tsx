"use client";

import type { VttDiceHistoryRow } from "./useVttDiceHistory";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function modeLabel(mode: VttDiceHistoryRow["mode"]) {
  if (mode === "advantage") return "ADV";
  if (mode === "disadvantage") return "DIS";
  return null;
}

export function VttDiceHistoryPanel({
  open,
  isFullscreen,
  sceneName,
  isDm,
  rolls,
  loading,
  clearing,
  error,
  onClose,
  onClear,
}: {
  open: boolean;
  isFullscreen: boolean;
  sceneName: string;
  isDm: boolean;
  rolls: VttDiceHistoryRow[];
  loading: boolean;
  clearing: boolean;
  error: string | null;
  onClose: () => void;
  onClear: () => void;
}) {
  if (!open) return null;

  return (
    <div className={`pointer-events-none absolute right-3 z-40 w-[min(390px,calc(100%-1.5rem))] ${isFullscreen ? "bottom-32" : "bottom-44"}`}>
      <section className="pointer-events-auto overflow-hidden rounded-[22px] border border-slate-700/85 bg-slate-950/95 shadow-[0_24px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">VTT roll history</p>
            <p className="mt-1 truncate text-sm font-black text-slate-100">{sceneName}</p>
            <p className="mt-1 text-[10px] text-slate-500">{rolls.length} saved roll{rolls.length === 1 ? "" : "s"} · removed with this scene</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-9 min-w-9 rounded-xl border border-slate-800 bg-slate-900/80 text-sm font-black text-slate-400 hover:text-white" aria-label="Close VTT dice history">
            ×
          </button>
        </div>

        <div className="max-h-[min(52vh,430px)] overflow-y-auto p-3">
          {loading ? <p className="px-2 py-6 text-center text-xs text-slate-500">Loading scene rolls…</p> : null}
          {!loading && error ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-[11px] leading-5 text-amber-100">{error}</p>
          ) : null}
          {!loading && !error && rolls.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs leading-5 text-slate-500">No rolls have been saved for this VTT scene yet.</p>
          ) : null}
          {!loading && !error && rolls.length > 0 ? (
            <div className="space-y-2">
              {rolls.map((roll) => {
                const label = modeLabel(roll.mode);
                return (
                  <article key={roll.id} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-xs font-black text-slate-100">{roll.roller_name}</p>
                          {label ? <span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-black ${roll.mode === "advantage" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-rose-400/25 bg-rose-400/10 text-rose-200"}`}>{label}</span> : null}
                        </div>
                        <p className="mt-1 truncate text-[11px] font-bold text-slate-400">{roll.expression}</p>
                        <p className="mt-1 text-[9px] text-slate-600">{formatTime(roll.created_at)}</p>
                      </div>
                      <div className="shrink-0 rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-xl font-black text-yellow-100">
                        {roll.total}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>

        {isDm ? (
          <div className="border-t border-slate-800 p-3">
            <button
              type="button"
              disabled={clearing || rolls.length === 0}
              onClick={() => {
                if (window.confirm(`Delete all saved VTT dice rolls for “${sceneName}”?`)) onClear();
              }}
              className="min-h-10 w-full rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {clearing ? "Clearing…" : "Clear scene history"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
