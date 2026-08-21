"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

type VisibilityRow = {
  id: string;
  visible_to_players: boolean;
};

export function VttSceneManager({ scenes, workspaceSceneId, busy, onCreate, onOpen, onActivate, onDelete }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const campaignId = scenes[0]?.campaign_id ?? null;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [visibilityById, setVisibilityById] = useState<Record<string, boolean>>({});
  const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase.channel(`vtt-campaign-${campaignId}`);
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [campaignId, supabase]);

  useEffect(() => {
    let cancelled = false;
    const ids = scenes.map((scene) => scene.id);
    if (ids.length === 0) {
      setVisibilityById({});
      return;
    }

    void supabase
      .from("vtt_scenes")
      .select("id,visible_to_players")
      .in("id", ids)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setVisibilityError(error.message);
          return;
        }
        const next: Record<string, boolean> = {};
        for (const row of (data ?? []) as VisibilityRow[]) next[row.id] = row.visible_to_players;
        setVisibilityById(next);
        setVisibilityError(null);
      });

    return () => { cancelled = true; };
  }, [scenes, supabase]);

  const broadcastRefresh = () => {
    void channelRef.current?.send({ type: "broadcast", event: "refresh", payload: {} });
  };

  const setPlayerVisibility = async (scene: VttScene, visible: boolean) => {
    if (!scene.is_active || busy || visibilityBusyId) return;
    setVisibilityBusyId(scene.id);
    setVisibilityError(null);
    const { error } = await supabase
      .from("vtt_scenes")
      .update({ visible_to_players: visible, updated_at: new Date().toISOString() })
      .eq("id", scene.id);

    if (error) setVisibilityError(error.message);
    else {
      setVisibilityById((current) => ({ ...current, [scene.id]: visible }));
      broadcastRefresh();
    }
    setVisibilityBusyId(null);
  };

  const goLive = async (scene: VttScene) => {
    if (busy || visibilityBusyId) return;
    setVisibilityBusyId(scene.id);
    setVisibilityError(null);

    // A newly activated scene should always become visible. The GM may hide it again
    // immediately afterward without changing which scene remains live/editable.
    const { error } = await supabase
      .from("vtt_scenes")
      .update({ visible_to_players: true, updated_at: new Date().toISOString() })
      .eq("id", scene.id);

    if (error) {
      setVisibilityError(error.message);
      setVisibilityBusyId(null);
      return;
    }

    setVisibilityById((current) => ({ ...current, [scene.id]: true }));
    setVisibilityBusyId(null);
    onActivate(scene);
  };

  return (
    <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Scenes</p>
        <button
          type="button"
          disabled={busy || Boolean(visibilityBusyId)}
          onClick={onCreate}
          className="rounded-lg border border-violet-400/30 bg-violet-400/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-violet-100 disabled:opacity-40"
        >
          + New
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">
        Prepare scenes privately. A live scene can also be hidden from players without taking it offline for the GM.
      </p>

      {visibilityError ? (
        <p className="mt-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-2.5 py-2 text-[9px] leading-4 text-rose-200">
          {visibilityError}
        </p>
      ) : null}

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {scenes.map((scene) => {
          const playerVisible = visibilityById[scene.id] ?? true;
          const visibilityBusy = visibilityBusyId === scene.id;

          return (
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
                  <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${playerVisible ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-amber-400/25 bg-amber-400/10 text-amber-200"}`}>
                    {playerVisible ? "Live · Visible" : "Live · Hidden"}
                  </span>
                ) : (
                  <span className="rounded-full border border-violet-400/20 bg-violet-400/5 px-2 py-0.5 text-[8px] font-black uppercase text-violet-200">
                    Prepared
                  </span>
                )}
              </div>

              {scene.is_active ? (
                <button
                  type="button"
                  disabled={busy || visibilityBusy}
                  onClick={() => void setPlayerVisibility(scene, !playerVisible)}
                  className={`mt-2 min-h-8 w-full rounded-lg border text-[9px] font-black disabled:opacity-40 ${playerVisible ? "border-amber-400/25 bg-amber-400/5 text-amber-200" : "border-emerald-400/25 bg-emerald-400/5 text-emerald-200"}`}
                >
                  {visibilityBusy ? "Updating…" : playerVisible ? "Hide from players" : "Show to players"}
                </button>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy || visibilityBusy}
                    onClick={() => void goLive(scene)}
                    className="min-h-8 rounded-lg border border-emerald-400/25 text-[9px] font-black text-emerald-200 disabled:opacity-40"
                  >
                    {visibilityBusy ? "Preparing…" : "Go live"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || visibilityBusy}
                    onClick={() => onDelete(scene)}
                    className="min-h-8 rounded-lg border border-rose-400/20 text-[9px] font-bold text-rose-200 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
