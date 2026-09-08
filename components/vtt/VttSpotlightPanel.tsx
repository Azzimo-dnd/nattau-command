"use client";

import type { VttScene, VttToken } from "./vttTypes";

export function VttSpotlightPanel({ scene, tokens, busy, onSpotlight }: {
  scene: VttScene; tokens: VttToken[]; busy: boolean; onSpotlight: (id: string | null) => void;
}) {
  return (
    <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="font-serif text-xl font-bold text-rose-200">In the Spotlight</h3>
      <p className="mt-2 text-xs leading-5 text-slate-400">Choose who the story follows. Pass the spotlight when the fiction calls for it; there is no fixed initiative order.</p>
      <div className="mt-3 grid gap-2">
        {tokens.map((token) => <button key={token.id} type="button" disabled={busy} onClick={() => onSpotlight(token.id)} aria-pressed={scene.initiative_active && scene.initiative_current_token_id === token.id}
          className={`min-h-10 rounded-xl border px-3 py-2 text-left text-xs font-bold disabled:opacity-40 ${scene.initiative_active && scene.initiative_current_token_id === token.id ? "border-rose-300 bg-rose-300/15 text-rose-100" : "border-slate-700 text-slate-300"}`}>
          {token.name}{!token.visible_to_players ? " · hidden" : ""}
        </button>)}
        {tokens.length === 0 && <p className="text-xs text-slate-500">Place the party or a creature to begin.</p>}
      </div>
      {scene.initiative_active && <button type="button" disabled={busy} onClick={() => onSpotlight(null)} className="mt-3 min-h-10 w-full rounded-xl border border-slate-700 text-xs text-slate-300 disabled:opacity-40">Return to the conversation</button>}
    </section>
  );
}
