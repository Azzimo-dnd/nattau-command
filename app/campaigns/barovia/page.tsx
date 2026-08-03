import type { Metadata } from "next";
import { BaroviaDashboard } from "@/components/campaigns/BaroviaDashboard";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const metadata: Metadata = {
  title: "Beyond the Mists | Barovia",
  description: "Daggerheart campaign companion for Barovia.",
};

export default async function BaroviaDashboardPage() {
  const access = await requireCampaignMembership("barovia");

  return (
    <BaroviaDashboard
      displayName={access.displayName}
      role={access.membership.role}
    />
  );
}
