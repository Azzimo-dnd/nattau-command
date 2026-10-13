import { createClient } from "@/lib/supabase/server";
import {
  getFactionLabel,
  provinceControl as fallbackProvinceControl,
  provinces as fallbackProvinces,
  type FactionId,
  type ProvinceStatus,
  type ThreatLevel,
} from "@/components/map/provinceData";
import { fallbackStrategicFactions } from "./fallback";
import type {
  StrategicFaction,
  StrategicFactionId,
  StrategicMapState,
} from "./types";

const FALLBACK_MAP_URL = "/images/hinewai-map.jpg";
const supportedFactionIds = new Set<StrategicFactionId>(
  fallbackStrategicFactions.map((faction) => faction.id)
);

type SettingsRow = {
  map_storage_path: string | null;
  map_original_name: string | null;
};

type FactionRow = {
  faction_key: string;
  name: string;
  short_name: string;
  description: string;
  status: string;
  army_count: number;
};

type ProvinceRow = {
  province_number: number;
  name: string;
  status: ProvinceStatus;
  threat_level: ThreatLevel;
  description: string;
};

type ControlRow = {
  province_number: number;
  faction_key: string;
};

function fallbackState(): StrategicMapState {
  return {
    mapUrl: FALLBACK_MAP_URL,
    mapStoragePath: null,
    mapOriginalName: null,
    provinces: fallbackProvinces,
    provinceControl: fallbackProvinceControl,
    factions: fallbackStrategicFactions,
  };
}

export async function loadStrategicMap(
  campaignId: string
): Promise<StrategicMapState> {
  const supabase = await createClient();

  const [settingsResult, factionsResult, provincesResult, controlResult] =
    await Promise.all([
      supabase
        .from("campaign_strategic_map_settings")
        .select("map_storage_path, map_original_name")
        .eq("campaign_id", campaignId)
        .maybeSingle(),
      supabase
        .from("campaign_strategic_factions")
        .select(
          "faction_key, name, short_name, description, status, army_count, relations, sort_order"
        )
        .eq("campaign_id", campaignId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("campaign_strategic_provinces")
        .select("province_number, name, status, threat_level, description")
        .eq("campaign_id", campaignId)
        .order("province_number", { ascending: true }),
      supabase
        .from("campaign_strategic_province_control")
        .select("province_number, faction_key")
        .eq("campaign_id", campaignId)
        .order("province_number", { ascending: true }),
    ]);

  if (
    factionsResult.error ||
    provincesResult.error ||
    controlResult.error ||
    !factionsResult.data?.length ||
    !provincesResult.data?.length
  ) {
    if (factionsResult.error || provincesResult.error || controlResult.error) {
      console.warn("Strategic map persistent data unavailable; using fallback.");
    }
    return fallbackState();
  }

  const factionRows = factionsResult.data as Array<
    FactionRow & { relations: string[] | null }
  >;

  const factions = factionRows
    .filter((row) =>
      supportedFactionIds.has(row.faction_key as StrategicFactionId)
    )
    .map(
      (row): StrategicFaction => ({
        id: row.faction_key as StrategicFactionId,
        name: row.name,
        shortName: row.short_name,
        description: row.description,
        status: row.status,
        armyCount: row.army_count,
        relations: row.relations ?? [],
      })
    );

  const provinceControl: Record<number, FactionId[]> = {};
  for (const row of controlResult.data as ControlRow[]) {
    if (!supportedFactionIds.has(row.faction_key as StrategicFactionId)) {
      continue;
    }
    provinceControl[row.province_number] ??= [];
    provinceControl[row.province_number].push(row.faction_key as FactionId);
  }

  const provinceOverrides = new Map(
    (provincesResult.data as ProvinceRow[]).map((row) => [
      row.province_number,
      row,
    ])
  );

  const provinces = fallbackProvinces.map((province) => {
    const override = provinceOverrides.get(province.number);
    const control = provinceControl[province.number] ?? [];
    const owner = control.length
      ? control.map(getFactionLabel).join(" / ")
      : "Unknown";

    if (!override) {
      return { ...province, owner };
    }

    return {
      ...province,
      name: override.name,
      owner,
      status: override.status,
      threatLevel: override.threat_level,
      description: override.description,
    };
  });

  const settings = settingsResult.data as SettingsRow | null;
  let mapUrl = FALLBACK_MAP_URL;

  if (settings?.map_storage_path) {
    const { data } = await supabase.storage
      .from("strategic-maps")
      .createSignedUrl(settings.map_storage_path, 21600);
    if (data?.signedUrl) {
      mapUrl = data.signedUrl;
    }
  }

  return {
    mapUrl,
    mapStoragePath: settings?.map_storage_path ?? null,
    mapOriginalName: settings?.map_original_name ?? null,
    provinces,
    provinceControl,
    factions: factions.length ? factions : fallbackStrategicFactions,
  };
}
