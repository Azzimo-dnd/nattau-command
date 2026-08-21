"use client";

import type { VttScene, VttToken } from "./vttTypes";

type Props = {
  scene: VttScene;
  tokens: VttToken[];
};

export function VttInitiativeStrip({ scene, tokens }: Props) {
  if (!scene.initiative_active) return null;
  const ordered = tokens.filter((token) => token.initiative !== null).slice().sort((a, b) => (b.initiative ?? -999) - (a.initiative ?? -999) || a.name.localeCompare(b.name));
  if (ordered.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 w-[min(70%,780px)] -translate-x-1/2">
      <div className="rounded-2xl border border-amber-400/25 bg-slate-950/88 p-2 shadow-2xl backdrop-blur">
        <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">Initiative · Round {scene.initiative_round}</p>
          <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">Turn order</span>
        </div>
        <div className="flex gap-1.5 overflow-hidden">
          {ordered.map((token) => {
            const current = token.id === scene.initiative_current_token_id;
            return (
              <div key={token.id} className={`min-w-0 flex-1 rounded-xl border px-2 py-1.5 ${current ? "border-amber-300 bg-amber-300/15 shadow-[0_0_18px_rgba(251,191,36,0.16)]" : "border-slate-800 bg-slate-900/80"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-[9px] font-black ${current ? "text-amber-100" : "text-slate-300"}`}>{token.name}</span>
                  <span className={`shrink-0 text-[10px] font-black ${current ? "text-amber-200" : "text-slate-500"}`}>{token.initiative}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
