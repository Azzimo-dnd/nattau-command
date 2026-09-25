import type { Metadata } from "next";
import { DaggerheartCharacterSheets } from "@/components/daggerheart/DaggerheartCharacterSheets";
import { CampaignWorkspace, WorkspaceLink } from "@/components/campaigns/CampaignWorkspace";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const metadata: Metadata = { title: "Character Sheets" };

export const dynamic = "force-dynamic";

export default async function Page() {
  const access = await requireCampaignMembership("barovia");
  const isDm = access.membership.role === "dm";

  return (
    <CampaignWorkspace
      campaignSlug="barovia"
      title="Lost Souls"
      description="Create and maintain the party's full Daggerheart character sheets. Core Rulebook and Hope & Fear options live here beside the miniatures carried through the Mists."
      compact
      actions={
        <>
          {isDm && (
            <WorkspaceLink href="/campaigns/barovia/gm/miniatures">
              Manage miniatures
            </WorkspaceLink>
          )}
          <WorkspaceLink href="/campaigns/barovia/compendium">Open compendium</WorkspaceLink>
          <WorkspaceLink href="/campaigns/barovia/vtt">Open tabletop</WorkspaceLink>
        </>
      }
    >
      <DaggerheartCharacterSheets
        campaignId={access.membership.campaignId}
        currentUserId={access.userId}
        isDm={isDm}
      />
    </CampaignWorkspace>
  );
}
