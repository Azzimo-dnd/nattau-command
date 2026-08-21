"use client";

import type { VttScene } from "./vttTypes";

type Props = {
  scenes: VttScene[];
  workspaceSceneId: string;
  busy: boolean;
  onCreate: () => void;
  onOpen: (scene: VttScene) => void;
  onActivate: (scene: VttScene) => void;
  onDelete: (scene: VttScene) => void;
};

export function VttSceneManager({ scenes, workspaceSceneId, busy, onCreate, onOpen, onActivate, onDelete }: Props) {
  return (
    <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Scenes</p>
        <button
          type="button"
          disabled={busy}
          onClick={onCreate}
          className="rounded-lg border border-violet-400/30 bg-violet-400/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-violet-100 disabled:opacity-40"
        >
          + New
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">
        Prepare maps and enemies privately, then switch the live table when the party arrives.
      </p>

      <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className={`rounded-xl border p-2.5 ${scene.id === workspaceSceneId ? "border-violet-400/45 bg-violet-400/10" : "border-slate-800 bg-slate-950/45"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => onOpen(scene)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-xs font-black text-slate-100">{scene.name}</span>
                <span className="mt-0.5 block text-[9px] text-slate-500">
                  {scene.grid_width}×{scene.grid_height} · {scene.map_original_name ?? "plain grid"}
                </span>
              </button>
              {scene.is_active ? (
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[8px] font-black uppercase text-emerald-200">
                  Live
                </span>
              ) : (
                <span className="rounded-full border border-violet-400/20 bg-violet-400/5 px-2 py-0.5 text-[8px] font-black uppercase text-violet-200">
                  Prepared
                </span>
              )}
            </div>

            {!scene.is_active ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onActivate(scene)}
                  className="min-h-8 rounded-lg border border-emerald-400/25 text-[9px] font-black text-emerald-200 disabled:opacity-40"
                >
                  Go live
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(scene)}
                  className="min-h-8 rounded-lg border border-rose-400/20 text-[9px] font-bold text-rose-200 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
