import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CampaignWorkspace, WorkspaceLink } from "@/components/campaigns/CampaignWorkspace";
import { BaroviaSessionNavigation } from "@/components/gm/BaroviaSessionNavigation";
import { TarokkaExperience } from "@/components/tarokka/TarokkaExperience";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "GM Tarokka Control | Beyond the Mists" };

export default async function Page() {
  const access = await requireCampaignMembership("barovia");
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);
  return <CampaignWorkspace campaignSlug="barovia" title="Tarokka Control"
    description="Oversee personal omens, prepare the next Turning, review the High Deck and guide the party's Grand Reading."
    actions={<WorkspaceLink href="/campaigns/barovia/gm/members">Manage party</WorkspaceLink>}>
    <BaroviaSessionNavigation active="tarokka" />
    <TarokkaExperience key={access.membership.campaignId} campaignId={access.membership.campaignId} currentUserId={access.userId} role={access.membership.role} />
  </CampaignWorkspace>;
}
