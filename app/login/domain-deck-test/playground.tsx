"use client";

import { useState } from "react";
import { DaggerheartDomainDeck } from "@/components/daggerheart/DaggerheartDomainDeck";
import type { DaggerheartCompendiumEntry } from "@/lib/daggerheart/compendium";
import type { DomainCardIdentity, DomainCardUsage } from "@/lib/daggerheart/domain-deck";

const entries: DaggerheartCompendiumEntry[] = ["Test Ward", "Test Spark", "Test Grimoire", "Test Flame", "Test Barrier", "Test Storm"].map((name, index) => ({
  id: `demo-card-${index}`, source_key: "core", category: "domain_card", slug: `demo-${index}`, name,
  domain: index % 2 ? "Arcana" : "Codex", level: 1, parent_slug: null, tier: null,
  source_page_start: null, source_page_end: null, sort_order: index,
  summary: "A sample ability for testing the card layout and selection flow.",
  rules_text: "This is a demonstration card, not an official Daggerheart ability.\n\nUse the arrows to browse the deck. Add this card to your hand or return it to the table. Occupied cards require agreement with their holder or the GM.",
  metadata: { card_type: "Demo spell", recall_cost: index % 3 }, effects: [], actions: [], errata: {},
}));

export function DomainDeckPlayground() {
  const [selected, setSelected] = useState<DomainCardIdentity[]>([]);
  const [owner, setOwner] = useState("Odetta");
  const [multiple, setMultiple] = useState(false);
  const [fail, setFail] = useState(false);
  const [limit, setLimit] = useState(2);
  const usage: DomainCardUsage[] = [
    { compendium_id: entries[0].id, name: entries[0].name, domain: "Codex", character_id: "demo-owner", character_name: owner.trim() || "Unnamed character", player_name: "" },
    ...(multiple ? [{ compendium_id: entries[0].id, name: entries[0].name, domain: "Codex", character_id: "demo-second", character_name: "Torsten", player_name: "" }] : []),
  ];
  const field = "min-h-11 rounded-lg border border-[#795060] bg-[#201219] px-3 py-2 text-[#ebdae2]";

  return <main className="mx-auto max-w-6xl space-y-6 p-4 text-[#ebdae2] sm:p-8">
    <header className="space-y-3">
      <p className="text-sm font-bold uppercase tracking-widest text-[#d399ae]">Preview · dane przykładowe</p>
      <h1 className="text-3xl font-semibold">Test wyboru kart umiejętności</h1>
      <p>Ten ekran używa tego samego widoku talii co kreator. Nazwy i opisy kart są testowe. Zmiany pozostają w tej karcie przeglądarki i nie zapisują się w kampanii.</p>
    </header>
    <fieldset className="flex flex-wrap items-end gap-4 rounded-xl border border-[#795060] p-4">
      <legend className="px-2">Scenariusz testowy</legend>
      <label className="grid gap-2">Właściciel karty Test Ward<input className={field} value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
      <label className="grid gap-2">Liczba kart<select className={field} value={limit} onChange={(event) => { setSelected([]); setLimit(Number(event.target.value)); }}><option value={2}>2 — standard</option><option value={3}>3 — dodatkowa karta</option></select></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={multiple} onChange={(event) => setMultiple(event.target.checked)} />Drugi właściciel</label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} />Symuluj błąd odczytu</label>
      <button type="button" className={field} onClick={() => { setSelected([]); setOwner("Odetta"); setMultiple(false); setFail(false); setLimit(2); }}>Reset testu</button>
    </fieldset>
    <DaggerheartDomainDeck entries={entries} usage={fail ? null : usage} domains={["Codex", "Arcana"]}
      selected={selected} limit={limit} loading={false} error={null}
      onRetry={() => setFail(false)} refreshUsage={async () => fail ? null : usage}
      onSelect={(entry) => setSelected((current) => [...current, { ...entry, compendium_id: entry.id }])}
      onRemove={(card) => setSelected((current) => current.filter((item) => item !== card))} />
  </main>;
}
