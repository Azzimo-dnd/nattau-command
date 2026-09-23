"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  compendiumCategoryLabel,
  compendiumSourceLabel,
  daggerheartCompendiumCategories,
  metadataLabels,
  type DaggerheartCompendiumCategory,
  type DaggerheartCompendiumEntry,
} from "@/lib/daggerheart/compendium";
import { daggerheartDomains } from "@/lib/daggerheart/catalog";

type SourceFilter = "all" | "core" | "hope-fear";

const fieldClass =
  "min-h-11 rounded-xl border border-[#56323f] bg-[#100a0e] px-3 py-2 text-sm text-[#eadfe3] outline-none transition focus:border-[#a34d64] focus:ring-2 focus:ring-[#6e263b]/30";

function metadataValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export function DaggerheartCompendium() {
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState<DaggerheartCompendiumCategory>("domain_card");
  const [source, setSource] = useState<SourceFilter>("all");
  const [domain, setDomain] = useState("");
  const [level, setLevel] = useState("");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<DaggerheartCompendiumEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      const { data, error: searchError } = await supabase.rpc(
        "search_daggerheart_compendium",
        {
          p_query: query.trim() || null,
          p_category: category,
          p_domain: category === "domain_card" && domain ? domain : null,
          p_level:
            category === "domain_card" && level ? Number(level) : null,
          p_limit: 250,
        }
      );

      if (searchError) {
        setError(searchError.message);
        setEntries([]);
      } else {
        setEntries((data ?? []) as DaggerheartCompendiumEntry[]);
      }
      setLoading(false);
    }, 180);

    return () => window.clearTimeout(handle);
  }, [category, domain, level, query, supabase]);

  const visibleEntries = useMemo(
    () =>
      source === "all"
        ? entries
        : entries.filter((entry) => entry.source_key === source),
    [entries, source]
  );

  const showDomainFilters = category === "domain_card";

  return (
    <div className="space-y-5">
      <section className="rounded-[26px] border border-[#482a35] bg-[#100a0e]/90 p-4 shadow-2xl shadow-black/20 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(130px,0.7fr))]">
          <input
            className={fieldClass}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search names or rules…"
            aria-label="Search compendium"
          />
          <select
            className={fieldClass}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as DaggerheartCompendiumCategory);
              setDomain("");
              setLevel("");
            }}
          >
            {daggerheartCompendiumCategories.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className={fieldClass}
            value={source}
            onChange={(event) => setSource(event.target.value as SourceFilter)}
          >
            <option value="all">All sources</option>
            <option value="core">Core Rulebook</option>
            <option value="hope-fear">Hope & Fear</option>
          </select>
          <select
            className={fieldClass}
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            disabled={!showDomainFilters}
          >
            <option value="">All domains</option>
            {daggerheartDomains.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className={fieldClass}
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            disabled={!showDomainFilters}
          >
            <option value="">All levels</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((item) => (
              <option key={item} value={item}>
                Level {item}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#322029] pt-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9b5b6e]">
              {compendiumCategoryLabel(category)}
            </p>
            <p className="mt-1 text-sm text-[#958289]">
              {loading
                ? "Searching the archive…"
                : `${visibleEntries.length} entries available`}
            </p>
          </div>
          <div className="rounded-full border border-[#4a2a35] bg-black/20 px-3 py-1.5 text-xs text-[#b79ba4]">
            Private campaign library
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/25 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && visibleEntries.length === 0 && (
        <div className="rounded-2xl border border-[#3b252e] bg-[#100a0e]/70 p-8 text-center text-sm text-[#917e85]">
          Nothing in the Mists matches those filters.
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {visibleEntries.map((entry) => {
          const metadata = Object.entries(entry.metadata ?? {})
            .map(([key, value]) => [key, metadataValue(value)] as const)
            .filter(([, value]) => value !== null);

          return (
            <details
              key={entry.id}
              className="group self-start rounded-2xl border border-[#402731] bg-[#100a0e]/88 shadow-lg shadow-black/10 open:border-[#744050]"
            >
              <summary className="cursor-pointer list-none p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#684052] bg-[#32151f] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d29dac]">
                        {compendiumSourceLabel(entry.source_key)}
                      </span>
                      {entry.domain && (
                        <span className="rounded-full border border-[#49303a] bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aa9099]">
                          {entry.domain}
                        </span>
                      )}
                      {entry.level && (
                        <span className="text-xs font-semibold text-[#8f777f]">
                          Lv. {entry.level}
                        </span>
                      )}
                      {entry.tier && (
                        <span className="text-xs font-semibold text-[#8f777f]">
                          Tier {entry.tier}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 font-serif text-xl font-black text-[#ead7dc]">
                      {entry.name}
                    </h3>
                    {entry.summary && (
                      <p className="mt-1 text-sm text-[#a38e95]">{entry.summary}</p>
                    )}
                  </div>
                  <span className="mt-1 text-[#a45b70] transition group-open:rotate-180">
                    ⌄
                  </span>
                </div>

                {metadata.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {metadata.slice(0, 6).map(([key, value]) => (
                      <span
                        key={key}
                        className="rounded-lg border border-[#37242b] bg-black/20 px-2.5 py-1.5 text-xs text-[#b7a3aa]"
                      >
                        <b className="text-[#d0b7bf]">
                          {metadataLabels[key] ?? key.replaceAll("_", " ")}:
                        </b>{" "}
                        {value}
                      </span>
                    ))}
                  </div>
                )}
              </summary>

              <div className="border-t border-[#38232c] px-4 py-5 sm:px-5">
                <div className="whitespace-pre-wrap text-sm leading-7 text-[#d2c2c7]">
                  {entry.rules_text}
                </div>
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#2f1e25] pt-4 text-[11px] uppercase tracking-[0.14em] text-[#715d64]">
                  <span>{compendiumCategoryLabel(entry.category)}</span>
                  {entry.source_page_start && (
                    <span>
                      Source page {entry.source_page_start}
                      {entry.source_page_end &&
                      entry.source_page_end !== entry.source_page_start
                        ? `–${entry.source_page_end}`
                        : ""}
                    </span>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
