"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AtlasMap } from "./AtlasMap";
import styles from "./Atlas.module.css";
import {
  atlasCategories,
  atlasVisibilityOptions,
  categoryLabel,
  categoryMark,
  createDraft,
  visibilityLabel,
  type AtlasFilter,
  type AtlasLocation,
  type AtlasLocationDraft,
  type AtlasRole,
  type AtlasVisibility,
} from "./atlasTypes";

type AtlasOfTheMistsProps = {
  campaignId: string;
  currentUserId: string;
  role: AtlasRole;
};

type PlacementMode = "add" | "move" | null;

const locationSelect =
  "id,campaign_id,slug,name,rumor_name,category,visibility_status,x_percent,y_percent,player_summary,rumor_summary,gm_notes,icon_key,sort_order,is_active,created_by,updated_by,created_at,updated_at";

function friendlyError(message: string) {
  if (
    message.includes("campaign_map_locations") ||
    message.includes("schema cache")
  ) {
    return "Atlas data is not installed yet. Run supabase/barovia-atlas-of-the-mists.sql in Supabase SQL Editor.";
  }
  return message;
}

function publicName(location: AtlasLocation) {
  if (location.visibility_status === "rumored") {
    return location.rumor_name?.trim() || "Whisper in the Mists";
  }
  return location.name;
}

function publicSummary(location: AtlasLocation) {
  if (location.visibility_status === "rumored") {
    return (
      location.rumor_summary.trim() ||
      "Only fragments of rumor have reached the party. The Mists keep the rest."
    );
  }
  return (
    location.player_summary.trim() ||
    "This place is known, but its story has not yet been written in the Atlas."
  );
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function StatusBadge({ status }: { status: AtlasVisibility }) {
  const classes: Record<AtlasVisibility, string> = {
    hidden: "border-slate-500/30 bg-slate-500/10 text-slate-300",
    rumored: "border-purple-400/25 bg-purple-500/10 text-purple-200",
    discovered: "border-amber-300/25 bg-amber-400/10 text-amber-100",
    visited: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${classes[status]}`}
    >
      {visibilityLabel(status)}
    </span>
  );
}

function EmptyPanel({ isDm }: { isDm: boolean }) {
  return (
    <div className="rounded-3xl border border-[#462731] bg-[#120c10]/88 p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#633446] bg-[#35151f]/45 font-serif text-2xl text-[#d6a3b1]">
        ◆
      </div>
      <h2 className="mt-5 font-serif text-2xl font-black text-[#e6d6cd]">
        Choose a mark in the fog
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#998a90]">
        Select a location on the map or from the index to open its entry.
        {isDm
          ? " Hidden marks remain visible to you until you reveal them to the party."
          : " Only places permitted by the Game Master appear in your Atlas."}
      </p>
    </div>
  );
}

function LocationDetails({
  location,
  isDm,
  previewAsPlayer,
  onLocate,
  onEdit,
}: {
  location: AtlasLocation;
  isDm: boolean;
  previewAsPlayer: boolean;
  onLocate: () => void;
  onEdit: () => void;
}) {
  const gmView = isDm && !previewAsPlayer;
  const shownName = gmView ? location.name : publicName(location);
  const shownSummary = gmView
    ? location.player_summary.trim() || location.rumor_summary.trim()
    : publicSummary(location);

  return (
    <article className="overflow-hidden rounded-3xl border border-[#56303b] bg-[#120c10]/92 shadow-2xl shadow-black/20">
      <div className="relative overflow-hidden border-b border-[#43252f] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_10%,rgba(111,35,57,0.34),transparent_40%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#9f6574]">
              <span className="font-serif text-lg text-[#d0a4af]">
                {categoryMark(location.category)}
              </span>
              {categoryLabel(location.category)}
            </span>
            <StatusBadge status={location.visibility_status} />
          </div>

          <h2 className="mt-4 font-serif text-3xl font-black text-[#eadbd2]">
            {shownName}
          </h2>

          {gmView && location.visibility_status === "rumored" && (
            <p className="mt-2 text-xs text-[#9e8790]">
              Players see: {publicName(location)}
            </p>
          )}

          <p className="mt-4 text-sm leading-7 text-[#b1a4a8]">
            {shownSummary || "No public description has been written yet."}
          </p>
        </div>
      </div>

      {gmView && (
        <div className="border-b border-[#43252f] bg-black/15 p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#9f5367]">
            Secrets kept by the Mists
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#95888d]">
            {location.gm_notes.trim() || "No private Game Master notes."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 p-4 sm:p-5">
        <button
          type="button"
          onClick={onLocate}
          className="min-h-11 flex-1 rounded-xl border border-[#57303d] bg-black/20 px-4 text-sm font-bold text-[#c7adb5] transition hover:border-[#8b465b] hover:text-[#efd4dc]"
        >
          Center on map
        </button>
        {gmView && (
          <button
            type="button"
            onClick={onEdit}
            className="min-h-11 flex-1 rounded-xl border border-[#8b465b] bg-[#5a1825]/32 px-4 text-sm font-bold text-[#e5bdc7] transition hover:bg-[#6c2034]/55"
          >
            Edit location
          </button>
        )}
      </div>
    </article>
  );
}

function LocationEditor({
  draft,
  isNew,
  busy,
  onDraftChange,
  onSave,
  onCancel,
  onMove,
  onDelete,
}: {
  draft: AtlasLocationDraft;
  isNew: boolean;
  busy: boolean;
  onDraftChange: (next: AtlasLocationDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="rounded-3xl border border-[#633446] bg-[#120c10]/94 p-5 shadow-2xl shadow-black/30 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#a85a70]">
            Game Master cartography
          </p>
          <h2 className="mt-2 font-serif text-2xl font-black text-[#eadbd2]">
            {isNew ? "Create a location" : "Edit location"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 rounded-xl border border-[#4e2b36] bg-black/20 px-3 text-sm text-[#a9949b]"
        >
          Close
        </button>
      </div>

      <div className={`mt-6 ${styles.editorGrid}`}>
        <label>
          <span className={styles.fieldLabel}>True location name</span>
          <input
            className={styles.textField}
            value={draft.name}
            onChange={(event) =>
              onDraftChange({ ...draft, name: event.target.value })
            }
          />
        </label>

        <label>
          <span className={styles.fieldLabel}>Rumored name</span>
          <input
            className={styles.textField}
            value={draft.rumor_name}
            placeholder="Whisper in the Mists"
            onChange={(event) =>
              onDraftChange({ ...draft, rumor_name: event.target.value })
            }
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={styles.fieldLabel}>Category</span>
            <select
              className={styles.selectField}
              value={draft.category}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  category: event.target.value as AtlasLocationDraft["category"],
                })
              }
            >
              {atlasCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.mark} {category.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={styles.fieldLabel}>Sort order</span>
            <input
              type="number"
              className={styles.textField}
              value={draft.sort_order}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  sort_order: numberValue(event.target.value, draft.sort_order),
                })
              }
            />
          </label>
        </div>

        <div>
          <span className={styles.fieldLabel}>Player visibility</span>
          <div className={styles.statusGrid}>
            {atlasVisibilityOptions.map((status) => (
              <button
                key={status.value}
                type="button"
                className={styles.statusButton}
                data-active={draft.visibility_status === status.value}
                title={status.description}
                onClick={() =>
                  onDraftChange({
                    ...draft,
                    visibility_status: status.value,
                  })
                }
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        <label>
          <span className={styles.fieldLabel}>Rumor shown to players</span>
          <textarea
            className={styles.textArea}
            value={draft.rumor_summary}
            placeholder="A half-heard story, an uncertain landmark, a warning without proof..."
            onChange={(event) =>
              onDraftChange({ ...draft, rumor_summary: event.target.value })
            }
          />
        </label>

        <label>
          <span className={styles.fieldLabel}>Public description</span>
          <textarea
            className={styles.textArea}
            value={draft.player_summary}
            placeholder="What the party may know after discovering this place."
            onChange={(event) =>
              onDraftChange({ ...draft, player_summary: event.target.value })
            }
          />
        </label>

        <label>
          <span className={styles.fieldLabel}>Private GM notes</span>
          <textarea
            className={styles.textArea}
            value={draft.gm_notes}
            placeholder="Secrets, encounters and consequences visible only to the Game Master."
            onChange={(event) =>
              onDraftChange({ ...draft, gm_notes: event.target.value })
            }
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="rounded-2xl border border-[#432631] bg-black/18 p-3 text-xs text-[#97878d]">
            Position: {draft.x_percent.toFixed(2)}% · {draft.y_percent.toFixed(2)}%
          </div>
          <button
            type="button"
            onClick={onMove}
            className="min-h-11 rounded-xl border border-[#59313e] bg-black/20 px-4 text-sm font-bold text-[#c2a8b0]"
          >
            Move on map
          </button>
        </div>

        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#432631] bg-black/18 px-3 text-sm text-[#ad9ba1]">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(event) =>
              onDraftChange({ ...draft, is_active: event.target.checked })
            }
          />
          Location is active in the Atlas
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !draft.name.trim()}
          onClick={onSave}
          className="min-h-12 flex-1 rounded-xl border border-[#9c4e65] bg-[#641d33]/60 px-5 text-sm font-black text-[#f0d2da] transition hover:bg-[#7a2740]/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving through the fog..." : isNew ? "Create marker" : "Save changes"}
        </button>
        {!isNew && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="min-h-12 rounded-xl border border-red-500/30 bg-red-950/20 px-5 text-sm font-bold text-red-200 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </section>
  );
}

export function AtlasOfTheMists({
  campaignId,
  currentUserId,
  role,
}: AtlasOfTheMistsProps) {
  const isDm = role === "dm";
  const [locations, setLocations] = useState<AtlasLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [filter, setFilter] = useState<AtlasFilter>("all");
  const [search, setSearch] = useState("");
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState<AtlasLocationDraft>(createDraft());
  const [placementMode, setPlacementMode] = useState<PlacementMode>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadLocations = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("campaign_map_locations")
        .select(locationSelect)
        .eq("campaign_id", campaignId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (loadError) {
        setError(friendlyError(loadError.message));
      } else {
        setLocations((data ?? []) as AtlasLocation[]);
      }
      if (!quiet) setLoading(false);
    },
    [campaignId]
  );

  useEffect(() => {
    void loadLocations();

    const supabase = createClient();
    const channel = supabase
      .channel(`atlas-barovia-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_map_locations",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void loadLocations(true)
      )
      .subscribe();

    // A short safety refresh also removes a marker when a DM changes it from
    // player-visible to Hidden. Such an update can be suppressed by Realtime
    // RLS because the new row is no longer selectable by the player.
    const refreshTimer = window.setInterval(() => {
      void loadLocations(true);
    }, 20_000);

    return () => {
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [campaignId, loadLocations]);

  const gmView = isDm && !previewAsPlayer;

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  useEffect(() => {
    if (!selectedLocation || editing) return;
    setDraft(createDraft(selectedLocation));
  }, [editing, selectedLocation]);

  useEffect(() => {
    if (previewAsPlayer && selectedLocation?.visibility_status === "hidden") {
      setSelectedLocationId(null);
      setEditing(false);
    }
  }, [previewAsPlayer, selectedLocation]);

  const viewLocations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return locations.filter((location) => {
      if (!location.is_active) return gmView && filter === "hidden";
      if (!gmView && location.visibility_status === "hidden") return false;
      if (filter !== "all" && location.visibility_status !== filter) return false;

      if (!normalizedSearch) return true;
      const shownName = gmView ? location.name : publicName(location);
      return [shownName, location.name, location.rumor_name, location.player_summary]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase().includes(normalizedSearch)
        );
    });
  }, [filter, gmView, locations, search]);

  const counts = useMemo(() => {
    return locations.reduce(
      (result, location) => {
        if (location.is_active) result[location.visibility_status] += 1;
        return result;
      },
      { hidden: 0, rumored: 0, discovered: 0, visited: 0 }
    );
  }, [locations]);

  const filterOptions = useMemo<AtlasFilter[]>(
    () =>
      gmView
        ? ["all", "rumored", "discovered", "visited", "hidden"]
        : ["all", "rumored", "discovered", "visited"],
    [gmView]
  );

  function selectLocation(location: AtlasLocation, focus = false) {
    setSelectedLocationId(location.id);
    setEditing(false);
    setIsNew(false);
    setPlacementMode(null);
    setDraft(createDraft(location));
    if (focus) setFocusNonce((current) => current + 1);
  }

  function beginAddLocation() {
    setSelectedLocationId(null);
    setDraft(createDraft());
    setIsNew(true);
    setEditing(true);
    setPlacementMode("add");
    setNotice("Choose the position of the new location on the map.");
  }

  function placeLocation(xPercent: number, yPercent: number) {
    setDraft((current) => ({
      ...current,
      x_percent: xPercent,
      y_percent: yPercent,
    }));
    setPlacementMode(null);
    setNotice(
      isNew
        ? "Marker placed. Complete the entry and create it."
        : "Marker moved. Save the location to keep the new position."
    );
  }

  async function saveLocation() {
    if (!isDm || !draft.name.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    const values = {
      name: draft.name.trim(),
      rumor_name: draft.rumor_name.trim() || null,
      category: draft.category,
      visibility_status: draft.visibility_status,
      x_percent: Number(draft.x_percent.toFixed(3)),
      y_percent: Number(draft.y_percent.toFixed(3)),
      player_summary: draft.player_summary.trim(),
      rumor_summary: draft.rumor_summary.trim(),
      gm_notes: draft.gm_notes.trim(),
      icon_key: draft.icon_key.trim() || null,
      sort_order: Math.round(draft.sort_order),
      is_active: draft.is_active,
      updated_by: currentUserId,
    };

    if (isNew) {
      const slug = `custom-${Date.now().toString(36)}`;
      const { data, error: saveError } = await supabase
        .from("campaign_map_locations")
        .insert({
          ...values,
          campaign_id: campaignId,
          slug,
          created_by: currentUserId,
        })
        .select(locationSelect)
        .single();

      setBusy(false);
      if (saveError) {
        setError(friendlyError(saveError.message));
        return;
      }

      const created = data as AtlasLocation;
      setLocations((current) => [...current, created]);
      setSelectedLocationId(created.id);
      setIsNew(false);
      setEditing(false);
      setNotice("The new marker has been added to the Atlas.");
      setFocusNonce((current) => current + 1);
      return;
    }

    if (!selectedLocation) {
      setBusy(false);
      return;
    }

    const { data, error: saveError } = await supabase
      .from("campaign_map_locations")
      .update(values)
      .eq("id", selectedLocation.id)
      .eq("campaign_id", campaignId)
      .select(locationSelect)
      .single();

    setBusy(false);
    if (saveError) {
      setError(friendlyError(saveError.message));
      return;
    }

    const updated = data as AtlasLocation;
    setLocations((current) =>
      current.map((location) =>
        location.id === updated.id ? updated : location
      )
    );
    setEditing(false);
    setNotice("The Atlas entry has been updated.");
  }

  async function deleteLocation() {
    if (!isDm || !selectedLocation) return;
    if (
      !window.confirm(
        `Remove ${selectedLocation.name} from the Atlas? This cannot be undone.`
      )
    ) {
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("campaign_map_locations")
      .delete()
      .eq("id", selectedLocation.id)
      .eq("campaign_id", campaignId);
    setBusy(false);

    if (deleteError) {
      setError(friendlyError(deleteError.message));
      return;
    }

    setLocations((current) =>
      current.filter((location) => location.id !== selectedLocation.id)
    );
    setSelectedLocationId(null);
    setEditing(false);
    setNotice("The marker has vanished into the Mists.");
  }

  const mapLocations = viewLocations;

  return (
    <section>
      {error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/35 bg-red-950/35 px-4 py-3 text-sm text-red-100">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-bold text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7c4556] bg-[#35151f]/55 px-4 py-3 text-sm text-[#e0bdc6]">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-bold text-[#e7c8d0]"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#432730] bg-[#120c10]/84 p-3">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`min-h-10 rounded-xl border px-3 text-xs font-bold transition ${
                  filter === value
                    ? "border-[#9b5369] bg-[#5b1b30]/55 text-[#f0d5dd]"
                    : "border-[#452831] bg-black/15 text-[#9d8b91] hover:border-[#744052]"
                }`}
              >
                {value === "all" ? "All marks" : visibilityLabel(value)}
                {value !== "all" && gmView
                  ? ` · ${counts[value as AtlasVisibility]}`
                  : ""}
              </button>
            ))}
        </div>

        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the Atlas..."
            className="min-h-10 min-w-0 flex-1 rounded-xl border border-[#452831] bg-black/20 px-3 text-sm text-[#e5d6dc] outline-none placeholder:text-[#72646a] focus:border-[#8b465b] sm:max-w-xs"
          />

          {isDm && (
            <>
              <button
                type="button"
                onClick={() => setPreviewAsPlayer((current) => !current)}
                className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${
                  previewAsPlayer
                    ? "border-[#b07b63] bg-[#5b3726]/50 text-[#f0d7c4]"
                    : "border-[#4d2c37] bg-black/20 text-[#b19ca3]"
                }`}
              >
                {previewAsPlayer ? "Player preview on" : "Preview as player"}
              </button>
              {!previewAsPlayer && (
                <button
                  type="button"
                  onClick={beginAddLocation}
                  className="min-h-10 rounded-xl border border-[#9b5369] bg-[#5b1b30]/55 px-4 text-xs font-black text-[#efd0d9]"
                >
                  + Add marker
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-[#432730] bg-[#100b0e]/85 text-sm text-[#9d8b91]">
          The Atlas is emerging from the fog...
        </div>
      ) : (
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <div>
            <AtlasMap
              locations={mapLocations}
              selectedLocationId={selectedLocationId}
              role={role}
              previewAsPlayer={previewAsPlayer}
              placementMode={placementMode}
              focusLocation={selectedLocation}
              focusNonce={focusNonce}
              onSelectLocation={(location) => selectLocation(location)}
              onPlaceLocation={placeLocation}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[#76676c]">
              <span>
                Showing {mapLocations.length} of {locations.length} Atlas marks
              </span>
              <span>Map artwork by DM Andy · marker layer by Campaign Companion</span>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-[#462731] bg-[#120c10]/88 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#965469]">
                    Location index
                  </p>
                  <p className="mt-1 text-sm text-[#9d8b91]">
                    {viewLocations.length} marks in view
                  </p>
                </div>
                <span className="rounded-full border border-[#4c2b36] bg-black/20 px-2.5 py-1 text-[10px] text-[#8f7c83]">
                  {gmView ? "GM Atlas" : "Party Atlas"}
                </span>
              </div>

              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {viewLocations.length === 0 ? (
                  <p className="rounded-2xl border border-[#3d242d] bg-black/15 p-4 text-sm text-[#83757a]">
                    No marks match the current filters.
                  </p>
                ) : (
                  viewLocations.map((location) => {
                    const shownName = gmView ? location.name : publicName(location);
                    const selected = location.id === selectedLocationId;
                    return (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() => selectLocation(location, true)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                          selected
                            ? "border-[#915066] bg-[#522033]/45"
                            : "border-[#3d242d] bg-black/15 hover:border-[#694051]"
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#57313d] bg-[#2c151d]/70 font-serif text-lg text-[#d4aab5]">
                          {location.visibility_status === "rumored" && !gmView
                            ? "?"
                            : categoryMark(location.category)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-[#dfcfd5]">
                            {shownName}
                          </span>
                          <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.15em] text-[#806d74]">
                            {categoryLabel(location.category)} · {visibilityLabel(location.visibility_status)}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            {editing && isDm && !previewAsPlayer ? (
              <LocationEditor
                draft={draft}
                isNew={isNew}
                busy={busy}
                onDraftChange={setDraft}
                onSave={() => void saveLocation()}
                onCancel={() => {
                  setEditing(false);
                  setPlacementMode(null);
                  setIsNew(false);
                  if (selectedLocation) setDraft(createDraft(selectedLocation));
                }}
                onMove={() => {
                  setPlacementMode("move");
                  setNotice("Choose a new point on the map for this marker.");
                }}
                onDelete={() => void deleteLocation()}
              />
            ) : selectedLocation ? (
              <LocationDetails
                location={selectedLocation}
                isDm={isDm}
                previewAsPlayer={previewAsPlayer}
                onLocate={() => setFocusNonce((current) => current + 1)}
                onEdit={() => {
                  setDraft(createDraft(selectedLocation));
                  setIsNew(false);
                  setEditing(true);
                }}
              />
            ) : (
              <EmptyPanel isDm={gmView} />
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
