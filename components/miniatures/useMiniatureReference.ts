"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Reference = { player_id: string; display_name: string; miniature_id: string | null; storage_path: string | null; web_storage_path: string | null; original_name: string | null };
type Campaign = { id: string; name: string };
const EMPTY: Reference[] = [];

export function useMiniatureReference(campaignId?: string) {
  const supabase = useMemo(() => campaignId ? createClient() : null, [campaignId]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [referenceCampaign, setReferenceCampaign] = useState(campaignId ?? "");
  const [roster, setRoster] = useState<{ campaign: string; rows: Reference[]; error: string | null } | null>(null);
  const [choice, setChoice] = useState<{ campaign: string; id: string } | null>(null);
  const [download, setDownload] = useState<{ path: string; file: File | null; error: string | null } | null>(null);
  const references = roster?.campaign === referenceCampaign ? roster.rows : EMPTY;
  const referenceId = choice?.campaign === referenceCampaign ? choice.id : references.find((row) => row.display_name.trim().toLowerCase() === "pippo")?.player_id ?? references[0]?.player_id ?? "";
  const selected = references.find((row) => row.player_id === referenceId);
  const path = selected?.web_storage_path ?? selected?.storage_path;

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.from("campaigns").select("id,name").order("name").then(({ data }) => { if (alive) setCampaigns((data ?? []) as Campaign[]); });
    return () => { alive = false; };
  }, [supabase]);
  useEffect(() => {
    if (!supabase || !referenceCampaign) return;
    let alive = true;
    void supabase.rpc("list_campaign_miniature_roster", { p_campaign_id: referenceCampaign }).then(({ data, error }) => {
      if (alive) setRoster({ campaign: referenceCampaign, rows: ((data ?? []) as Reference[]).filter((row) => row.miniature_id && row.storage_path), error: error ? "Could not load reference miniatures for this campaign." : null });
    });
    return () => { alive = false; };
  }, [referenceCampaign, supabase]);
  useEffect(() => {
    if (!supabase || !path) return;
    let alive = true;
    void supabase.storage.from("character-miniatures").download(path).then(({ data, error }) => {
      if (alive) setDownload({ path, file: data ? new File([data], path.split("/").pop()!, { type: data.type }) : null, error: error ? "Could not download the reference miniature." : null });
    });
    return () => { alive = false; };
  }, [path, supabase]);
  return {
    campaigns, referenceCampaign, setReferenceCampaign, references, referenceId,
    setReferenceId: (id: string) => setChoice({ campaign: referenceCampaign, id }),
    file: path && download?.path === path ? download.file : null,
    name: selected?.display_name ?? "Reference",
    loading: Boolean(supabase && (roster?.campaign !== referenceCampaign || (path && download?.path !== path))),
    error: (roster?.campaign === referenceCampaign ? roster.error : null) ?? (download?.path === path ? download?.error : null),
  };
}
