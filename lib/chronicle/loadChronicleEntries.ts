import { createClient } from "@/lib/supabase/server";
import type { ChronicleEntry } from "./types";

export async function loadChronicleEntries(campaignId: string): Promise<ChronicleEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_chronicle_entries")
    .select("id, title, description, tag, created_at, sort_index")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .order("sort_index", { ascending: false });

  if (error) {
    console.error("Unable to load Campaign Chronicle:", error.message);
    throw new Error("Campaign Chronicle is temporarily unavailable.");
  }

  return (data ?? []) as ChronicleEntry[];
}
