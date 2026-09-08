import { CampaignEnemyStudioPage } from "@/components/campaigns/CampaignTabletopPages";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ model?: string | string[] }> };

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const selected = typeof params.model === "string" ? params.model : undefined;
  return <CampaignEnemyStudioPage campaignSlug="barovia" paint model={selected} />;
}
