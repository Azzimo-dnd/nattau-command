import type { Metadata } from "next";
import { InviteCodeEntry } from "@/components/campaign-admin/InviteCodeEntry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enter Invitation Code | Campaign Companion",
  description: "Join a private campaign using an invitation code.",
};

export default function CampaignInviteCodePage() {
  return <InviteCodeEntry />;
}
