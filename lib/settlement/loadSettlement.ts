import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  isSettlementBuilding, mergeSettlementBuildings, settlementSummary,
  type SettlementBuilding, type SettlementSummary,
} from "@/components/settlement/settlementData";

export type SettlementSnapshot = {
  buildings: SettlementBuilding[];
  summary: SettlementSummary;
  storageReady: boolean;
};
function missingTable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}
type Row = {
  building_key: string;
  name: string; category: string; status: string; x: number; y: number;
  icon: string; summary: string; output: string; notes: string[];
  rebuild_progress: number; rebuild_note: string;
};
function toBuilding(row: Row): SettlementBuilding {
  return {
    id: row.building_key, name: row.name,
    category: row.category as SettlementBuilding["category"],
    status: row.status as SettlementBuilding["status"],
    x: Number(row.x), y: Number(row.y), icon: row.icon,
    summary: row.summary, output: row.output ?? "",
    notes: row.notes, rebuildProgress: row.rebuild_progress,
    rebuildNote: row.rebuild_note, confirmedAfterSiege: true,
  };
}

/** An unavailable migration shows the truthful siege fallback, never the pre-siege status. */
export async function loadSettlement(campaignId: string): Promise<SettlementSnapshot> {
  const client = await createClient();
  const [buildingResult, overviewResult] = await Promise.all([
    client.from("campaign_settlement_buildings").select("*").eq("campaign_id", campaignId).order("name"),
    client.from("campaign_settlement_overview").select("*").eq("campaign_id", campaignId).maybeSingle(),
  ]);
  if (missingTable(buildingResult.error?.code) || missingTable(overviewResult.error?.code)) {
    return { buildings: mergeSettlementBuildings([]), summary: settlementSummary, storageReady: false };
  }
  if (buildingResult.error || overviewResult.error) {
    throw new Error("The live settlement status is unavailable.");
  }

  const overrides = ((buildingResult.data ?? []) as Row[]).map(toBuilding).filter(isSettlementBuilding);
  const row = overviewResult.data as Record<string, unknown> | null;
  const summary: SettlementSummary = { ...settlementSummary };
  if (row) {
    const fields = {
      population: "population", morale: "morale", food: "food", defense: "defense",
      civilianCasualties: "civilian_casualties", galleonCasualties: "galleon_casualties",
      militaryCasualties: "military_casualties", recovery: "recovery",
    } as const;
    for (const [field, dbField] of Object.entries(fields) as Array<[keyof typeof fields, string]>) {
      const value = row[dbField];
      if (typeof value === "string" && value.length > 0 && value.length <= 120) {
        summary[field] = value;
      }
    }
  }
  return { buildings: mergeSettlementBuildings(overrides), summary, storageReady: true };
}
