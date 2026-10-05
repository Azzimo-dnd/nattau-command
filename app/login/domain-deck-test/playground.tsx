"use client";

import { useEffect, useMemo, useState } from "react";
import { DaggerheartDomainDeck } from "@/components/daggerheart/DaggerheartDomainDeck";
import type { DaggerheartCompendiumEntry } from "@/lib/daggerheart/compendium";
import type { DomainCardIdentity, DomainCardUsage } from "@/lib/daggerheart/domain-deck";
import { createClient } from "@/lib/supabase/client";

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
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
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
        if (!cancelled) setEntries((result.data ?? []) as DaggerheartCompendiumEntry[]);
      } catch {
        if (!cancelled) {
          setEntries([]);
          setError("Nie udało się wczytać prawdziwej talii. Zaloguj się na tym preview i spróbuj ponownie.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [attempt, supabase]);

  const domains = useMemo(() => Array.from(new Set(entries.map((entry) => entry.domain).filter((domain): domain is string => Boolean(domain)))), [entries]);
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

  return <main className="mx-auto max-w-6xl space-y-6 p-4 text-[#ebdae2] sm:p-8">
    <header className="space-y-3">
      <p className="text-sm font-bold uppercase tracking-widest text-[#d399ae]">Preview · prawdziwe dane compendium</p>
      <h1 className="text-3xl font-semibold">Test wyboru kart umiejętności</h1>
      <p>To są prawdziwe karty Domain 1. poziomu z tego samego compendium i warstwy erraty, z których korzysta kreator postaci. Wybory na tym ekranie nadal są lokalne i niczego nie zapisują w kampanii.</p>
      <p className="text-sm text-[#d6b8c4]">Jeśli talia się nie załaduje, <a className="underline" href="/login">zaloguj się na tym preview</a> i wróć tutaj.</p>
    </header>
    <fieldset className="flex flex-wrap items-end gap-4 rounded-xl border border-[#795060] p-4">
      <legend className="px-2">Scenariusz testowy</legend>
      <label className="grid gap-2">Właściciel karty {occupied?.name ?? "testowej"}<input className={field} value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
      <label className="grid gap-2">Liczba kart<select className={field} value={limit} onChange={(event) => { setSelected([]); setLimit(Number(event.target.value)); }}><option value={2}>2 — standard</option><option value={3}>3 — dodatkowa karta</option></select></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={multiple} onChange={(event) => setMultiple(event.target.checked)} />Drugi właściciel</label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} />Symuluj błąd odczytu właścicieli</label>
      <button type="button" className={field} onClick={() => { setSelected([]); setOwner("Odetta"); setMultiple(false); setFail(false); setLimit(2); }}>Reset testu</button>
    </fieldset>
    <DaggerheartDomainDeck entries={entries} usage={fail ? null : usage} domains={domains}
      selected={selected} limit={limit} loading={loading} error={error}
      onRetry={() => { setFail(false); setAttempt((value) => value + 1); }} refreshUsage={async () => fail ? null : usage}
      onSelect={(entry) => setSelected((current) => [...current, { ...entry, compendium_id: entry.id }])}
      onRemove={(card) => setSelected((current) => current.filter((item) => item !== card))} />
  </main>;
}
