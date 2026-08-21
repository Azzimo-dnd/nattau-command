"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VttScene } from "./vttTypes";

type Props = {
  scenes: VttScene[];
  workspaceSceneId: string;
  busy: boolean;
  onCreate: () => void;
  onOpen: (scene: VttScene) => void;
  onActivate: (scene: VttScene) => void;
  onVisibility: (scene: VttScene, visible: boolean) => void;
  onDuplicate: (scene: VttScene) => void;
  onDelete: (scene: VttScene) => void;
};

export function VttSceneManager({ scenes, workspaceSceneId, busy, onCreate, onOpen, onActivate, onVisibility, onDuplicate, onDelete }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [thumbnailById, setThumbnailById] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next: Record<string, string> = {};
      await Promise.all(scenes.map(async (scene) => {
        if (!scene.map_storage_path) return;
        const { data } = await supabase.storage.from("vtt-maps").createSignedUrl(scene.map_storage_path, 3600);
        if (data?.signedUrl) next[scene.id] = data.signedUrl;
      }));
      if (!cancelled) setThumbnailById(next);
    };
    void load();
    return () => { cancelled = true; };
  }, [scenes, supabase]);

  return (
    <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Scenes</p>
        <button type="button" disabled={busy} onClick={onCreate} className="rounded-lg border border-violet-400/30 bg-violet-400/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-violet-100 disabled:opacity-40">+ New</button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">Prepare scenes privately, duplicate useful setups, and decide exactly when the live table is visible to players.</p>

      <div className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
        {scenes.map((scene) => {
          const activeCard = scene.id === workspaceSceneId;
          return (
            <div key={scene.id} className={`overflow-hidden rounded-xl border ${activeCard ? "border-violet-400/45 bg-violet-400/10" : "border-slate-800 bg-slate-950/45"}`}>
              {thumbnailById[scene.id] ? (
                <button type="button" onClick={() => onOpen(scene)} className="block h-20 w-full overflow-hidden border-b border-slate-800 bg-slate-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnailById[scene.id]} alt="" className="h-full w-full object-cover opacity-75 transition hover:opacity-100" />
                </button>
              ) : null}
              <div className="p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => onOpen(scene)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-xs font-black text-slate-100">{scene.name}</span>
                    <span className="mt-0.5 block text-[9px] text-slate-500">{scene.grid_width}×{scene.grid_height} · {scene.map_original_name ?? "plain grid"}</span>
                  </button>
                  {scene.is_active ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${scene.visible_to_players ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-amber-400/25 bg-amber-400/10 text-amber-200"}`}>{scene.visible_to_players ? "Live · Visible" : "Live · Hidden"}</span>
                  ) : (
                    <span className="rounded-full border border-violet-400/20 bg-violet-400/5 px-2 py-0.5 text-[8px] font-black uppercase text-violet-200">Prepared</span>
                  )}
                </div>

                {scene.is_active ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy} onClick={() => onVisibility(scene, !scene.visible_to_players)} className={`min-h-8 rounded-lg border text-[9px] font-black disabled:opacity-40 ${scene.visible_to_players ? "border-amber-400/25 bg-amber-400/5 text-amber-200" : "border-emerald-400/25 bg-emerald-400/5 text-emerald-200"}`}>{scene.visible_to_players ? "Hide players" : "Show players"}</button>
                    <button type="button" disabled={busy} onClick={() => onDuplicate(scene)} className="min-h-8 rounded-lg border border-cyan-400/20 text-[9px] font-black text-cyan-100 disabled:opacity-40">Duplicate</button>
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button type="button" disabled={busy} onClick={() => onActivate(scene)} className="min-h-8 rounded-lg border border-emerald-400/25 text-[9px] font-black text-emerald-200 disabled:opacity-40">Go live</button>
                    <button type="button" disabled={busy} onClick={() => onDuplicate(scene)} className="min-h-8 rounded-lg border border-cyan-400/20 text-[9px] font-black text-cyan-100 disabled:opacity-40">Duplicate</button>
                    <button type="button" disabled={busy} onClick={() => onDelete(scene)} className="min-h-8 rounded-lg border border-rose-400/20 text-[9px] font-bold text-rose-200 disabled:opacity-40">Delete</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
