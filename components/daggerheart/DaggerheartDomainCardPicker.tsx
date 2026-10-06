"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DaggerheartCompendiumEntry } from "@/lib/daggerheart/compendium";
import type { DomainCardIdentity, DomainCardUsage } from "@/lib/daggerheart/domain-deck";
import { DaggerheartDomainDeck } from "./DaggerheartDomainDeck";

type Props = {
  campaignId: string;
  characterId?: string;
  domains: string[];
  selected: DomainCardIdentity[];
  limit: number;
  maxLevel?: number;
  onSelect: (entry: DaggerheartCompendiumEntry) => void;
  onRemove: (card: DomainCardIdentity) => void;
};

export function DaggerheartDomainCardPicker(props: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<DaggerheartCompendiumEntry[]>([]);
  const [usage, setUsage] = useState<DomainCardUsage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);
  const domainKey = props.domains.join("|");
  const campaignId = props.campaignId;
  const maxLevel = Math.max(1, props.maxLevel ?? 1);

  const refreshUsage = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const result = await supabase.rpc("list_daggerheart_domain_card_usage", { p_campaign_id: campaignId });
      if (result.error) throw result.error;
      const rows = (result.data ?? []) as DomainCardUsage[];
      if (id === requestId.current) setUsage(rows);
      return rows;
    } catch {
      if (id === requestId.current) setUsage(null);
      return null;
    }
  }, [campaignId, supabase]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setEntries([]);
      try {
        const result = await supabase.from("daggerheart_compendium_entries")
          .select("id,source_key,category,slug,name,parent_slug,domain,level,tier,summary,rules_text,metadata,effects,actions,errata,source_page_start,source_page_end,sort_order")
          .eq("is_active", true).eq("category", "domain_card").lte("level", maxLevel)
          .in("domain", domainKey.split("|").filter(Boolean))
          .order("domain").order("sort_order").order("name").limit(500);
        if (result.error) throw result.error;
        if (!cancelled) setEntries((result.data ?? []) as DaggerheartCompendiumEntry[]);
      } catch {
        if (!cancelled) setError("The deck could not be loaded. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [domainKey, maxLevel, attempt, supabase]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void refreshUsage(); }, 0);
    const timer = window.setInterval(() => { void refreshUsage(); }, 20000);
    const refresh = () => { void refreshUsage(); };
    window.addEventListener("focus", refresh);
    return () => {
      // Invalidate pending requests on unmount or a campaign change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++requestId.current;
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refreshUsage]);

  return <DaggerheartDomainDeck key={`${campaignId}:${domainKey}:${maxLevel}`} {...props} entries={entries}
    usage={usage} loading={loading} error={error} refreshUsage={refreshUsage}
    onRetry={() => { setAttempt((value) => value + 1); void refreshUsage(); }} />;
}
