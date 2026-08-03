import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CampaignSelector } from "@/components/campaigns/CampaignSelector";
import { loadUserCampaignAccess } from "@/lib/campaigns/loadUserCampaigns";

export const metadata: Metadata = {
  title: "Campaign Companion",
  description: "Choose the campaign whose story you want to continue.",
};

export default async function CampaignSelectionPage() {
  const access = await loadUserCampaignAccess();

  if (!access) {
    redirect("/login");
  }

  if (!access.sourceAvailable) {
    redirect("/campaigns/nattau");
  }

  if (access.campaigns.length === 0) {
    redirect("/no-campaign-access");
  }

  if (access.campaigns.length === 1) {
    redirect(access.campaigns[0].homeHref);
  }

  return (
    <CampaignSelector
      displayName={access.displayName}
      campaigns={access.campaigns}
    />
  );
}
