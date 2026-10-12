import type { Metadata } from "next";
import { CampaignWorkspace, WorkspaceLink } from "@/components/campaigns/CampaignWorkspace";
import { RecentCampaignEvents } from "@/components/home/RecentCampaignEvents";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";
import { loadChronicleEntries } from "@/lib/chronicle/loadChronicleEntries";

export const metadata: Metadata = { title: "Campaign Chronicle | Nattau" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const access = await requireCampaignMembership("nattau");
  const entries = await loadChronicleEntries(access.membership.campaignId);
  const isDm = access.membership.role === "dm";
  return (
    <CampaignWorkspace
      campaignSlug="nattau"
      title="Campaign Chronicle"
      description="A record of the expedition's choices, victories, discoveries and unfinished business."
      actions={
        <>
          <WorkspaceLink href="/campaigns/nattau">Command Center</WorkspaceLink>
          {isDm && <WorkspaceLink href="/campaigns/nattau/gm/chronicle">Manage Chronicle</WorkspaceLink>}
        </>
      }
    >
      <RecentCampaignEvents events={entries} heading="All Recorded Events" />
    </CampaignWorkspace>
  );
}
