"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  compendiumCategoryLabel,
  compendiumHasErrata,
  compendiumSourceLabel,
  daggerheartCompendiumCategories,
  metadataLabels,
  type DaggerheartCompendiumCategory,
  type DaggerheartCompendiumEntry,
} from "@/lib/daggerheart/compendium";
import { daggerheartDomains } from "@/lib/daggerheart/catalog";
import {
  DaggerheartCategoryIcon,
  DaggerheartDomainIcon,
} from "@/components/daggerheart/DaggerheartCompendiumIcons";

type SourceFilter = "all" | "core" | "hope-fear";

const fieldClass =
  "min-h-11 rounded-xl border border-[#56323f] bg-[#100a0e] px-3 py-2 text-sm text-[#eadfe3] outline-none transition focus:border-[#a34d64] focus:ring-2 focus:ring-[#6e263b]/30";

function metadataValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function trustedErrataUrl(value: unknown) {
  if (typeof value !== "string") return null;
  return value.startsWith("https://www.daggerheart.com/") ? value : null;
}

function ErrataPanel({ entry }: { entry: DaggerheartCompendiumEntry }) {
  if (!compendiumHasErrata(entry)) return null;

  const updatedMetadata = Object.entries(entry.errata.metadata ?? {})
    .map(([key, value]) => [key, metadataValue(value)] as const)
    .filter(([, value]) => value !== null);
  const sourceUrl = trustedErrataUrl(entry.errata.source_url);

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-amber-800/35 bg-gradient-to-br from-amber-950/20 via-[#17100c] to-[#100a0e]">
      <div className="border-b border-amber-900/30 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-amber-700/45 bg-amber-950/45 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
              Official errata
            </span>
            {entry.errata.kind && (
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/55">
                {entry.errata.kind}
              </span>
            )}
          </div>
          <div className="text-right text-[10px] uppercase tracking-[0.12em] text-amber-100/45">
            {entry.errata.revision && <span>{entry.errata.revision}</span>}
            {entry.errata.published_at && <span> · {entry.errata.published_at}</span>}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {entry.errata.summary && (
          <p className="text-sm font-semibold leading-6 text-amber-100/90">
            {entry.errata.summary}
          </p>
        )}

        {updatedMetadata.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/65">
              Updated fields
            </p>
            <div className="flex flex-wrap gap-2">
              {updatedMetadata.map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-lg border border-amber-900/35 bg-black/20 px-2.5 py-1.5 text-xs text-amber-100/75"
                >
                  <b className="text-amber-100/95">
                    {metadataLabels[key] ?? key.replaceAll("_", " ")}:
                  </b>{" "}
                  {value}
                </span>
              ))}
            </div>
          </div>
        )}

        {entry.errata.rules_text && (
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/65">
              Current official wording
            </p>
            <div className="whitespace-pre-wrap text-sm leading-7 text-amber-50/80">
              {entry.errata.rules_text}
            </div>
          </div>
        )}

        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center rounded-lg border border-amber-800/35 bg-black/20 px-3 text-xs font-bold text-amber-200/80 transition hover:border-amber-600/55 hover:text-amber-100"
          >
            Open official source ↗
          </a>
        )}
      </div>
    </section>
  );
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
    let cancelled = false;
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

      if (cancelled) return;
      if (searchError) {
        setError(searchError.message);
        setEntries([]);
      } else {
        setEntries((data ?? []) as DaggerheartCompendiumEntry[]);
      }
      setLoading(false);
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
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
            placeholder="Search names, original rules or errata…"
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
          <div className="flex items-center gap-3">
            <span className="rounded-xl border border-[#482b36] bg-black/20 p-2 text-[#bc788c]">
              <DaggerheartCategoryIcon category={category} className="size-5" />
            </span>
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
          const hasErrata = compendiumHasErrata(entry);

          return (
            <details
              key={entry.id}
              className="group self-start rounded-2xl border border-[#402731] bg-[#100a0e]/88 shadow-lg shadow-black/10 open:border-[#744050]"
            >
              <summary className="cursor-pointer list-none p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 rounded-xl border border-[#412832] bg-black/25 p-2 text-[#bd7d90]">
                      {entry.domain ? (
                        <DaggerheartDomainIcon domain={entry.domain} className="size-6" />
                      ) : (
                        <DaggerheartCategoryIcon category={entry.category} className="size-6" />
                      )}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#684052] bg-[#32151f] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d29dac]">
                          {compendiumSourceLabel(entry.source_key)}
                        </span>
                        {entry.domain && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#49303a] bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aa9099]">
                            <DaggerheartDomainIcon domain={entry.domain} className="size-3.5" />
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
                        {(entry.effects?.length ?? 0) > 0 && (
                          <span className="rounded-full border border-emerald-900/50 bg-emerald-950/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/90">
                            Sheet automation
                          </span>
                        )}
                        {(entry.actions?.length ?? 0) > 0 && (
                          <span className="rounded-full border border-sky-900/50 bg-sky-950/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-200/90">
                            Quick action
                          </span>
                        )}
                        {hasErrata && (
                          <span className="rounded-full border border-amber-800/50 bg-amber-950/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
                            Errata
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
                <section>
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#806b72]">
                    Original book entry
                  </p>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-[#d2c2c7]">
                    {entry.rules_text}
                  </div>
                </section>

                {(entry.effects?.length ?? 0) > 0 && (
                  <section className="mt-5 rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300/65">
                      Character sheet automation
                    </p>
                    <div className="mt-3 space-y-2">
                      {entry.effects.map((effect) => (
                        <div
                          key={effect.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-emerald-100/85">
                              {effect.label}
                            </span>
                            <span className="ml-2 text-emerald-100/45">
                              {effect.mode === "toggle" ? "situational" : "automatic"} · {effect.scope}
                            </span>
                          </div>
                          <span className="rounded-md border border-emerald-900/30 bg-black/20 px-2 py-1 font-mono text-emerald-100/75">
                            {effect.stat.replaceAll("_", " ")}
                            {typeof effect.value === "number"
                              ? ` ${effect.value >= 0 ? "+" : ""}${effect.value}`
                              : effect.value_from
                                ? ` ← ${effect.value_from.replaceAll("_", " ")}`
                                : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {(entry.actions?.length ?? 0) > 0 && (
                  <section className="mt-5 rounded-xl border border-sky-900/30 bg-sky-950/10 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300/65">
                      Character sheet actions
                    </p>
                    <div className="mt-3 space-y-2">
                      {entry.actions.map((action) => (
                        <div
                          key={action.id}
                          className="rounded-lg border border-sky-950/50 bg-black/15 p-3 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-sky-100/85">
                              {action.label}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.12em] text-sky-100/45">
                              {action.scope}
                              {action.limit
                                ? ` · ${action.limit.uses}/${action.limit.reset.replaceAll("_", " ")}`
                                : ""}
                            </span>
                          </div>
                          {action.description && (
                            <p className="mt-2 leading-5 text-sky-100/55">
                              {action.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <ErrataPanel entry={entry} />

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
                  {hasErrata && <span>Original preserved · errata layered</span>}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
