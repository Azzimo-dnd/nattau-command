"use client";

import type { VttFogDrawShape, VttFogOperation } from "./vttTypes";

type Props = {
  enabled: boolean;
  busy: boolean;
  loading: boolean;
  operation: VttFogOperation;
  shape: VttFogDrawShape;
  draftCount: number;
  canUndo: boolean;
  error: string | null;
  onToggle: () => void;
  onOperation: (operation: VttFogOperation) => void;
  onShape: (shape: VttFogDrawShape) => void;
  onCoverAll: () => void;
  onRevealAll: () => void;
  onUndo: () => void;
  onFinishPolygon: () => void;
  onCancelDraft: () => void;
  onClose: () => void;
};

export function VttFogControls({
  enabled,
  busy,
  loading,
  operation,
  shape,
  draftCount,
  canUndo,
  error,
  onToggle,
  onOperation,
  onShape,
  onCoverAll,
  onRevealAll,
  onUndo,
  onFinishPolygon,
  onCancelDraft,
  onClose,
}: Props) {
  return (
    <div className="absolute left-3 top-16 z-30 w-[min(23rem,calc(100%-1.5rem))] rounded-2xl border border-slate-700/90 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Fog of War</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">Manual scene fog. Green reveals; amber covers.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-800 px-2 py-1 text-[10px] font-black text-slate-500 hover:text-slate-200">Close</button>
      </div>

      <button
        type="button"
        disabled={busy || loading}
        onClick={onToggle}
        className={`mt-3 min-h-10 w-full rounded-xl border text-[10px] font-black uppercase tracking-[0.12em] disabled:opacity-40 ${enabled ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-slate-700 bg-slate-900/70 text-slate-300"}`}
      >
        Fog {enabled ? "enabled" : "disabled"}
      </button>

      {enabled ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button type="button" disabled={busy} onClick={onCoverAll} className="min-h-9 rounded-xl border border-amber-400/25 bg-amber-400/5 text-[9px] font-black text-amber-100 disabled:opacity-40">Cover all</button>
            <button type="button" disabled={busy} onClick={onRevealAll} className="min-h-9 rounded-xl border border-emerald-400/25 bg-emerald-400/5 text-[9px] font-black text-emerald-100 disabled:opacity-40">Reveal all</button>
            <button type="button" disabled={busy || !canUndo} onClick={onUndo} className="min-h-9 rounded-xl border border-slate-700 text-[9px] font-black text-slate-300 disabled:opacity-30">Undo</button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["reveal", "cover"] as VttFogOperation[]).map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                onClick={() => onOperation(value)}
                className={`min-h-9 rounded-xl border text-[9px] font-black uppercase tracking-[0.1em] disabled:opacity-40 ${operation === value ? value === "reveal" ? "border-emerald-300 bg-emerald-300/15 text-emerald-100" : "border-amber-300 bg-amber-300/15 text-amber-100" : "border-slate-800 bg-slate-900/60 text-slate-500"}`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["rectangle", "polygon"] as VttFogDrawShape[]).map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                onClick={() => onShape(value)}
                className={`min-h-9 rounded-xl border text-[9px] font-black uppercase tracking-[0.1em] disabled:opacity-40 ${shape === value ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-slate-800 bg-slate-900/60 text-slate-500"}`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-2.5 text-[10px] leading-4 text-slate-500">
            {shape === "rectangle"
              ? "Drag directly on the tabletop to apply a rectangular fog region."
              : `Click points around the area, then Finish polygon. ${draftCount}/64 points.`}
          </div>

          {shape === "polygon" && draftCount > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy || draftCount < 3} onClick={onFinishPolygon} className="min-h-9 rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-[9px] font-black text-cyan-100 disabled:opacity-30">Finish polygon</button>
              <button type="button" disabled={busy} onClick={onCancelDraft} className="min-h-9 rounded-xl border border-slate-700 text-[9px] font-black text-slate-400 disabled:opacity-40">Cancel points</button>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <p className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-200">{error}</p> : null}
    </div>
  );
}
