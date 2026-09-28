import Link from "next/link";
import { redirect } from "next/navigation";
import { CampaignPasswordReset } from "@/components/campaign-admin/CampaignPasswordReset";
import { loadCampaignAdminMembers } from "@/lib/campaigns/loadCampaignAdministration";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";
import { getCampaignAdminPresentation } from "@/lib/campaigns/campaignAdminPresentation";

export const dynamic = "force-dynamic";

export default async function CampaignPasswordResetPage({
  params,
}: {
  params: Promise<{ campaignSlug: string }>;
}) {
  const { campaignSlug } = await params;
  const access = await requireCampaignMembership(campaignSlug);

  if (access.membership.role !== "dm") {
    redirect(access.membership.homeHref);
  }

  const members = await loadCampaignAdminMembers(access.membership.campaignId);
  const theme = getCampaignAdminPresentation(
    access.membership.slug,
    access.membership.themeKey,
    access.membership.companionName
  );

  return (
    <main
      className={`mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 sm:py-8 xl:px-8 ${theme.pageText}`}
    >
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/campaigns/${access.membership.slug}/gm/members`}
          className={`inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm transition ${theme.secondaryButton}`}
        >
          ← Members & invitations
        </Link>
        <Link
          href={access.membership.homeHref}
          className={`inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm transition ${theme.secondaryButton}`}
        >
          {theme.backLabel}
        </Link>
      </div>

      <div className="mt-6">
        <p className={`text-xs uppercase tracking-[0.35em] ${theme.accentText}`}>
          {theme.eyebrow}
        </p>
        <h1 className={`mt-3 font-serif text-4xl font-black ${theme.mainText}`}>
          Password administration
        </h1>
        <p className={`mt-3 max-w-3xl text-sm leading-6 ${theme.mutedText}`}>
          Reset an existing campaign member password without email recovery.
          Access to this page is restricted to active Game Masters.
        </p>
      </div>

      <div className="mt-8">
        <CampaignPasswordReset
          campaignId={access.membership.campaignId}
          campaignSlug={access.membership.slug}
          companionName={access.membership.companionName}
          themeKey={access.membership.themeKey}
          members={members}
        />
      </div>
    </main>
  );
}
