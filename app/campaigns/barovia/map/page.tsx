import { BaroviaModulePlaceholder } from "@/components/campaigns/BaroviaModulePlaceholder";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export default async function BaroviaMapPage() {
  await requireCampaignMembership("barovia");

  return (
    <BaroviaModulePlaceholder
      eyebrow="Roads that vanish in fog"
      title="Atlas of the Mists"
      description="A discoverable map of Barovia prepared for hidden, rumored and revealed locations."
    />
  );
}
