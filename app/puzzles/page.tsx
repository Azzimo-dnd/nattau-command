import { PuzzleVault } from "@/components/puzzles/PuzzleVault";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function PuzzleVaultPage() {
  const access = await requireCampaignMembership("nattau");
  return (
    <PuzzleVault
      campaignId={access.membership.campaignId}
      campaignSlug={access.membership.slug}
      role={access.membership.role}
      theme="nattau"
    />
  );
}
