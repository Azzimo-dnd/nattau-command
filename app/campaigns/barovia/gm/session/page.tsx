import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CampaignWorkspace, WorkspaceLink } from "@/components/campaigns/CampaignWorkspace";
import { BaroviaSessionNavigation } from "@/components/gm/BaroviaSessionNavigation";
import { BaroviaSessionOverview } from "@/components/gm/BaroviaSessionOverview";
import { SessionControls } from "@/components/gm/SessionControls";
import { SessionPlanner } from "@/components/session-planner/SessionPlanner";
import { sessionDeskView } from "@/lib/campaign/baroviaSessionDesk";
import { loadBaroviaSessionDesk } from "@/lib/campaign/loadBaroviaSessionDesk";
import { loadCampaignSessionSettings } from "@/lib/campaign/sessionSettings";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "GM Session Desk | Beyond the Mists" };

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const access = await requireCampaignMembership("barovia");
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);
  const view = sessionDeskView((await searchParams).view);
  const campaignId = access.membership.campaignId;
  const [settings, overview] = await Promise.all([
    view !== "planning" ? loadCampaignSessionSettings(campaignId) : null,
    view === "overview" ? loadBaroviaSessionDesk(campaignId) : null,
  ]);

  return <CampaignWorkspace campaignSlug="barovia" title="GM Session Desk"
    description="Prepare the next gathering from one place: check the party, choose a night, publish the announcement and turn to the Tarokka."
    actions={<><WorkspaceLink href="/campaigns/barovia/gm/members">Manage party</WorkspaceLink><WorkspaceLink href="/campaigns/barovia/vtt">Open tabletop</WorkspaceLink></>}>
    <BaroviaSessionNavigation active={view} />
    {view === "overview" && overview && settings && <BaroviaSessionOverview overview={overview} session={settings} />}
    {view === "planning" && <SessionPlanner key={campaignId} campaignSlug="barovia" variant="barovia"
      currentUser={{ id: access.userId, displayName: access.displayName, role: access.membership.role }} />}
    {view === "publication" && settings && <SessionControls key={campaignId} initialSettings={settings} campaignSlug="barovia" />}
  </CampaignWorkspace>;
}
