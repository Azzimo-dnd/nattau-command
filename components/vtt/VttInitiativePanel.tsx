"use client";

import type { VttScene, VttToken } from "./vttTypes";

type Props = {
  scene: VttScene;
  tokens: VttToken[];
  busy: boolean;
  onInitiative: (tokenId: string, value: number | null) => void;
  onStart: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onStop: (clearValues: boolean) => void;
};

export function VttInitiativePanel({ scene, tokens, busy, onInitiative, onStart, onPrevious, onNext, onStop }: Props) {
  const ordered = tokens.slice().sort((a, b) => {
    if (a.initiative === null && b.initiative !== null) return 1;
    if (a.initiative !== null && b.initiative === null) return -1;
    return (b.initiative ?? -999) - (a.initiative ?? -999) || a.name.localeCompare(b.name);
  });
  const readyCount = tokens.filter((token) => token.initiative !== null).length;

  return (
    <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Initiative</p>
        {scene.initiative_active ? <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[8px] font-black uppercase text-amber-200">Round {scene.initiative_round}</span> : null}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">Set values for the tokens taking part. Hidden enemies stay in the GM queue but are omitted from the players&apos; strip until revealed.</p>

      <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {ordered.map((token) => {
          const current = scene.initiative_active && token.id === scene.initiative_current_token_id;
          return (
            <div key={token.id} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${current ? "border-amber-300/45 bg-amber-300/10" : "border-slate-800 bg-slate-950/45"}`}>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[10px] font-black ${current ? "text-amber-100" : "text-slate-200"}`}>{token.name}</p>
                <p className="text-[8px] uppercase tracking-[0.1em] text-slate-600">{token.source_kind}{token.source_kind === "enemy" && !token.visible_to_players ? " · hidden" : ""}</p>
              </div>
              <input
                type="number"
                min={-100}
                max={100}
                value={token.initiative ?? ""}
                placeholder="—"
                disabled={busy}
                onChange={(event) => onInitiative(token.id, event.target.value === "" ? null : Number(event.target.value))}
                className="h-8 w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 text-center text-[10px] font-black text-slate-100 outline-none focus:border-amber-400/50 disabled:opacity-40"
              />
            </div>
          );
        })}
      </div>

      {scene.initiative_active ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button type="button" disabled={busy || readyCount === 0} onClick={onPrevious} className="min-h-9 rounded-xl border border-slate-700 text-[9px] font-black text-slate-300 disabled:opacity-35">← Previous</button>
            <button type="button" disabled={busy} onClick={() => onStop(false)} className="min-h-9 rounded-xl border border-rose-400/25 text-[9px] font-black text-rose-200 disabled:opacity-35">End</button>
            <button type="button" disabled={busy || readyCount === 0} onClick={onNext} className="min-h-9 rounded-xl border border-amber-400/30 bg-amber-400/10 text-[9px] font-black text-amber-100 disabled:opacity-35">Next →</button>
          </div>
          <button type="button" disabled={busy} onClick={() => onStop(true)} className="mt-2 min-h-8 w-full rounded-lg border border-slate-800 text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500 disabled:opacity-35">End & clear initiative values</button>
        </>
      ) : (
        <button type="button" disabled={busy || readyCount === 0} onClick={onStart} className="mt-3 min-h-10 w-full rounded-xl border border-amber-400/30 bg-amber-400/10 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 disabled:opacity-35">Start initiative · {readyCount}</button>
      )}
    </section>
  );
}
