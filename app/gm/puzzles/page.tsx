import { redirect } from "next/navigation";
import { PuzzleTesterPanel } from "@/components/puzzles/PuzzleTesterPanel";
import { PuzzleWorkshop } from "@/components/puzzles/PuzzleWorkshop";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function PuzzleWorkshopPage() {
  const access = await requireCampaignMembership("nattau");
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);
  return (
    <>
      <PuzzleTesterPanel
        campaignId={access.membership.campaignId}
        campaignSlug={access.membership.slug}
        theme="nattau"
      />
      <PuzzleWorkshop
        campaignId={access.membership.campaignId}
        campaignSlug={access.membership.slug}
        theme="nattau"
      />
    </>
  );
}
