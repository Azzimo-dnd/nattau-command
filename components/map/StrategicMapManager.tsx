"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  FactionId,
  Province,
  ProvinceStatus,
  ThreatLevel,
} from "./provinceData";
import type {
  StrategicFaction,
  StrategicFactionId,
  StrategicMapState,
} from "@/lib/strategic-map/types";

const MAX_MAP_BYTES = 15 * 1024 * 1024;
const MAP_MIME_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);

type ProvinceDraft = {
  name: string;
  status: ProvinceStatus;
  threatLevel: ThreatLevel;
  description: string;
};

type FactionDraft = {
  name: string;
  shortName: string;
  status: string;
  armyCount: number;
  description: string;
  relationsText: string;
};

function provinceDraftFrom(province: Province): ProvinceDraft {
  return {
    name: province.name,
    status: province.status,
    threatLevel: province.threatLevel,
    description: province.description,
  };
}

function factionDraftFrom(faction: StrategicFaction): FactionDraft {
  return {
    name: faction.name,
    shortName: faction.shortName,
    status: faction.status,
    armyCount: faction.armyCount,
    description: faction.description,
    relationsText: faction.relations.join("\n"),
  };
}

function cleanRelations(value: string) {
  return Array.from(
    new Set(
      value
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

export function StrategicMapManager({
  campaignId,
  initialState,
}: {
  campaignId: string;
  initialState: StrategicMapState;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [mapUrl, setMapUrl] = useState(initialState.mapUrl);
  const [mapStoragePath, setMapStoragePath] = useState(
    initialState.mapStoragePath
  );
  const [mapOriginalName, setMapOriginalName] = useState(
    initialState.mapOriginalName
  );
  const [mapFile, setMapFile] = useState<File | null>(null);

  const [provinces, setProvinces] = useState(initialState.provinces);
  const [provinceControl, setProvinceControl] = useState(
    initialState.provinceControl
  );
  const [selectedProvinceNumber, setSelectedProvinceNumber] = useState(
    initialState.provinces[0]?.number ?? 1
  );
  const firstProvince = initialState.provinces[0];
  const [provinceDraft, setProvinceDraft] = useState<ProvinceDraft>(
    firstProvince
      ? provinceDraftFrom(firstProvince)
      : {
          name: "",
          status: "neutral",
          threatLevel: "low",
          description: "",
        }
  );
  const [controlDraft, setControlDraft] = useState<StrategicFactionId[]>(
    ((initialState.provinceControl[firstProvince?.number ?? 1] ?? []).filter(
      (id) => id !== "unknown"
    ) as StrategicFactionId[])
  );

  const [factions, setFactions] = useState(initialState.factions);
  const [selectedFactionId, setSelectedFactionId] =
    useState<StrategicFactionId>(initialState.factions[0]?.id ?? "kainites");
  const firstFaction = initialState.factions[0];
  const [factionDraft, setFactionDraft] = useState<FactionDraft>(
    firstFaction
      ? factionDraftFrom(firstFaction)
      : {
          name: "",
          shortName: "",
          status: "",
          armyCount: 0,
          description: "",
          relationsText: "",
        }
  );

  const [busy, setBusy] = useState<"map" | "province" | "faction" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const field =
    "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/15";
  const button =
    "min-h-10 rounded-xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function selectProvince(provinceNumber: number) {
    const province = provinces.find(
      (candidate) => candidate.number === provinceNumber
    );
    if (!province) return;

    setSelectedProvinceNumber(provinceNumber);
    setProvinceDraft(provinceDraftFrom(province));
    setControlDraft(
      ((provinceControl[provinceNumber] ?? []).filter(
        (id) => id !== "unknown"
      ) as StrategicFactionId[])
    );
    clearFeedback();
  }

  function selectFaction(factionId: StrategicFactionId) {
    const faction = factions.find((candidate) => candidate.id === factionId);
    if (!faction) return;

    setSelectedFactionId(factionId);
    setFactionDraft(factionDraftFrom(faction));
    clearFeedback();
  }

  function toggleFactionControl(factionId: StrategicFactionId) {
    setControlDraft((current) =>
      current.includes(factionId)
        ? current.filter((id) => id !== factionId)
        : [...current, factionId]
    );
  }

  function onMapFile(event: ChangeEvent<HTMLInputElement>) {
    clearFeedback();
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setMapFile(null);
      return;
    }

    if (!MAP_MIME_TYPES.has(file.type)) {
      setMapFile(null);
      setError("Use a WEBP, PNG or JPEG image.");
      return;
    }

    if (file.size > MAX_MAP_BYTES) {
      setMapFile(null);
      setError("Strategic map images can be at most 15 MB.");
      return;
    }

    setMapFile(file);
  }

  async function uploadMap() {
    if (!mapFile || busy) return;

    setBusy("map");
    clearFeedback();

    try {
      const extension =
        mapFile.type === "image/webp"
          ? "webp"
          : mapFile.type === "image/png"
            ? "png"
            : "jpg";
      const path = `${campaignId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("strategic-maps")
        .upload(path, mapFile, {
          contentType: mapFile.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: savedSettings, error: saveError } = await supabase
        .from("campaign_strategic_map_settings")
        .upsert(
          {
            campaign_id: campaignId,
            map_storage_path: path,
            map_original_name: mapFile.name,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "campaign_id" }
        )
        .select("campaign_id");
      if (saveError) {
        await supabase.storage.from("strategic-maps").remove([path]);
        throw saveError;
      }
      if (!savedSettings?.length) {
        await supabase.storage.from("strategic-maps").remove([path]);
        throw new Error("The new map could not be activated.");
      }

      const { data: signed } = await supabase.storage
        .from("strategic-maps")
        .createSignedUrl(path, 21600);

      const previousPath = mapStoragePath;
      setMapStoragePath(path);
      setMapOriginalName(mapFile.name);
      if (signed?.signedUrl) setMapUrl(signed.signedUrl);
      setMapFile(null);

      if (previousPath && previousPath !== path) {
        await supabase.storage.from("strategic-maps").remove([previousPath]);
      }

      setMessage("New strategic map activated.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to upload the map."
      );
    } finally {
      setBusy(null);
    }
  }

  async function restoreBundledMap() {
    if (busy) return;
    if (
      !window.confirm(
        "Restore the bundled Hinewai map as the active background? Province control will be kept."
      )
    ) {
      return;
    }

    setBusy("map");
    clearFeedback();

    try {
      const previousPath = mapStoragePath;
      const { data, error: saveError } = await supabase
        .from("campaign_strategic_map_settings")
        .upsert(
          {
            campaign_id: campaignId,
            map_storage_path: null,
            map_original_name: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "campaign_id" }
        )
        .select("campaign_id");
      if (saveError) throw saveError;
      if (!data?.length) throw new Error("The bundled map could not be restored.");

      if (previousPath) {
        await supabase.storage.from("strategic-maps").remove([previousPath]);
      }

      setMapStoragePath(null);
      setMapOriginalName(null);
      setMapUrl("/images/hinewai-map.jpg");
      setMapFile(null);
      setMessage("Bundled Hinewai map restored.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to restore the bundled map."
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveProvince() {
    if (busy) return;
    const name = provinceDraft.name.trim();
    const description = provinceDraft.description.trim();

    if (!name || name.length > 120 || description.length > 2500) {
      setError("Province name is required and descriptions are limited to 2500 characters.");
      return;
    }

    setBusy("province");
    clearFeedback();

    try {
      const { data, error: provinceError } = await supabase
        .from("campaign_strategic_provinces")
        .update({
          name,
          status: provinceDraft.status,
          threat_level: provinceDraft.threatLevel,
          description,
          updated_at: new Date().toISOString(),
        })
        .eq("campaign_id", campaignId)
        .eq("province_number", selectedProvinceNumber)
        .select("province_number");
      if (provinceError) throw provinceError;
      if (!data?.length) throw new Error("Province not found or you cannot edit it.");

      const { error: controlError } = await supabase.rpc(
        "set_campaign_strategic_province_control",
        {
          p_campaign_id: campaignId,
          p_province_number: selectedProvinceNumber,
          p_faction_keys: controlDraft,
        }
      );
      if (controlError) throw controlError;

      setProvinces((current) =>
        current.map((province) =>
          province.number === selectedProvinceNumber
            ? {
                ...province,
                name,
                status: provinceDraft.status,
                threatLevel: provinceDraft.threatLevel,
                description,
              }
            : province
        )
      );
      setProvinceControl((current) => ({
        ...current,
        [selectedProvinceNumber]: [...controlDraft] as FactionId[],
      }));
      setMessage(
        controlDraft.length
          ? "Province data and faction control updated."
          : "Province updated and left uncontrolled."
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update province."
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveFaction() {
    if (busy) return;

    const name = factionDraft.name.trim();
    const shortName = factionDraft.shortName.trim();
    const status = factionDraft.status.trim();
    const description = factionDraft.description.trim();
    const relations = cleanRelations(factionDraft.relationsText);
    const armyCount = Math.max(0, Math.floor(factionDraft.armyCount || 0));

    if (!name || !shortName || name.length > 120 || shortName.length > 80) {
      setError("Faction name and short name are required.");
      return;
    }
    if (description.length > 2500 || status.length > 160) {
      setError("Faction description or status is too long.");
      return;
    }

    setBusy("faction");
    clearFeedback();

    try {
      const { data, error: factionError } = await supabase
        .from("campaign_strategic_factions")
        .update({
          name,
          short_name: shortName,
          status,
          description,
          army_count: armyCount,
          relations,
          updated_at: new Date().toISOString(),
        })
        .eq("campaign_id", campaignId)
        .eq("faction_key", selectedFactionId)
        .select("faction_key");
      if (factionError) throw factionError;
      if (!data?.length) throw new Error("Faction not found or you cannot edit it.");

      setFactions((current) =>
        current.map((faction) =>
          faction.id === selectedFactionId
            ? {
                ...faction,
                name,
                shortName,
                status,
                description,
                armyCount,
                relations,
              }
            : faction
        )
      );
      setFactionDraft((current) => ({ ...current, armyCount, relationsText: relations.join("\n") }));
      setMessage("Faction data updated.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update faction."
      );
    } finally {
      setBusy(null);
    }
  }

  const selectedFactionProvinceCount = Object.values(provinceControl).filter(
    (controlledBy) => controlledBy.includes(selectedFactionId)
  ).length;

  return (
    <div className="space-y-6">
      {(error || message) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-2xl border p-4 text-sm ${
            error
              ? "border-red-500/40 bg-red-950/30 text-red-200"
              : "border-green-500/30 bg-green-950/20 text-green-200"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-500">
                Map Background
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-100">
                Current strategic map
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Province polygons and location pins use percentage coordinates,
                so replacement art should keep the same framing and aspect ratio.
              </p>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-400">
              {mapOriginalName ?? "Bundled Hinewai map"}
            </span>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mapUrl} alt="Current strategic map" className="block h-auto w-full" />
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-label="Select a province on the strategic map"
              >
                {provinces.map((province) => {
                  const isSelected = province.number === selectedProvinceNumber;
                  return (
                    <polygon
                      key={province.id}
                      points={province.points}
                      onClick={() => selectProvince(province.number)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "fill-yellow-400/35 stroke-yellow-200 hover:fill-yellow-400/45"
                          : "fill-transparent stroke-white/20 hover:fill-yellow-400/15 hover:stroke-yellow-300/70"
                      }`}
                      strokeWidth={isSelected ? 0.55 : 0.18}
                      vectorEffect="non-scaling-stroke"
                      role="button"
                      tabIndex={0}
                      aria-label={`Select province ${province.number}: ${province.name}`}
                      aria-pressed={isSelected}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectProvince(province.number);
                        }
                      }}
                    />
                  );
                })}
              </svg>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
              <span>
                Highlighted: <strong className="text-yellow-300">{provinces.find((province) => province.number === selectedProvinceNumber)?.name ?? "None"}</strong>
              </span>
              <span>Click a province to edit it</span>
            </div>
          </div>
        </div>

        <div className="h-fit rounded-3xl border border-yellow-600/20 bg-slate-900/70 p-5">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-500">
            Replace map
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-100">
            Upload a new version
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            WEBP, PNG or JPEG · maximum 15 MB. The new image becomes visible to
            Nattau players immediately after activation.
          </p>
          <input
            type="file"
            accept=".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg"
            onChange={onMapFile}
            className="mt-4 block w-full text-xs text-slate-400 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-bold file:text-slate-200"
          />
          {mapFile ? (
            <p className="mt-2 truncate text-xs text-green-300">
              Ready: {mapFile.name} · {(mapFile.size / 1024 / 1024).toFixed(1)} MB
            </p>
          ) : null}
          <button
            type="button"
            disabled={!mapFile || busy !== null}
            onClick={() => void uploadMap()}
            className={
              button +
              " mt-4 w-full border-yellow-600/50 bg-yellow-600/15 text-yellow-100 hover:bg-yellow-600/25"
            }
          >
            {busy === "map" ? "Applying…" : "Upload & activate"}
          </button>
          {mapStoragePath ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void restoreBundledMap()}
              className={
                button +
                " mt-2 w-full border-slate-700 text-slate-300 hover:border-red-500/40 hover:text-red-200"
              }
            >
              Restore bundled map
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-500">
            Provinces
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-100">
            Select territory
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
            {provinces.map((province) => (
              <button
                key={province.number}
                type="button"
                onClick={() => selectProvince(province.number)}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedProvinceNumber === province.number
                    ? "border-yellow-500/60 bg-yellow-500/10"
                    : "border-slate-800 bg-slate-950/50 hover:border-yellow-600/30"
                }`}
              >
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Province {province.number}
                </span>
                <span className="mt-1 block text-sm font-bold text-slate-100">
                  {province.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-500">
            Province {selectedProvinceNumber}
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-100">
            Territory data & control
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-300">
              Name
              <input
                className={field}
                maxLength={120}
                value={provinceDraft.name}
                onChange={(event) =>
                  setProvinceDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-medium text-slate-300">
              Status
              <select
                className={field}
                value={provinceDraft.status}
                onChange={(event) =>
                  setProvinceDraft((current) => ({
                    ...current,
                    status: event.target.value as ProvinceStatus,
                  }))
                }
              >
                <option value="controlled">controlled</option>
                <option value="neutral">neutral</option>
                <option value="contested">contested</option>
                <option value="hostile">hostile</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-300">
              Threat
              <select
                className={field}
                value={provinceDraft.threatLevel}
                onChange={(event) =>
                  setProvinceDraft((current) => ({
                    ...current,
                    threatLevel: event.target.value as ThreatLevel,
                  }))
                }
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
            <div>
              <span className="text-sm font-medium text-slate-300">
                Controlled by
              </span>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {factions.map((faction) => (
                  <label
                    key={faction.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={controlDraft.includes(faction.id)}
                      onChange={() => toggleFactionControl(faction.id)}
                      className="h-4 w-4 accent-yellow-400"
                    />
                    <span>{faction.shortName}</span>
                  </label>
                ))}
              </div>
              {controlDraft.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No faction selected = Unknown / uncontrolled.
                </p>
              ) : null}
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium text-slate-300">
            Description
            <textarea
              rows={5}
              maxLength={2500}
              className={field}
              value={provinceDraft.description}
              onChange={(event) =>
                setProvinceDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>

          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void saveProvince()}
            className={
              button +
              " mt-4 w-full border-yellow-600/50 bg-yellow-600/15 text-yellow-100 hover:bg-yellow-600/25"
            }
          >
            {busy === "province" ? "Saving…" : "Save province"}
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-500">
            Factions
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-100">
            Regional powers
          </h2>
          <div className="mt-4 space-y-2">
            {factions.map((faction) => {
              const provinceCount = Object.values(provinceControl).filter(
                (controlledBy) => controlledBy.includes(faction.id)
              ).length;
              return (
                <button
                  key={faction.id}
                  type="button"
                  onClick={() => selectFaction(faction.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedFactionId === faction.id
                      ? "border-cyan-500/50 bg-cyan-500/10"
                      : "border-slate-800 bg-slate-950/50 hover:border-cyan-500/25"
                  }`}
                >
                  <span className="block text-sm font-bold text-slate-100">
                    {faction.name}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {provinceCount} provinces · {faction.armyCount} armies
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                Faction data
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-100">
                {factionDraft.name || selectedFactionId}
              </h2>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
              {selectedFactionProvinceCount} controlled provinces
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-300">
              Name
              <input
                className={field}
                maxLength={120}
                value={factionDraft.name}
                onChange={(event) =>
                  setFactionDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-medium text-slate-300">
              Short name
              <input
                className={field}
                maxLength={80}
                value={factionDraft.shortName}
                onChange={(event) =>
                  setFactionDraft((current) => ({
                    ...current,
                    shortName: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-medium text-slate-300">
              Status
              <input
                className={field}
                maxLength={160}
                value={factionDraft.status}
                onChange={(event) =>
                  setFactionDraft((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-medium text-slate-300">
              Army count
              <input
                type="number"
                min={0}
                step={1}
                className={field}
                value={factionDraft.armyCount}
                onChange={(event) =>
                  setFactionDraft((current) => ({
                    ...current,
                    armyCount: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium text-slate-300">
            Description
            <textarea
              rows={4}
              maxLength={2500}
              className={field}
              value={factionDraft.description}
              onChange={(event) =>
                setFactionDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-300">
            Relations · one line per relation
            <textarea
              rows={5}
              className={field}
              value={factionDraft.relationsText}
              onChange={(event) =>
                setFactionDraft((current) => ({
                  ...current,
                  relationsText: event.target.value,
                }))
              }
              placeholder={"Trade with Merrydock\nEnemy of Jin Yan Chao"}
            />
          </label>

          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void saveFaction()}
            className={
              button +
              " mt-4 w-full border-cyan-500/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15"
            }
          >
            {busy === "faction" ? "Saving…" : "Save faction"}
          </button>
        </div>
      </section>
    </div>
  );
}
