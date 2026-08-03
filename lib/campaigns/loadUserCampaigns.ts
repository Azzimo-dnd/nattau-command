import { cache } from "react";
import { getCurrentAppUser } from "@/lib/auth/getCurrentAppUser";
import { createClient } from "@/lib/supabase/server";
import {
  getCampaignHomeHref,
  type CampaignMembership,
  type UserCampaignAccess,
} from "./campaignTypes";

type CampaignRelationRow = {
  id?: string;
  slug?: string;
  name?: string;
  companion_name?: string | null;
  subtitle?: string | null;
  system_key?: string | null;
  theme_key?: string | null;
  enabled_modules?: unknown;
  is_active?: boolean;
  sort_order?: number | null;
};

type MembershipRow = {
  role?: string | null;
  planning_enabled?: boolean | null;
  is_active?: boolean | null;
  campaigns?: CampaignRelationRow | CampaignRelationRow[] | null;
};

function normalizeModules(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeCampaignRelation(
  value: CampaignRelationRow | CampaignRelationRow[] | null | undefined
) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export const loadUserCampaignAccess = cache(
  async (): Promise<UserCampaignAccess | null> => {
    const currentUser = await getCurrentAppUser();

    if (!currentUser) {
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("campaign_members")
      .select(
        `
          role,
          planning_enabled,
          is_active,
          campaigns!inner (
            id,
            slug,
            name,
            companion_name,
            subtitle,
            system_key,
            theme_key,
            enabled_modules,
            is_active,
            sort_order
          )
        `
      )
      .eq("user_id", currentUser.id)
      .eq("is_active", true);

    if (error) {
      console.warn(
        "Campaign membership data could not be loaded. Falling back to the existing Nattau experience.",
        error.message
      );

      return {
        userId: currentUser.id,
        displayName: currentUser.displayName,
        defaultRole: currentUser.role,
        sourceAvailable: false,
        campaigns: [],
      };
    }

    const memberships: CampaignMembership[] = ((data ?? []) as MembershipRow[])
      .map((row) => {
        const campaign = normalizeCampaignRelation(row.campaigns);

        if (
          !campaign?.id ||
          !campaign.slug ||
          !campaign.name ||
          campaign.is_active === false
        ) {
          return null;
        }

        return {
          campaignId: campaign.id,
          slug: campaign.slug,
          name: campaign.name,
          companionName: campaign.companion_name?.trim() || campaign.name,
          subtitle: campaign.subtitle?.trim() || "Campaign Companion",
          systemKey: campaign.system_key?.trim() || "unknown",
          themeKey: campaign.theme_key?.trim() || campaign.slug,
          enabledModules: normalizeModules(campaign.enabled_modules),
          role: row.role === "dm" ? "dm" : "player",
          planningEnabled: row.planning_enabled !== false,
          homeHref: getCampaignHomeHref(campaign.slug),
          sortOrder: Number(campaign.sort_order ?? 100),
        };
      })
      .filter(
        (entry): entry is CampaignMembership & { sortOrder: number } =>
          entry !== null
      )
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.name.localeCompare(right.name);
      })
      .map(({ sortOrder: _sortOrder, ...membership }) => membership);

    return {
      userId: currentUser.id,
      displayName: currentUser.displayName,
      defaultRole: currentUser.role,
      sourceAvailable: true,
      campaigns: memberships,
    };
  }
);
