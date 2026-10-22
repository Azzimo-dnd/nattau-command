"use client";

import { useState } from "react";
import { validVisualScale } from "@/components/miniatures/miniatureGlb";
import type { VttToken } from "./vttTypes";

const SIZE_PRESETS = [
  { label: "Tiny", value: 0.5 },
  { label: "Small", value: 1 },
  { label: "Medium", value: 1 },
  { label: "Large", value: 2 },
  { label: "Huge", value: 3 },
  { label: "Gargantuan", value: 4 },
] as const;

type Props = {
  showInitiative?: boolean;
  selectedTokens: VttToken[];
  tokenMoveEnabled?:boolean;
  onTokenMoveMode?:()=>void;
  onClearSelection?:()=>void;
  busy: boolean;
  rotationDegrees: number;
  onRotateLeft: () => void;
  onRotateReset: () => void;
  onRotateRight: () => void;
  onRenameEnemy: (name: string) => void;
  onInitiative: (value: number | null) => void;
  onResize: (size: number) => void;
  onScale: (scale: number) => void;
  onReveal: () => void;
  onHide: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

export function VttSelectionPanel(props: Props) {
  const selected = props.selectedTokens.length === 1 ? props.selectedTokens[0] : null;
  const count = props.selectedTokens.length;
  const [nameDraft, setNameDraft] = useState(selected?.name ?? "");
  const [scaleDraft, setScaleDraft] = useState("100");
  const [initiativeDraft, setInitiativeDraft] = useState("");

  const selectionKey = `${props.selectedTokens.map((token) => `${token.id}:${token.scale}`).join(",")}:${selected?.name}:${selected?.initiative}`;
  const [draftKey, setDraftKey] = useState<string | null>(null);
  if (draftKey !== selectionKey) {
    setDraftKey(selectionKey);
    setNameDraft(selected?.name ?? "");
    setScaleDraft(String(Math.round((selected?.scale ?? 1) * 100)));
    setInitiativeDraft(selected?.initiative == null ? "" : String(selected.initiative));
  }

  return (
    <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Selection</p>
        {count > 0 ? <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/5 px-2 py-0.5 text-[9px] font-black text-fuchsia-100">{count}</span> : null}
      </div>

      {count === 0 ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">Click to inspect without moving. Shift/Ctrl-click adds miniatures, or Shift-drag empty floor to select a whole squad.</p>
      ) : (
        <>
          {selected ? (
            <>
              <h3 className="mt-3 text-lg font-black text-slate-100">{selected.name}</h3>
              <p className="mt-1 text-[11px] text-slate-500">{selected.source_kind} · ({selected.x.toFixed(0)}, {selected.z.toFixed(0)}) · {selected.size_squares} sq · facing {props.rotationDegrees}°</p>

              {selected.source_kind === "enemy" ? (
                <div className="mt-3 rounded-xl border border-rose-400/15 bg-rose-400/5 p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-rose-200">Enemy display name</p>
                  <div className="mt-1.5 flex gap-2">
                    <input aria-label="Enemy display name" value={nameDraft} maxLength={120} onChange={(event) => setNameDraft(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-[10px] text-slate-100 outline-none focus:border-rose-400/50" />
                    <button type="button" disabled={props.busy || !nameDraft.trim() || nameDraft.trim() === selected.name} onClick={() => props.onRenameEnemy(nameDraft)} className="rounded-lg border border-rose-400/25 px-3 text-[9px] font-black text-rose-100 disabled:opacity-35">Save</button>
                  </div>
                  <p className="mt-1.5 text-[9px] leading-4 text-slate-600">Useful for repeated models: Sailor 1, Sailor 2, Captain&apos;s Guard, etc.</p>
                </div>
              ) : null}

              {props.showInitiative !== false && <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-200">Initiative</p>
                <div className="mt-1.5 flex gap-2">
                  <input aria-label="Initiative" type="number" min={-100} max={100} value={initiativeDraft} placeholder="—" onChange={(event) => setInitiativeDraft(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-[10px] text-slate-100 outline-none focus:border-amber-400/50" />
                  <button type="button" disabled={props.busy} onClick={() => props.onInitiative(initiativeDraft.trim() === "" ? null : Number(initiativeDraft))} className="rounded-lg border border-amber-400/25 px-3 text-[9px] font-black text-amber-100 disabled:opacity-35">Set</button>
                </div>
              </div>}

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" disabled={props.busy} onClick={props.onRotateLeft} className="min-h-9 rounded-xl border border-cyan-400/25 text-xs font-black text-cyan-100 disabled:opacity-40">↺ 45°</button>
                <button type="button" disabled={props.busy} onClick={props.onRotateReset} className="min-h-9 rounded-xl border border-slate-700 text-[10px] font-black text-slate-300 disabled:opacity-40">Reset</button>
                <button type="button" disabled={props.busy} onClick={props.onRotateRight} className="min-h-9 rounded-xl border border-cyan-400/25 text-xs font-black text-cyan-100 disabled:opacity-40">45° ↻</button>
              </div>
            </>
          ) : <p className="mt-3 text-xs text-slate-400">{count} tokens selected. Bulk actions apply to all selected miniatures.</p>}

          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
            <p className="text-xs font-bold text-amber-100">{count} miniature{count===1?"":"s"} selected</p>
            <p className="mt-1 text-[11px] text-slate-400">Move selection: hold the left button on one of these figures and drag. The whole formation will move only if its destination is empty.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={props.onTokenMoveMode} disabled={props.busy||!props.onTokenMoveMode}
                className={`min-h-9 flex-1 rounded-lg border px-2 text-xs font-bold disabled:opacity-40 ${props.tokenMoveEnabled?"border-amber-300 bg-amber-400/20 text-amber-100":"border-slate-700 text-slate-200"}`}>
                {props.tokenMoveEnabled?"Move selection: ON":"Enable move selection"}</button>
              <button type="button" onClick={props.onClearSelection} className="rounded-lg border border-slate-700 px-3 text-xs text-slate-300">Clear</button>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">Creature size</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {SIZE_PRESETS.map((preset) => (
                <button key={preset.label} type="button" disabled={props.busy} onClick={() => props.onResize(preset.value)} className="min-h-9 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2 text-[9px] font-bold text-amber-100 disabled:opacity-40">{preset.label}</button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
            <label className="text-xs font-bold text-cyan-100">Visual scale
              <input aria-label="Token visual scale slider" type="range" min={10} max={1000} step={1} value={Number(scaleDraft) || 100} disabled={props.busy} onChange={(event) => setScaleDraft(event.target.value)} className="mt-3 w-full accent-cyan-300" />
            </label>
            <div className="mt-2 flex items-center gap-2"><input aria-label="Token visual scale percent" type="number" min={10} max={1000} value={scaleDraft} disabled={props.busy} onChange={(event) => setScaleDraft(event.target.value)} className="min-h-10 w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm" /><span className="text-xs text-slate-400">%</span><button type="button" disabled={props.busy || !validVisualScale(Number(scaleDraft) / 100)} onClick={() => props.onScale(Number(scaleDraft) / 100)} className="min-h-10 rounded-lg border border-cyan-400/30 px-3 text-xs font-bold text-cyan-100 disabled:opacity-35">Apply</button><button type="button" disabled={props.busy} onClick={() => { setScaleDraft("100"); props.onScale(1); }} className="min-h-10 px-2 text-xs text-slate-300">Reset</button></div>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">Changes the model, keeping its grid footprint. 100% uses the scale saved at import. Applies to {count === 1 ? "this token" : "all selected tokens"}.</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled={props.busy} onClick={props.onReveal} className="min-h-10 rounded-xl border border-emerald-400/30 px-3 text-[10px] font-black text-emerald-200 disabled:opacity-40">Reveal</button>
            <button type="button" disabled={props.busy} onClick={props.onHide} className="min-h-10 rounded-xl border border-fuchsia-400/30 px-3 text-[10px] font-black text-fuchsia-200 disabled:opacity-40">Hide</button>
            <button type="button" disabled={props.busy} onClick={props.onDuplicate} className="min-h-10 rounded-xl border border-cyan-400/25 px-3 text-[10px] font-black text-cyan-100 disabled:opacity-40">Duplicate enemies</button>
            <button type="button" disabled={props.busy} onClick={props.onRemove} className="min-h-10 rounded-xl border border-rose-400/30 px-3 text-[10px] font-black text-rose-200 disabled:opacity-40">Remove</button>
          </div>

          <p className="mt-3 text-[9px] leading-4 text-slate-600">Shift/Ctrl-click toggles tokens. Shift-drag empty floor selects an entire squad. Reveal and Hide never move miniatures.</p>
        </>
      )}
    </section>
  );
}
