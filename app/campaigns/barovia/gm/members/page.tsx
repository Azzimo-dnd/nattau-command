import type { Metadata } from "next";
import { CampaignAdministrationPage } from "@/components/campaign-admin/CampaignAdministrationPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Souls & Invitations | Beyond the Mists",
  description: "Manage Barovia campaign members and invitation codes.",
};

export default function BaroviaMembersPage() {
  return <CampaignAdministrationPage campaignSlug="barovia" />;
}
