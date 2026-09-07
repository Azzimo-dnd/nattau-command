import { CampaignCharactersPage } from "@/components/campaigns/CampaignTabletopPages";

export const dynamic = "force-dynamic";

export default function Page() {
  return <CampaignCharactersPage campaignSlug="barovia" />;
}
