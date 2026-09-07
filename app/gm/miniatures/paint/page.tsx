import { CampaignMiniaturePaintPage } from "@/components/campaigns/CampaignTabletopPages";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ character?: string | string[] }> };

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const selected = typeof params.character === "string" ? params.character : undefined;
  return <CampaignMiniaturePaintPage campaignSlug="nattau" gm={true} character={selected} />;
}
