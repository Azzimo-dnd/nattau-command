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

type PartyRosterRow = {
  user_id: string;
  display_name: string;
  has_miniature: boolean;
  included: boolean;
};

export function VttSceneManager({ scenes, workspaceSceneId, busy, onCreate, onOpen, onActivate, onVisibility, onDuplicate, onDelete }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [thumbnailById, setThumbnailById] = useState<Record<string, string>>({});
  const [partyRoster, setPartyRoster] = useState<PartyRosterRow[]>([]);
  const [partyDraft, setPartyDraft] = useState<Set<string>>(new Set());
  const [partyLoading, setPartyLoading] = useState(false);
  const [partySaving, setPartySaving] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [partyMessage, setPartyMessage] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const loadRoster = async () => {
      if (!workspaceSceneId) {
        setPartyRoster([]);
        setPartyDraft(new Set());
        return;
      }
      setPartyLoading(true);
      setPartyError(null);
      setPartyMessage(null);
      const { data, error } = await supabase.rpc("list_vtt_party_roster", { p_scene_id: workspaceSceneId });
      if (cancelled) return;
      if (error) {
        setPartyError(error.message);
        setPartyRoster([]);
        setPartyDraft(new Set());
      } else {
        const rows = (data ?? []) as PartyRosterRow[];
        setPartyRoster(rows);
        setPartyDraft(new Set(rows.filter((row) => row.included && row.has_miniature).map((row) => row.user_id)));
      }
      setPartyLoading(false);
    };
    void loadRoster();
    return () => { cancelled = true; };
  }, [supabase, workspaceSceneId]);

  const selectedCount = partyRoster.filter((row) => row.has_miniature && partyDraft.has(row.user_id)).length;
  const readyCount = partyRoster.filter((row) => row.has_miniature).length;

  const togglePartyMember = (userId: string) => {
    setPartyMessage(null);
    setPartyDraft((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAllParty = () => {
    setPartyMessage(null);
    setPartyDraft(new Set(partyRoster.filter((row) => row.has_miniature).map((row) => row.user_id)));
  };

  const selectNoParty = () => {
    setPartyMessage(null);
    setPartyDraft(new Set());
  };

  const savePartyRoster = async () => {
    if (!workspaceSceneId || partySaving || busy) return;
    setPartySaving(true);
    setPartyError(null);
    setPartyMessage(null);
    const selectedIds = partyRoster
      .filter((row) => row.has_miniature && partyDraft.has(row.user_id))
      .map((row) => row.user_id);
    const { error } = await supabase.rpc("set_vtt_party_roster", {
      p_scene_id: workspaceSceneId,
      p_user_ids: selectedIds,
    });
    if (error) setPartyError(error.message);
    else {
      setPartyRoster((current) => current.map((row) => ({ ...row, included: row.has_miniature && partyDraft.has(row.user_id) })));
      setPartyMessage(`Roster saved: ${selectedIds.length} character${selectedIds.length === 1 ? "" : "s"}. Use Place / refresh party below to sync the tabletop.`);
    }
    setPartySaving(false);
  };

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

      <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Party roster</p>
            <p className="mt-1 text-[9px] leading-4 text-slate-500">Choose which player characters belong to the selected scene.</p>
          </div>
          <span className="rounded-full border border-cyan-400/20 px-2 py-1 text-[9px] font-black text-cyan-100">{selectedCount}/{readyCount}</span>
        </div>

        {partyLoading ? (
          <p className="mt-3 text-[10px] text-slate-500">Loading party…</p>
        ) : partyRoster.length === 0 ? (
          <p className="mt-3 text-[10px] leading-4 text-slate-500">No active player accounts are available for this scene.</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {partyRoster.map((member) => (
              <label key={member.user_id} className={`flex min-h-9 items-center justify-between gap-3 rounded-lg border px-2.5 py-2 ${member.has_miniature ? "cursor-pointer border-slate-800 bg-slate-950/50" : "border-slate-900 bg-slate-950/25 opacity-55"}`}>
                <span className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={member.has_miniature && partyDraft.has(member.user_id)}
                    disabled={!member.has_miniature || partySaving || busy}
                    onChange={() => togglePartyMember(member.user_id)}
                    className="h-4 w-4 shrink-0 accent-cyan-400"
                  />
                  <span className="truncate text-[10px] font-bold text-slate-200">{member.display_name}</span>
                </span>
                <span className={`shrink-0 text-[8px] font-black uppercase ${member.has_miniature ? "text-emerald-300" : "text-slate-600"}`}>{member.has_miniature ? "Ready" : "No miniature"}</span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={partyLoading || partySaving || busy} onClick={selectAllParty} className="min-h-8 rounded-lg border border-slate-700 text-[9px] font-bold text-slate-300 disabled:opacity-40">Select all</button>
          <button type="button" disabled={partyLoading || partySaving || busy} onClick={selectNoParty} className="min-h-8 rounded-lg border border-slate-700 text-[9px] font-bold text-slate-300 disabled:opacity-40">Select none</button>
        </div>
        <button type="button" disabled={partyLoading || partySaving || busy} onClick={() => void savePartyRoster()} className="mt-2 min-h-9 w-full rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-[9px] font-black uppercase tracking-[0.08em] text-cyan-100 disabled:opacity-40">
          {partySaving ? "Saving…" : "Save roster"}
        </button>
        {partyMessage ? <p className="mt-2 text-[9px] leading-4 text-emerald-300">{partyMessage}</p> : null}
        {partyError ? <p className="mt-2 text-[9px] leading-4 text-rose-300">{partyError}</p> : null}
      </div>
    </section>
  );
}
