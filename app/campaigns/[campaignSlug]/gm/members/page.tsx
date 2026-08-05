import type { Metadata } from "next";
import { CampaignAdministrationPage } from "@/components/campaign-admin/CampaignAdministrationPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Members & Invitations | Campaign Companion",
  description: "Manage campaign members and invitation codes.",
};

type PageProps = {
  params: Promise<{ campaignSlug: string }>;
};

export default async function CampaignMembersPage({ params }: PageProps) {
  const { campaignSlug } = await params;
  return <CampaignAdministrationPage campaignSlug={campaignSlug} />;
}
