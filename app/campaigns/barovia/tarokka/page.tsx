import { BaroviaModulePlaceholder } from "@/components/campaigns/BaroviaModulePlaceholder";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export default async function TarokkaPage() {
  await requireCampaignMembership("barovia");

  return (
    <BaroviaModulePlaceholder
      eyebrow="Fate beneath the fog"
      title="Tarokka of the Mists"
      description="A campaign-specific fate cycle inspired by Barovia, with its own deck identity, omens and history of revealed cards."
    />
  );
}
