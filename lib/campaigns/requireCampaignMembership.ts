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
      displayName: membership.displayName,
      membership,
      canSwitchCampaign: access.campaigns.length > 1,
      sourceAvailable: access.sourceAvailable,
    };
  }

  if (!access.sourceAvailable) {
    // Authorization must fail closed if campaign membership cannot be loaded.
    redirect("/no-campaign-access");
  }

  if (access.campaigns.length === 0) {
    redirect("/no-campaign-access");
  }

  redirect("/campaigns");
}
