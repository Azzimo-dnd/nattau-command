import type { Metadata } from "next";
import { InviteExperience } from "@/components/campaign-admin/InviteExperience";
import { loadCampaignInvitePreview } from "@/lib/campaigns/loadCampaignInvite";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campaign Invitation | Campaign Companion",
  description: "Create an account or sign in to accept a private campaign invitation.",
};

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ redeem?: string }>;
};

export default async function CampaignInvitePage({ params, searchParams }: PageProps) {
  const [{ code: encodedCode }, query] = await Promise.all([params, searchParams]);
  const code = decodeURIComponent(encodedCode).trim().toUpperCase();
  const preview = await loadCampaignInvitePreview(code);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    displayName =
      typeof profile?.display_name === "string"
        ? profile.display_name
        : typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : user.email?.split("@")[0] ?? null;
  }

  return (
    <InviteExperience
      code={code}
      preview={preview}
      initiallyAuthenticated={Boolean(user)}
      initialDisplayName={displayName}
      autoRedeem={query.redeem === "1"}
    />
  );
}
