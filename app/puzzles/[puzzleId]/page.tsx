import { PuzzleRoom } from "@/components/puzzles/PuzzleRoom";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

type PageProps = { params: Promise<{ puzzleId: string }> };

export const dynamic = "force-dynamic";

export default async function PuzzleRoomPage({ params }: PageProps) {
  const [{ puzzleId }, access] = await Promise.all([
    params,
    requireCampaignMembership("nattau"),
  ]);
  return (
    <PuzzleRoom
      campaignId={access.membership.campaignId}
      campaignSlug={access.membership.slug}
      puzzleId={puzzleId}
      currentUserId={access.userId}
      currentUserName={access.displayName}
      role={access.membership.role}
      theme="nattau"
    />
  );
}
