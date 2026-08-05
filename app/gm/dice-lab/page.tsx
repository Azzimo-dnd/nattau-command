import { redirect } from "next/navigation";
import { loadUserCampaignAccess } from "@/lib/campaigns/loadUserCampaigns";

export const dynamic = "force-dynamic";

export default async function DicePhysicsLabRedirectPage() {
  const access = await loadUserCampaignAccess();
  if (!access) redirect("/login");

  const preferredCampaign =
    access.campaigns.find(
      (campaign) => campaign.slug === "barovia" && campaign.role === "dm"
    ) ?? access.campaigns.find((campaign) => campaign.role === "dm");

  if (!preferredCampaign) redirect("/campaigns");
  redirect(`/campaigns/${preferredCampaign.slug}/gm/dice-lab`);
}
