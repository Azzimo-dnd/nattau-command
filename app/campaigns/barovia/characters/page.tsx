import type { Metadata } from "next";
import { DaggerheartCharacterSheets } from "@/components/daggerheart/DaggerheartCharacterSheets";
import {
  CampaignWorkspace,
  WorkspaceLink,
} from "@/components/campaigns/CampaignWorkspace";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const metadata: Metadata = { title: "Character Sheet" };

export const dynamic = "force-dynamic";

export default async function Page() {
  const access = await requireCampaignMembership("barovia");
  const isDm = access.membership.role === "dm";

  return (
    <CampaignWorkspace
      campaignSlug="barovia"
      title="Character Sheet"
      description="Your Daggerheart play sheet for the table: live resources, traits, weapons, actions, rules and physical dice rolls."
      actions={
        <>
          {isDm && (
            <WorkspaceLink href="/campaigns/barovia/characters/manage">
              Character manager
            </WorkspaceLink>
          )}
          <WorkspaceLink href="/campaigns/barovia/compendium">
            Open compendium
          </WorkspaceLink>
          <WorkspaceLink href="/campaigns/barovia/vtt">
            Open tabletop
          </WorkspaceLink>
        </>
      }
    >
      <DaggerheartCharacterSheets
        campaignId={access.membership.campaignId}
        currentUserId={access.userId}
        isDm={isDm}
        mode="play"
      />
    </CampaignWorkspace>
  );
}
