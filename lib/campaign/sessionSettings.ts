import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SESSION_MESSAGE,
  type CampaignSessionSettings,
  type CampaignSessionStatus,
} from "@/lib/campaign/sessionTypes";

type SessionSettingsRow = {
  status: string;
  next_session_at: string | null;
  message: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

export async function loadCampaignSessionSettings(): Promise<CampaignSessionSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_session_settings")
    .select("status, next_session_at, message, updated_at, updated_by")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return {
      status: "tba",
      nextSessionAt: null,
      message: DEFAULT_SESSION_MESSAGE,
      updatedAt: null,
      updatedBy: null,
      databaseReady: false,
    };
  }

  const row = data as SessionSettingsRow;
  const status: CampaignSessionStatus =
    row.status === "scheduled" && row.next_session_at ? "scheduled" : "tba";

  return {
    status,
    nextSessionAt: status === "scheduled" ? row.next_session_at : null,
    message: row.message?.trim() || DEFAULT_SESSION_MESSAGE,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    databaseReady: true,
  };
}
