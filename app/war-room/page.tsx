import { WarRoom } from "@/components/WarRoom";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";
import type { SpecialUnitRosterRow } from "@/lib/strategic-map/specialUnits";

export const dynamic = "force-dynamic";

export default async function WarRoomPage(){
  const access=await requireCampaignMembership("nattau");
  const isDm=access.membership.role==="dm";
  const db=await createClient();
  // The player RPC deliberately includes status for all units but only published missions.
  // GM reads the same canonical rows directly, including private missions and revisions.
  const result=isDm
    ? await db.from("campaign_strategic_special_units")
        .select("unit_key,status,mission,updated_at,unit_profile")
        .eq("campaign_id",access.membership.campaignId)
    : await db.rpc("get_campaign_special_unit_roster_v2",{p_campaign_id:access.membership.campaignId});
  const loadError=result.error?.message??null;
  if(loadError)console.error("War Room: unable to load canonical unit state:",loadError);
  const roster=(result.data??[]) as SpecialUnitRosterRow[];
  return <WarRoom
    campaignId={access.membership.campaignId}
    canEdit={isDm}
    roster={roster}
    liveUnavailable={Boolean(loadError)}
  />;
}
