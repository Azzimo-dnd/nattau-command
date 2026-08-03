import { redirect } from "next/navigation";
import type { CampaignMembership } from "./campaignTypes";
import { loadUserCampaignAccess } from "./loadUserCampaigns";

export type RequiredCampaignAccess = {
  userId: string;
  displayName: string;
  membership: CampaignMembership;
  canSwitchCampaign: boolean;
  sourceAvailable: boolean;
};

export async function requireCampaignMembership(
  slug: string
): Promise<RequiredCampaignAccess> {
  const access = await loadUserCampaignAccess();

  if (!access) {
    redirect("/login");
  }

  const membership = access.campaigns.find(
    (campaign) => campaign.slug === slug
  );

  if (membership) {
    return {
      userId: access.userId,
      displayName: access.displayName,
      membership,
      canSwitchCampaign: access.campaigns.length > 1,
      sourceAvailable: access.sourceAvailable,
    };
  }

  // Safe fallback while the SQL migration is being installed.
  // It keeps the existing Nattau application reachable instead of breaking login.
  if (!access.sourceAvailable && slug === "nattau") {
    return {
      userId: access.userId,
      displayName: access.displayName,
      membership: {
        campaignId: "legacy-nattau",
        slug: "nattau",
        name: "Nattau Expedition",
        companionName: "Nattau Command",
        subtitle: "Kainite Expedition",
        systemKey: "dnd5e",
        themeKey: "nattau",
        enabledModules: [],
        role: access.defaultRole,
        planningEnabled: true,
        homeHref: "/campaigns/nattau",
      },
      canSwitchCampaign: false,
      sourceAvailable: false,
    };
  }

  if (access.campaigns.length === 0) {
    redirect("/no-campaign-access");
  }

  redirect("/campaigns");
}
