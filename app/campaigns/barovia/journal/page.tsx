import type { Metadata } from "next";
import {
  CampaignWorkspace,
  WorkspaceLink,
} from "@/components/campaigns/CampaignWorkspace";
import { DaggerheartCharacterJournal } from "@/components/daggerheart/DaggerheartCharacterJournal";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const metadata: Metadata = { title: "Character Journal" };

export const dynamic = "force-dynamic";

export default async function Page() {
  const access = await requireCampaignMembership("barovia");
  const isDm = access.membership.role === "dm";

  return (
    <CampaignWorkspace
      campaignSlug="barovia"
      title="Story & Journal"
      description="Complete your character's backstory after creation and keep a private, chronological record of each session in Beyond the Mists."
      actions={
        <>
          <WorkspaceLink href="/campaigns/barovia/characters">
            Back to Player Hub
          </WorkspaceLink>
          <WorkspaceLink href="/campaigns/barovia/compendium">
            Open compendium
          </WorkspaceLink>
        </>
      }
    >
      <DaggerheartCharacterJournal
        campaignId={access.membership.campaignId}
        currentUserId={access.userId}
        isDm={isDm}
      />
    </CampaignWorkspace>
  );
}
