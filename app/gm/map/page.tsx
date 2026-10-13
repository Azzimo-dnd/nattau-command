import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CampaignWorkspace,
  WorkspaceLink,
} from "@/components/campaigns/CampaignWorkspace";
import { ArmyGroupManager } from "@/components/map/ArmyGroupManager";
import { GalleonManager } from "@/components/map/GalleonManager";
import type { StrategicGalleon } from "@/lib/strategic-map/galleon";
import { createClient } from "@/lib/supabase/server";
import type { ArmyGroup } from "@/lib/strategic-map/armyGroups";
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
  const supabase = await createClient();
  const { data: armyGroups, error: armyError } = await supabase.from("campaign_strategic_army_groups").select("*").eq("campaign_id", access.membership.campaignId).is("archived_at", null).order("name");
  if (armyError) console.error("Unable to load strategic army groups:", armyError.message);
  const {data:galleon,error:galleonError}=await supabase.from("campaign_strategic_galleon").select("*").eq("campaign_id",access.membership.campaignId).maybeSingle();
  if(galleonError) console.error("Unable to load flying galleon:",galleonError.message);

  return (
    <CampaignWorkspace
      campaignSlug="nattau"
      title="Strategic Map Control"
      description="Replace the Hinewai strategic map, revise province ownership and update faction information. Manage strategic army groups and visibility alongside provinces, faction control and the map background."
      actions={<WorkspaceLink href="/map">View Strategic Map</WorkspaceLink>}
    >
      <GalleonManager campaignId={access.membership.campaignId} state={state} initialGalleon={(galleon??null) as StrategicGalleon|null}/>
      <ArmyGroupManager campaignId={access.membership.campaignId} state={state} initialGroups={(armyGroups ?? []) as ArmyGroup[]} />
      <StrategicMapManager
        campaignId={access.membership.campaignId}
        initialState={state}
      />
    </CampaignWorkspace>
  );
}
