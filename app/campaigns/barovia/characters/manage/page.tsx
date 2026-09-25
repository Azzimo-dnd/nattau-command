import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DaggerheartCharacterSheets } from "@/components/daggerheart/DaggerheartCharacterSheets";
import {
  CampaignWorkspace,
  WorkspaceLink,
} from "@/components/campaigns/CampaignWorkspace";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const metadata: Metadata = { title: "Character Manager" };

export const dynamic = "force-dynamic";

export default async function Page() {
  const access = await requireCampaignMembership("barovia");

  if (access.membership.role !== "dm") {
    redirect("/campaigns/barovia/characters");
  }

  return (
    <CampaignWorkspace
      campaignSlug="barovia"
      title="Character Manager"
      description="GM workspace for creating, editing, assigning and maintaining Daggerheart character sheets. Gameplay rolls stay on the separate Character Sheet."
      actions={
        <>
          <WorkspaceLink href="/campaigns/barovia/characters">
            Open play sheets
          </WorkspaceLink>
          <WorkspaceLink href="/campaigns/barovia/compendium">
            Open compendium
          </WorkspaceLink>
          <WorkspaceLink href="/campaigns/barovia/gm/miniatures">
            Manage miniatures
          </WorkspaceLink>
        </>
      }
    >
      <DaggerheartCharacterSheets
        campaignId={access.membership.campaignId}
        currentUserId={access.userId}
        isDm
        mode="manager"
      />
    </CampaignWorkspace>
  );
}
