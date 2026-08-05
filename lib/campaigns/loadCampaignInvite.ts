import { createClient } from "@/lib/supabase/server";
import type { CampaignInvitePreview } from "@/components/campaign-admin/adminTypes";

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function loadCampaignInvitePreview(code: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_campaign_invite_preview", {
    p_code: code,
  });

  if (error) {
    return {
      valid: false,
      reason: "Invitation validation is not available. The onboarding SQL migration may still need to be installed.",
      campaignId: null,
      campaignSlug: null,
      campaignName: null,
      companionName: null,
      subtitle: null,
      systemKey: null,
      themeKey: null,
      label: null,
      expiresAt: null,
    } satisfies CampaignInvitePreview;
  }

  const raw = Array.isArray(data) ? data[0] : data;
  const row = (raw ?? {}) as Record<string, unknown>;

  return {
    valid: row.is_valid === true,
    reason: nullableText(row.invalid_reason),
    campaignId: nullableText(row.campaign_id),
    campaignSlug: nullableText(row.campaign_slug),
    campaignName: nullableText(row.campaign_name),
    companionName: nullableText(row.companion_name),
    subtitle: nullableText(row.campaign_subtitle),
    systemKey: nullableText(row.system_key),
    themeKey: nullableText(row.theme_key),
    label: nullableText(row.invite_label),
    expiresAt: nullableText(row.expires_at),
  } satisfies CampaignInvitePreview;
}
