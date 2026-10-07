import { redirect } from "next/navigation";
import { loadUserCampaignAccess } from "@/lib/campaigns/loadUserCampaigns";

export default async function CampaignEntryPage() {
  const access = await loadUserCampaignAccess();

  if (!access) {
    redirect("/login");
  }

  if (!access.sourceAvailable) {
    // Membership data is an authorization boundary. Never fall back to Nattau
    // when it cannot be verified.
    redirect("/no-campaign-access");
  }

  if (access.campaigns.length === 0) {
    redirect("/no-campaign-access");
  }

  if (access.campaigns.length === 1) {
    redirect(access.campaigns[0].homeHref);
  }

  redirect("/campaigns");
}
