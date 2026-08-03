import { BaroviaModulePlaceholder } from "@/components/campaigns/BaroviaModulePlaceholder";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export default async function BaroviaCharactersPage() {
  await requireCampaignMembership("barovia");

  return (
    <BaroviaModulePlaceholder
      eyebrow="Those claimed by the road"
      title="Lost Souls"
      description="A gallery of player character cards with Daggerheart identity, relationships, story notes and campaign status."
    />
  );
}
