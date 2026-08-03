import type { AppRole } from "@/components/navigation/navigationTypes";

export type CampaignThemeKey = "nattau" | "barovia" | string;

export type CampaignMembership = {
  campaignId: string;
  slug: string;
  name: string;
  companionName: string;
  subtitle: string;
  systemKey: string;
  themeKey: CampaignThemeKey;
  enabledModules: string[];
  role: AppRole;
  planningEnabled: boolean;
  homeHref: string;
};

export type UserCampaignAccess = {
  userId: string;
  displayName: string;
  defaultRole: AppRole;
  sourceAvailable: boolean;
  campaigns: CampaignMembership[];
};

export function getCampaignHomeHref(slug: string) {
  return `/campaigns/${slug}`;
}
