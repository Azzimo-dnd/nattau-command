"use client";

import { useEffect, useState } from "react";
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
  selectedTokens: VttToken[];
  busy: boolean;
  rotationDegrees: number;
  onRotateLeft: () => void;
  onRotateReset: () => void;
  onRotateRight: () => void;
  onRenameEnemy: (name: string) => void;
  onInitiative: (value: number | null) => void;
  onResize: (size: number) => void;
  onReveal: () => void;
  onHide: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

export function VttSelectionPanel(props: Props) {
  const selected = props.selectedTokens.length === 1 ? props.selectedTokens[0] : null;
  const count = props.selectedTokens.length;
  const [nameDraft, setNameDraft] = useState("");
  const [initiativeDraft, setInitiativeDraft] = useState("");

  useEffect(() => {
    setNameDraft(selected?.name ?? "");
    setInitiativeDraft(selected?.initiative === null || selected?.initiative === undefined ? "" : String(selected.initiative));
  }, [selected?.id, selected?.initiative, selected?.name]);

  return (
    <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Selection</p>
        {count > 0 ? <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/5 px-2 py-0.5 text-[9px] font-black text-fuchsia-100">{count}</span> : null}
      </div>

      {count === 0 ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">Click a miniature to inspect it. Shift/Ctrl-click creates a multi-selection.</p>
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
                    <input value={nameDraft} maxLength={120} onChange={(event) => setNameDraft(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-[10px] text-slate-100 outline-none focus:border-rose-400/50" />
                    <button type="button" disabled={props.busy || !nameDraft.trim() || nameDraft.trim() === selected.name} onClick={() => props.onRenameEnemy(nameDraft)} className="rounded-lg border border-rose-400/25 px-3 text-[9px] font-black text-rose-100 disabled:opacity-35">Save</button>
                  </div>
                  <p className="mt-1.5 text-[9px] leading-4 text-slate-600">Useful for repeated models: Sailor 1, Sailor 2, Captain&apos;s Guard, etc.</p>
                </div>
              ) : null}

              <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-200">Initiative</p>
                <div className="mt-1.5 flex gap-2">
                  <input type="number" min={-100} max={100} value={initiativeDraft} placeholder="—" onChange={(event) => setInitiativeDraft(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-[10px] text-slate-100 outline-none focus:border-amber-400/50" />
                  <button type="button" disabled={props.busy} onClick={() => props.onInitiative(initiativeDraft.trim() === "" ? null : Number(initiativeDraft))} className="rounded-lg border border-amber-400/25 px-3 text-[9px] font-black text-amber-100 disabled:opacity-35">Set</button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" disabled={props.busy} onClick={props.onRotateLeft} className="min-h-9 rounded-xl border border-cyan-400/25 text-xs font-black text-cyan-100 disabled:opacity-40">↺ 45°</button>
                <button type="button" disabled={props.busy} onClick={props.onRotateReset} className="min-h-9 rounded-xl border border-slate-700 text-[10px] font-black text-slate-300 disabled:opacity-40">Reset</button>
                <button type="button" disabled={props.busy} onClick={props.onRotateRight} className="min-h-9 rounded-xl border border-cyan-400/25 text-xs font-black text-cyan-100 disabled:opacity-40">45° ↻</button>
              </div>
            </>
          ) : <p className="mt-3 text-xs text-slate-400">{count} tokens selected. Bulk actions apply to all selected miniatures.</p>}

          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">Creature size</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {SIZE_PRESETS.map((preset) => (
                <button key={preset.label} type="button" disabled={props.busy} onClick={() => props.onResize(preset.value)} className="min-h-9 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2 text-[9px] font-bold text-amber-100 disabled:opacity-40">{preset.label}</button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled={props.busy} onClick={props.onReveal} className="min-h-10 rounded-xl border border-emerald-400/30 px-3 text-[10px] font-black text-emerald-200 disabled:opacity-40">Reveal</button>
            <button type="button" disabled={props.busy} onClick={props.onHide} className="min-h-10 rounded-xl border border-fuchsia-400/30 px-3 text-[10px] font-black text-fuchsia-200 disabled:opacity-40">Hide</button>
            <button type="button" disabled={props.busy} onClick={props.onDuplicate} className="min-h-10 rounded-xl border border-cyan-400/25 px-3 text-[10px] font-black text-cyan-100 disabled:opacity-40">Duplicate enemies</button>
            <button type="button" disabled={props.busy} onClick={props.onRemove} className="min-h-10 rounded-xl border border-rose-400/30 px-3 text-[10px] font-black text-rose-200 disabled:opacity-40">Remove</button>
          </div>

          <p className="mt-3 text-[9px] leading-4 text-slate-600">Shift/Ctrl-click adds or removes tokens. Party character miniatures remain unique per scene.</p>
        </>
      )}
    </section>
  );
}
