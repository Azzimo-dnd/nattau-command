"use client";

import { useEffect, useMemo, useState } from "react";
import { DaggerheartDomainDeck } from "@/components/daggerheart/DaggerheartDomainDeck";
import type { DaggerheartCompendiumEntry } from "@/lib/daggerheart/compendium";
import type { DomainCardIdentity, DomainCardUsage } from "@/lib/daggerheart/domain-deck";
import { createClient } from "@/lib/supabase/client";

const RETURN_PATH = "/login/domain-deck-test";

export function DomainDeckPlayground() {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<DaggerheartCompendiumEntry[]>([]);
  const [selected, setSelected] = useState<DomainCardIdentity[]>([]);
  const [owner, setOwner] = useState("Odetta");
  const [multiple, setMultiple] = useState(false);
  const [fail, setFail] = useState(false);
  const [limit, setLimit] = useState(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setAuthRequired(false);

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!sessionData.session) {
          if (!cancelled) {
            setEntries([]);
            setAuthRequired(true);
            setError("Sign in is required to load the real Daggerheart compendium on this preview.");
          }
          return;
        }

        const result = await supabase.from("daggerheart_compendium_entries")
          .select("id,source_key,category,slug,name,parent_slug,domain,level,tier,summary,rules_text,metadata,effects,actions,errata,source_page_start,source_page_end,sort_order")
          .eq("is_active", true)
          .eq("category", "domain_card")
          .eq("level", 1)
          .order("domain")
          .order("sort_order")
          .order("name")
          .limit(500);

        if (result.error) throw result.error;
        if (!cancelled) {
          const cards = (result.data ?? []) as DaggerheartCompendiumEntry[];
          setEntries(cards);
          if (cards.length === 0) {
            setError("The compendium request succeeded, but no level 1 Domain cards were returned for this account.");
          }
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
          setError("The real Domain deck could not be loaded. Please retry; if the problem continues, sign in again on this preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [attempt, supabase]);

  const domains = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.domain).filter((domain): domain is string => Boolean(domain)))),
    [entries],
  );
  const occupied = entries[0] ?? null;
  const usage: DomainCardUsage[] = occupied ? [
    {
      compendium_id: occupied.id,
      source_key: occupied.source_key,
      slug: occupied.slug,
      name: occupied.name,
      domain: occupied.domain,
      character_id: "demo-owner",
      character_name: owner.trim() || "Unnamed character",
      player_name: "",
    },
    ...(multiple ? [{
      compendium_id: occupied.id,
      source_key: occupied.source_key,
      slug: occupied.slug,
      name: occupied.name,
      domain: occupied.domain,
      character_id: "demo-second",
      character_name: "Torsten",
      player_name: "",
    }] : []),
  ] : [];
  const field = "min-h-11 rounded-lg border border-[#795060] bg-[#201219] px-3 py-2 text-[#ebdae2]";
  const signInHref = `/login?next=${encodeURIComponent(RETURN_PATH)}`;

  return <main className="mx-auto max-w-6xl space-y-6 p-4 text-[#ebdae2] sm:p-8">
    <header className="space-y-3">
      <p className="text-sm font-bold uppercase tracking-widest text-[#d399ae]">Preview · real compendium data</p>
      <h1 className="text-3xl font-semibold">Domain card selection test</h1>
      <p>These are the real level 1 Domain cards from the same compendium and errata layer used by character creation. Choices on this page stay local and are not saved to the campaign.</p>
      {authRequired && <p className="text-sm text-[#efc0d0]">
        This Vercel preview has its own browser session. <a className="font-semibold underline" href={signInHref}>Sign in here</a> and you will be returned directly to this test.
      </p>}
    </header>

    <fieldset className="flex flex-wrap items-end gap-4 rounded-xl border border-[#795060] p-4">
      <legend className="px-2">Test scenario</legend>
      <label className="grid gap-2">Holder of {occupied?.name ?? "the test card"}<input className={field} value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
      <label className="grid gap-2">Starting hand size<select className={field} value={limit} onChange={(event) => { setSelected([]); setLimit(Number(event.target.value)); }}><option value={2}>2 — standard</option><option value={3}>3 — extra card</option></select></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={multiple} onChange={(event) => setMultiple(event.target.checked)} />Second holder</label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} />Simulate holder lookup failure</label>
      <button type="button" className={field} onClick={() => { setSelected([]); setOwner("Odetta"); setMultiple(false); setFail(false); setLimit(2); }}>Reset test</button>
    </fieldset>

    {authRequired && <div className="rounded-xl border border-[#8c5a6d] bg-[#2a171f] p-4 text-sm">
      <strong>Sign in required.</strong> The compendium is protected by Supabase RLS, so the preview cannot read the cards until you authenticate on this preview domain. <a className="ml-1 font-semibold underline" href={signInHref}>Sign in and return to the deck</a>.
    </div>}

    <DaggerheartDomainDeck entries={entries} usage={fail ? null : usage} domains={domains}
      selected={selected} limit={limit} loading={loading} error={error}
      onRetry={() => { setFail(false); setAttempt((value) => value + 1); }} refreshUsage={async () => fail ? null : usage}
      onSelect={(entry) => setSelected((current) => [...current, { ...entry, compendium_id: entry.id }])}
      onRemove={(card) => setSelected((current) => current.filter((item) => item !== card))} />
  </main>;
}
