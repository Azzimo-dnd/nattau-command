import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CampaignWorkspace, WorkspaceLink } from "@/components/campaigns/CampaignWorkspace";
import { ChronicleManager } from "@/components/chronicle/ChronicleManager";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";
import { loadChronicleEntries } from "@/lib/chronicle/loadChronicleEntries";

export const metadata: Metadata = { title: "Chronicle Editor | Nattau" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const access = await requireCampaignMembership("nattau");
  if (access.membership.role !== "dm") {
    redirect("/campaigns/nattau/chronicle");
  }
  const entries = await loadChronicleEntries(access.membership.campaignId);
  return (
    <CampaignWorkspace
      campaignSlug="nattau"
      title="Chronicle Editor"
      description="Create and revise the expedition's public historical record. Changes are visible to Nattau players immediately."
      actions={
        <WorkspaceLink href="/campaigns/nattau/chronicle">View Chronicle</WorkspaceLink>
      }
    >
      <ChronicleManager campaignId={access.membership.campaignId} initialEntries={entries} />
    </CampaignWorkspace>
  );
}
