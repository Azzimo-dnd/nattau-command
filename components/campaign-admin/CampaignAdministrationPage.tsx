import Link from "next/link";
import { redirect } from "next/navigation";
import { CampaignAdministration } from "./CampaignAdministration";
import {
  loadCampaignAdminMembers,
  loadCampaignInvites,
} from "@/lib/campaigns/loadCampaignAdministration";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";
import { getCampaignAdminPresentation } from "@/lib/campaigns/campaignAdminPresentation";

export async function CampaignAdministrationPage({
  campaignSlug,
}: {
  campaignSlug: string;
}) {
  const access = await requireCampaignMembership(campaignSlug);

  if (access.membership.role !== "dm") {
    redirect(access.membership.homeHref);
  }

  const [members, invites] = await Promise.all([
    loadCampaignAdminMembers(access.membership.campaignId),
    loadCampaignInvites(access.membership.campaignId),
  ]);

  const theme = getCampaignAdminPresentation(
    access.membership.slug,
    access.membership.themeKey,
    access.membership.companionName
  );

  return (
    <main
      className={`mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 sm:py-8 xl:px-8 ${theme.pageText}`}
    >
      <div className="flex flex-wrap gap-2">
        <Link
          href={access.membership.homeHref}
          className={`inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm transition ${theme.secondaryButton}`}
        >
          ← {theme.backLabel}
        </Link>
        <Link
          href="/gm/campaigns"
          className={`inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm transition ${theme.secondaryButton}`}
        >
          All managed campaigns
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p
            className={`text-xs uppercase tracking-[0.35em] ${theme.accentText}`}
          >
            {theme.eyebrow}
          </p>
          <h1
            className={`mt-3 font-serif text-4xl font-black md:text-5xl ${theme.mainText}`}
          >
            {theme.title}
          </h1>
          <p className={`mt-3 max-w-3xl text-sm leading-6 ${theme.mutedText}`}>
            {theme.description}
          </p>
          <p className={`mt-2 text-xs uppercase tracking-[0.18em] ${theme.faintText}`}>
            {access.membership.companionName} · {access.membership.subtitle}
          </p>
        </div>

        <div className={`${theme.panel} px-4 py-3 text-sm ${theme.mutedText}`}>
          Administering as
          <strong className={`ml-1 ${theme.mainText}`}>{access.displayName}</strong>
        </div>
      </div>

      <div className="mt-8">
        <CampaignAdministration
          campaignId={access.membership.campaignId}
          campaignSlug={access.membership.slug}
          companionName={access.membership.companionName}
          themeKey={access.membership.themeKey}
          currentUserId={access.userId}
          initialMembers={members}
          initialInvites={invites}
        />
      </div>
    </main>
  );
}
