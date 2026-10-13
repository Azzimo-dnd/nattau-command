import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CampaignWorkspace,
  WorkspaceLink,
} from "@/components/campaigns/CampaignWorkspace";
import { StrategicMapManager } from "@/components/map/StrategicMapManager";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";
import { loadStrategicMap } from "@/lib/strategic-map/loadStrategicMap";

export const metadata: Metadata = {
  title: "Strategic Map Control | Nattau",
};

export const dynamic = "force-dynamic";

export default async function StrategicMapControlPage() {
  const access = await requireCampaignMembership("nattau");

  if (access.membership.role !== "dm") {
    redirect("/map");
  }

  const state = await loadStrategicMap(access.membership.campaignId);

  return (
    <CampaignWorkspace
      campaignSlug="nattau"
      title="Strategic Map Control"
      description="Replace the Hinewai strategic map, revise province ownership and update faction information. Army placement remains deliberately separate until its map interaction is designed."
      actions={<WorkspaceLink href="/map">View Strategic Map</WorkspaceLink>}
    >
      <StrategicMapManager
        campaignId={access.membership.campaignId}
        initialState={state}
      />
    </CampaignWorkspace>
  );
}
