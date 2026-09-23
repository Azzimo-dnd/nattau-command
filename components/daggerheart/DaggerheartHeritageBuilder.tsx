"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AncestryEntry = {
  id: string;
  name: string;
  slug: string;
  source_key: "core" | "hope-fear";
  rules_text: string;
};

export type HeritageFeature = {
  ancestry: string;
  name: string;
};

export type HeritageState = {
  mixed?: boolean;
  display_name?: string;
  ancestry_one?: string;
  ancestry_two?: string;
  feature_one?: HeritageFeature | null;
  feature_two?: HeritageFeature | null;
};

type Props = {
  ancestryKey: string | null;
  value: HeritageState;
  onChange: (ancestryKey: string | null, state: HeritageState) => void;
};

const fieldClass =
  "min-h-11 w-full rounded-xl border border-[#58323f] bg-[#100a0e] px-3 py-2 text-sm text-[#eadfe3] outline-none transition focus:border-[#a34d64] focus:ring-2 focus:ring-[#6e263b]/30";

function featureNames(rulesText: string) {
  const markerMatch = rulesText.match(/ANCESTRY FEATURES?/i);
  if (!markerMatch || markerMatch.index === undefined) return [];
  const section = rulesText.slice(markerMatch.index + markerMatch[0].length);
  const matches = [...section.matchAll(/^([A-Z][A-Za-zÀ-ž0-9’'& -]{1,64}):/gm)];
  return matches.slice(0, 2).map((match) => match[1].trim());
}

function defaultDisplayName(first: string, second: string) {
  if (!first || !second) return "";
  return `${first}-${second}`;
}

export function DaggerheartHeritageBuilder({
  ancestryKey,
  value,
  onChange,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<AncestryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await supabase
        .from("daggerheart_compendium_entries")
        .select("id,name,slug,source_key,rules_text")
        .eq("category", "ancestry")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (!cancelled) {
        setEntries((result.data ?? []) as AncestryEntry[]);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const mixed = Boolean(value.mixed);
  const first = value.ancestry_one ?? (mixed ? "" : ancestryKey ?? "");
  const second = value.ancestry_two ?? "";
  const firstEntry = entries.find((entry) => entry.name === first) ?? null;
  const secondEntry = entries.find((entry) => entry.name === second) ?? null;
  const firstFeatures = firstEntry ? featureNames(firstEntry.rules_text) : [];
  const secondFeatures = secondEntry ? featureNames(secondEntry.rules_text) : [];

  function setMixed(nextMixed: boolean) {
    if (nextMixed) {
      const ancestryOne = ancestryKey ?? first ?? "";
      onChange(
        ancestryOne || null,
        {
          mixed: true,
          ancestry_one: ancestryOne,
          ancestry_two: "",
          display_name: "",
          feature_one: null,
          feature_two: null,
        }
      );
      return;
    }

    const single = first || ancestryKey || "";
    onChange(single || null, {
      mixed: false,
      ancestry_one: single,
      ancestry_two: "",
      display_name: single,
      feature_one: null,
      feature_two: null,
    });
  }

  function updateMixed(patch: Partial<HeritageState>) {
    const next: HeritageState = { ...value, mixed: true, ...patch };
    const ancestryOne = next.ancestry_one ?? "";
    const ancestryTwo = next.ancestry_two ?? "";
    const generated = defaultDisplayName(ancestryOne, ancestryTwo);
    const currentDisplay = (next.display_name ?? "").trim();
    const previousGenerated = defaultDisplayName(first, second);
    if (!currentDisplay || currentDisplay === previousGenerated) {
      next.display_name = generated;
    }
    onChange((next.display_name || generated || ancestryOne || null) as string | null, next);
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-[#402731] bg-black/20 p-1">
        <button
          type="button"
          onClick={() => setMixed(false)}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
            !mixed ? "bg-[#5d2032] text-[#f0dce2]" : "text-[#967f87] hover:text-[#d7c1c7]"
          }`}
        >
          Single ancestry
        </button>
        <button
          type="button"
          onClick={() => setMixed(true)}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
            mixed ? "bg-[#5d2032] text-[#f0dce2]" : "text-[#967f87] hover:text-[#d7c1c7]"
          }`}
        >
          Mixed ancestry
        </button>
      </div>

      {!mixed ? (
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#a48d95]">Ancestry</span>
          <select
            className={fieldClass}
            disabled={loading}
            value={ancestryKey ?? ""}
            onChange={(event) => {
              const name = event.target.value;
              onChange(name || null, {
                mixed: false,
                ancestry_one: name,
                ancestry_two: "",
                display_name: name,
                feature_one: null,
                feature_two: null,
              });
            }}
          >
            <option value="">{loading ? "Loading ancestries…" : "Choose ancestry"}</option>
            <optgroup label="Core Rulebook">
              {entries.filter((entry) => entry.source_key === "core").map((entry) => (
                <option key={entry.id} value={entry.name}>{entry.name}</option>
              ))}
            </optgroup>
            <optgroup label="Hope & Fear">
              {entries.filter((entry) => entry.source_key === "hope-fear").map((entry) => (
                <option key={entry.id} value={entry.name}>{entry.name}</option>
              ))}
            </optgroup>
          </select>
        </label>
      ) : (
        <div className="space-y-4 rounded-2xl border border-[#3d2830] bg-black/15 p-4">
          <p className="text-xs leading-5 text-[#97838a]">
            Choose two different ancestries, then one feature from each lineage. The display name can be anything that fits the character.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs text-[#a48d95]">First lineage</span>
                <select
                  className={fieldClass}
                  value={first}
                  onChange={(event) =>
                    updateMixed({
                      ancestry_one: event.target.value,
                      feature_one: null,
                    })
                  }
                >
                  <option value="">Choose ancestry</option>
                  {entries.filter((entry) => entry.name !== second).map((entry) => (
                    <option key={entry.id} value={entry.name}>
                      {entry.name}{entry.source_key === "hope-fear" ? " · H&F" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-[#a48d95]">Feature from {first || "first lineage"}</span>
                <select
                  className={fieldClass}
                  disabled={!first}
                  value={value.feature_one?.name ?? ""}
                  onChange={(event) =>
                    updateMixed({
                      feature_one: event.target.value
                        ? { ancestry: first, name: event.target.value }
                        : null,
                    })
                  }
                >
                  <option value="">Choose one feature</option>
                  {firstFeatures.map((feature) => <option key={feature} value={feature}>{feature}</option>)}
                </select>
              </label>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs text-[#a48d95]">Second lineage</span>
                <select
                  className={fieldClass}
                  value={second}
                  onChange={(event) =>
                    updateMixed({
                      ancestry_two: event.target.value,
                      feature_two: null,
                    })
                  }
                >
                  <option value="">Choose ancestry</option>
                  {entries.filter((entry) => entry.name !== first).map((entry) => (
                    <option key={entry.id} value={entry.name}>
                      {entry.name}{entry.source_key === "hope-fear" ? " · H&F" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-[#a48d95]">Feature from {second || "second lineage"}</span>
                <select
                  className={fieldClass}
                  disabled={!second}
                  value={value.feature_two?.name ?? ""}
                  onChange={(event) =>
                    updateMixed({
                      feature_two: event.target.value
                        ? { ancestry: second, name: event.target.value }
                        : null,
                    })
                  }
                >
                  <option value="">Choose one feature</option>
                  {secondFeatures.map((feature) => <option key={feature} value={feature}>{feature}</option>)}
                </select>
              </label>
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs text-[#a48d95]">Heritage ancestry name</span>
            <input
              className={fieldClass}
              placeholder={defaultDisplayName(first, second) || "e.g. Toothling"}
              value={value.display_name ?? ""}
              onChange={(event) => {
                const displayName = event.target.value;
                onChange(displayName || defaultDisplayName(first, second) || null, {
                  ...value,
                  mixed: true,
                  display_name: displayName,
                });
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
