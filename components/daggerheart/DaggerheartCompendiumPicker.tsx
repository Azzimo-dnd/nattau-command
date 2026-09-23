"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  compendiumEffectiveMetadata,
  compendiumHasErrata,
  type DaggerheartCompendiumCategory,
  type DaggerheartCompendiumEntry,
} from "@/lib/daggerheart/compendium";
import {
  DaggerheartCategoryIcon,
  DaggerheartDomainIcon,
} from "@/components/daggerheart/DaggerheartCompendiumIcons";

type Props = {
  categories: DaggerheartCompendiumCategory[];
  label: string;
  domains?: string[];
  maxLevel?: number;
  maxTier?: number;
  allowMagicWeapons?: boolean;
  onSelect: (entry: DaggerheartCompendiumEntry) => void;
};

const fieldClass =
  "min-h-10 w-full rounded-xl border border-[#4c2d38] bg-[#0d080b] px-3 text-sm text-[#dbcbd0] outline-none transition focus:border-[#9a4d61]";

export function DaggerheartCompendiumPicker({
  categories,
  label,
  domains,
  maxLevel,
  maxTier,
  allowMagicWeapons = true,
  onSelect,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<DaggerheartCompendiumEntry[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      let request = supabase
        .from("daggerheart_compendium_entries")
        .select("id,source_key,category,slug,name,parent_slug,domain,level,tier,summary,rules_text,metadata,effects,actions,errata,source_page_start,source_page_end,sort_order")
        .eq("is_active", true)
        .in("category", categories)
        .order("tier", { ascending: true, nullsFirst: true })
        .order("level", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .limit(500);

      if (domains?.length) request = request.in("domain", domains);
      if (maxLevel) request = request.lte("level", maxLevel);
      if (maxTier) request = request.lte("tier", maxTier);

      const result = await request;
      if (!cancelled) {
        const loaded = (result.data ?? []) as DaggerheartCompendiumEntry[];
        setEntries(
          allowMagicWeapons
            ? loaded
            : loaded.filter(
                (entry) =>
                  !["weapon_primary", "weapon_secondary"].includes(entry.category) ||
                  compendiumEffectiveMetadata(entry).weapon_kind !== "magic"
              )
        );
        setSelectedId("");
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [allowMagicWeapons, categories.join("|"), domains?.join("|"), maxLevel, maxTier, supabase]);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  return (
    <div className="rounded-xl border border-[#39232c] bg-black/15 p-3">
      <div className="flex flex-col gap-2 lg:flex-row">
        <select
          className={fieldClass}
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={loading}
        >
          <option value="">{loading ? "Loading compendium…" : label}</option>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
              {entry.domain ? ` · ${entry.domain}` : ""}
              {entry.level ? ` · Lv ${entry.level}` : ""}
              {entry.tier ? ` · Tier ${entry.tier}` : ""}
              {entry.source_key === "hope-fear" ? " · H&F" : ""}
              {compendiumHasErrata(entry) ? " · ERRATA" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            onSelect(selected);
            setSelectedId("");
          }}
          className="min-h-10 shrink-0 rounded-xl border border-[#774052] bg-[#35141f] px-4 text-sm font-bold text-[#e8cbd3] transition hover:bg-[#48202c] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add from compendium
        </button>
      </div>

      {selected && (
        <div className="mt-3 rounded-lg border border-[#302027] bg-black/20 p-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg border border-[#432a34] bg-[#1b0e14] p-2 text-[#c78b9d]">
              <DaggerheartCategoryIcon category={selected.category} className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b6978]">
                <span>{selected.source_key === "hope-fear" ? "Hope & Fear" : "Core"}</span>
                {selected.domain && (
                  <span className="inline-flex items-center gap-1">
                    · <DaggerheartDomainIcon domain={selected.domain} className="size-3.5" />
                    {selected.domain}
                  </span>
                )}
                {selected.level && <span>· Level {selected.level}</span>}
                {selected.tier && <span>· Tier {selected.tier}</span>}
                {compendiumHasErrata(selected) && (
                  <span className="rounded-full border border-amber-800/50 bg-amber-950/35 px-2 py-0.5 text-amber-200">
                    Official errata
                  </span>
                )}
              </div>

              {selected.rules_text && (
                <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs leading-5 text-[#a9959c]">
                  {selected.rules_text}
                </p>
              )}

              {compendiumHasErrata(selected) && (
                <div className="mt-3 rounded-lg border border-amber-900/35 bg-amber-950/15 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/80">
                    Current official rule
                  </p>
                  {selected.errata.summary && (
                    <p className="mt-1 text-xs leading-5 text-amber-100/85">
                      {selected.errata.summary}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function metadataDetails(metadata: Record<string, unknown>) {
  const bits: string[] = [];
  for (const key of ["trait", "range", "damage", "burden", "base_major", "base_severe", "base_score"]) {
    const value = metadata[key];
    if (value !== null && value !== undefined && value !== "") {
      bits.push(`${key.replaceAll("_", " ")}: ${String(value)}`);
    }
  }
  return bits;
}

export function compendiumEntryDetails(entry: DaggerheartCompendiumEntry) {
  const originalBits = metadataDetails(entry.metadata ?? {});
  if (entry.rules_text && entry.rules_text !== "—") originalBits.push(entry.rules_text);

  if (!compendiumHasErrata(entry)) return originalBits.join(" · ");

  const currentMetadata = compendiumEffectiveMetadata(entry);
  const currentBits = metadataDetails(currentMetadata);
  if (entry.errata.rules_text) currentBits.push(entry.errata.rules_text);

  const revision = entry.errata.revision ? ` (${entry.errata.revision})` : "";
  return [
    `Original source: ${originalBits.join(" · ") || "See source entry."}`,
    `Official errata/current${revision}: ${[
      entry.errata.summary,
      ...currentBits,
    ].filter(Boolean).join(" · ")}`,
  ].join("\n\n");
}
