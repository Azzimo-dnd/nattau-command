import { PuzzleVault } from "@/components/puzzles/PuzzleVault";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function BaroviaPuzzleVaultPage() {
  const access = await requireCampaignMembership("barovia");
  return (
    <PuzzleVault
      campaignId={access.membership.campaignId}
      campaignSlug={access.membership.slug}
      role={access.membership.role}
      theme="barovia"
    />
  );
}
