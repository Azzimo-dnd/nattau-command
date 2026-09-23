import { CampaignWorkspace, WorkspaceLink } from "@/components/campaigns/CampaignWorkspace";
import { DaggerheartCompendium } from "@/components/daggerheart/DaggerheartCompendium";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCampaignMembership("barovia");

  return (
    <CampaignWorkspace
      campaignSlug="barovia"
      title="Daggerheart Compendium"
      description="A private rules archive for the party: Core Rulebook and Hope & Fear character options, Domain Cards, equipment, loot and transformation material in one searchable place."
      actions={
        <WorkspaceLink href="/campaigns/barovia/characters">
          Open character sheets
        </WorkspaceLink>
      }
    >
      <DaggerheartCompendium />
    </CampaignWorkspace>
  );
}
