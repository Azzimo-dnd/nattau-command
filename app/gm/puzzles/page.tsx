import { redirect } from "next/navigation";
import { PuzzleMaintenancePanel } from "@/components/puzzles/PuzzleMaintenancePanel";
import { PuzzleWorkshop } from "@/components/puzzles/PuzzleWorkshop";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function PuzzleWorkshopPage() {
  const access = await requireCampaignMembership("nattau");
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);
  return (
    <>
      <PuzzleWorkshop
        campaignId={access.membership.campaignId}
        campaignSlug={access.membership.slug}
        theme="nattau"
      />
      <PuzzleMaintenancePanel campaignId={access.membership.campaignId} />
    </>
  );
}
