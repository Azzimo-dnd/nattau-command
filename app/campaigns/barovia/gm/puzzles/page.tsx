import { redirect } from "next/navigation";
import { PuzzleWorkshop } from "@/components/puzzles/PuzzleWorkshop";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function BaroviaPuzzleWorkshopPage() {
  const access = await requireCampaignMembership("barovia");
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);
  return (
    <PuzzleWorkshop
      campaignId={access.membership.campaignId}
      campaignSlug={access.membership.slug}
      theme="barovia"
    />
  );
}
