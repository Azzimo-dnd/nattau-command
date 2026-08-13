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
  debuffs: unknown;
  updated_at: string | null;
  updated_by: string | null;
};

type CampaignIdRow = {
  id: string;
};

function emptySettings(databaseReady: boolean): CampaignSessionSettings {
  return {
    status: "tba",
    nextSessionAt: null,
    message: DEFAULT_SESSION_MESSAGE,
    debuffs: [],
    updatedAt: null,
    updatedBy: null,
    databaseReady,
  };
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Loads session settings for a campaign.
 *
 * campaignId is optional for backwards compatibility with the global welcome
 * screen, which historically loaded the single Nattau session row without a
 * campaign argument. New campaign-scoped callers should always pass the ID.
 */
export async function loadCampaignSessionSettings(
  campaignId?: string,
): Promise<CampaignSessionSettings> {
  const supabase = await createClient();
  let resolvedCampaignId = campaignId;

  if (!resolvedCampaignId) {
    const { data: campaignData, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("slug", "nattau")
      .eq("is_active", true)
      .maybeSingle();

    if (campaignError || !campaignData) {
      return emptySettings(false);
    }

    resolvedCampaignId = (campaignData as CampaignIdRow).id;
  }

  const { data, error } = await supabase
    .from("campaign_session_settings")
    .select("status, next_session_at, message, debuffs, updated_at, updated_by")
    .eq("campaign_id", resolvedCampaignId)
    .maybeSingle();

  if (error) {
    return emptySettings(false);
  }

  if (!data) {
    return emptySettings(true);
  }

  const row = data as SessionSettingsRow;
  const status: CampaignSessionStatus =
    row.status === "scheduled" && row.next_session_at ? "scheduled" : "tba";
  const trimmedMessage = row.message?.trim() ?? "";

  return {
    status,
    nextSessionAt: status === "scheduled" ? row.next_session_at : null,
    message:
      status === "scheduled"
        ? trimmedMessage
        : trimmedMessage || DEFAULT_SESSION_MESSAGE,
    debuffs: readStringArray(row.debuffs),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    databaseReady: true,
  };
}
