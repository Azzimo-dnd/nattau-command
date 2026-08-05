import { createClient } from "@/lib/supabase/server";
import type {
  CampaignAdminMember,
  CampaignInviteSummary,
} from "@/components/campaign-admin/adminTypes";

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function loadCampaignAdminMembers(campaignId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campaign_admin_members", {
    p_campaign_id: campaignId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map(
    (row): CampaignAdminMember => ({
      userId: asText(row.user_id),
      displayName: asText(row.display_name, "Unknown soul"),
      email: asNullableText(row.email),
      role: row.member_role === "dm" ? "dm" : "player",
      planningEnabled: asBoolean(row.planning_enabled, true),
      countsTowardProgress: asBoolean(row.counts_toward_progress, true),
      isTestAccount: asBoolean(row.is_test_account, false),
      isActive: asBoolean(row.is_active, true),
      joinedAt: asText(row.joined_at),
      lastSeenAt: asNullableText(row.last_seen_at),
    })
  );
}

export async function loadCampaignInvites(campaignId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campaign_invites", {
    p_campaign_id: campaignId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map(
    (row): CampaignInviteSummary => ({
      id: asText(row.invite_id),
      label: asNullableText(row.invite_label),
      codePreview: asText(row.code_preview, "••••"),
      role: "player",
      planningEnabled: asBoolean(row.planning_enabled, true),
      countsTowardProgress: asBoolean(row.counts_toward_progress, true),
      maxUses:
        row.max_uses === null || row.max_uses === undefined
          ? null
          : asNumber(row.max_uses),
      usesCount: asNumber(row.uses_count),
      expiresAt: asNullableText(row.expires_at),
      isActive: asBoolean(row.is_active, true),
      createdAt: asText(row.created_at),
      createdByName: asNullableText(row.created_by_name),
    })
  );
}
