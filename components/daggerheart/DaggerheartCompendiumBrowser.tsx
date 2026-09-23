"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Entry = {
  id: string;
  source_key: "core" | "hope-fear";
  category: string;
  slug: string;
  name: string;
  parent_slug: string | null;
  domain: string | null;
  level: number | null;
  tier: number | null;
  summary: string;
  rules_text: string;
  metadata: Record<string, unknown>;
  source_page_start: number | null;
  source_page_end: number | null;
};

const categories = [
  ["", "All"],
  ["class", "Classes"],
  ["subclass", "Subclasses"],
  ["ancestry", "Ancestries"],
  ["community", "Communities"],
  ["domain_card", "Domain Cards"],
  ["weapon_primary", "Primary Weapons"],
  ["weapon_secondary", "Secondary Weapons"],
  ["armor", "Armor"],
  ["consumable", "Consumables"],
  ["loot_item", "Loot"],
  ["beastform", "Beastforms"],
  ["martial_stance", "Martial Stances"],
  ["transformation", "Transformations"],
] as const;

const domains = ["", "Arcana", "Blade", "Bone", "Codex", "Grace", "Midnight", "Sage", "Splendor", "Valor", "Dread"];

function sourceLabel(source: Entry["source_key"]) {
  return source === "hope-fear" ? "Hope & Fear" : "Core Rulebook";
}

function metadataLine(entry: Entry) {
  const pieces: string[] = [];
  if (entry.domain) pieces.push(entry.domain);
  if (entry.level) pieces.push(`Level ${entry.level}`);
  if (entry.tier) pieces.push(`Tier ${entry.tier}`);
  const meta = entry.metadata ?? {};
  if (typeof meta.trait === "string") pieces.push(meta.trait);
  if (typeof meta.range === "string") pieces.push(meta.range);
  if (typeof meta.damage === "string") pieces.push(meta.damage);
  return pieces.join(" · ");
}

export function DaggerheartCompendiumBrowser() {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [domain, setDomain] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      let request = supabase
        .from("daggerheart_compendium_entries")
        .select("id,source_key,category,slug,name,parent_slug,domain,level,tier,summary,rules_text,metadata,source_page_start,source_page_end")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .limit(250);

      if (category) request = request.eq("category", category);
      if (source) request = request.eq("source_key", source);
      if (domain) request = request.eq("domain", domain);
      if (maxLevel) request = request.lte("level", Number(maxLevel));
      if (query.trim()) {
        const safe = query.trim().replace(/[%_,()]/g, " ");
        request = request.or(`name.ilike.%${safe}%,summary.ilike.%${safe}%,rules_text.ilike.%${safe}%`);
      }

      const result = await request;
      if (result.error) {
        setError(result.error.message);
        setEntries([]);
      } else {
        setEntries((result.data ?? []) as Entry[]);
      }
      setLoading(false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [category, domain, maxLevel, query, source, supabase]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0">
        <div className="rounded-2xl border border-[#4a2935] bg-[#130c11]/90 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the compendium…"
              className="min-h-11 rounded-xl border border-[#58323f] bg-[#0d080b] px-3 text-sm text-[#eadfe3] outline-none focus:border-[#a34d64] xl:col-span-2"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="min-h-11 rounded-xl border border-[#58323f] bg-[#0d080b] px-3 text-sm text-[#eadfe3]">
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="min-h-11 rounded-xl border border-[#58323f] bg-[#0d080b] px-3 text-sm text-[#eadfe3]">
              <option value="">Both books</option>
              <option value="core">Core Rulebook</option>
              <option value="hope-fear">Hope & Fear</option>
            </select>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="min-h-11 rounded-xl border border-[#58323f] bg-[#0d080b] px-3 text-sm text-[#eadfe3]">
              <option value="">Any domain</option>
              {domains.filter(Boolean).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          {category === "domain_card" && (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-[#8f747d]">Max level</label>
              <select value={maxLevel} onChange={(e) => setMaxLevel(e.target.value)} className="min-h-10 rounded-xl border border-[#58323f] bg-[#0d080b] px-3 text-sm text-[#eadfe3]">
                <option value="">Any</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {loading && <p className="col-span-full rounded-2xl border border-[#3a232c] bg-black/20 p-5 text-sm text-[#9b858c]">Opening the archives…</p>}
          {error && <p className="col-span-full rounded-2xl border border-red-900/50 bg-red-950/20 p-5 text-sm text-red-200">{error}</p>}
          {!loading && !error && entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelected(entry)}
              className={`rounded-2xl border p-4 text-left transition ${selected?.id === entry.id ? "border-[#9b4b61] bg-[#35131e]" : "border-[#3b252e] bg-[#110b0f]/80 hover:border-[#684052]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9d5a6d]">{sourceLabel(entry.source_key)} · {entry.category.replaceAll("_", " ")}</p>
                  <h3 className="mt-2 font-serif text-lg font-black text-[#ead7dc]">{entry.name}</h3>
                  {metadataLine(entry) && <p className="mt-1 text-xs text-[#a28c94]">{metadataLine(entry)}</p>}
                </div>
                {entry.level && <span className="rounded-full border border-[#59303e] bg-black/20 px-2 py-1 text-xs font-bold text-[#c99ca8]">Lv {entry.level}</span>}
              </div>
              {entry.summary && <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#aa989f]">{entry.summary}</p>}
              {!entry.summary && entry.rules_text && <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-6 text-[#aa989f]">{entry.rules_text}</p>}
            </button>
          ))}
          {!loading && !error && entries.length === 0 && <p className="col-span-full rounded-2xl border border-[#3a232c] bg-black/20 p-5 text-sm text-[#9b858c]">No entries match these filters.</p>}
        </div>
      </section>

      <aside className="self-start xl:sticky xl:top-6">
        <div className="rounded-[24px] border border-[#52303d] bg-gradient-to-br from-[#28121a] to-[#0d080b] p-5">
          {selected ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#a75d72]">{sourceLabel(selected.source_key)}</p>
              <h2 className="mt-2 font-serif text-3xl font-black text-[#f0dde2]">{selected.name}</h2>
              {metadataLine(selected) && <p className="mt-2 text-sm font-semibold text-[#c19ba6]">{metadataLine(selected)}</p>}
              {selected.summary && <p className="mt-5 text-sm leading-6 text-[#b5a2a8]">{selected.summary}</p>}
              {selected.rules_text && <div className="mt-5 whitespace-pre-line rounded-2xl border border-[#3d2730] bg-black/20 p-4 text-sm leading-6 text-[#ddd0d4]">{selected.rules_text}</div>}
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#816d74]">
                {selected.source_page_start && <span>Source page {selected.source_page_start}{selected.source_page_end && selected.source_page_end !== selected.source_page_start ? `–${selected.source_page_end}` : ""}</span>}
                {selected.parent_slug && <span>· Parent: {selected.parent_slug}</span>}
              </div>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#a75d72]">Private archive</p>
              <h2 className="mt-2 font-serif text-2xl font-black text-[#f0dde2]">Choose an entry</h2>
              <p className="mt-3 text-sm leading-6 text-[#9d898f]">Browse the Core Rulebook and Hope & Fear data imported into the private Supabase compendium.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
