import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadUserCampaignAccess } from "@/lib/campaigns/loadUserCampaigns";
import {
  loadCampaignAdminMembers,
  loadCampaignInvites,
} from "@/lib/campaigns/loadCampaignAdministration";
import { getCampaignAdminPresentation } from "@/lib/campaigns/campaignAdminPresentation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campaign Administration | Campaign Companion",
  description: "Choose a campaign to manage members and invitation codes.",
};

export default async function ManagedCampaignsPage() {
  const access = await loadUserCampaignAccess();

  if (!access) {
    redirect("/login");
  }

  const managedCampaigns = access.campaigns.filter(
    (campaign) => campaign.role === "dm"
  );

  if (managedCampaigns.length === 0) {
    redirect("/campaigns");
  }

  const cards = await Promise.all(
    managedCampaigns.map(async (campaign) => {
      try {
        const [members, invites] = await Promise.all([
          loadCampaignAdminMembers(campaign.campaignId),
          loadCampaignInvites(campaign.campaignId),
        ]);
        return {
          campaign,
          activeMembers: members.filter((member) => member.isActive).length,
          activeInvites: invites.filter((invite) => {
            if (!invite.isActive) return false;
            if (
              invite.expiresAt &&
              new Date(invite.expiresAt).getTime() <= Date.now()
            ) {
              return false;
            }
            return (
              invite.maxUses === null || invite.usesCount < invite.maxUses
            );
          }).length,
          loadError: null as string | null,
        };
      } catch (error) {
        return {
          campaign,
          activeMembers: null,
          activeInvites: null,
          loadError:
            error instanceof Error ? error.message : "Could not load campaign data.",
        };
      }
    })
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-indigo-300">
              Campaign Companion
            </p>
            <h1 className="mt-3 font-serif text-4xl font-black sm:text-5xl">
              Campaign Administration
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Choose one of the campaigns in which your account is an active Game Master. Membership and invitation settings remain completely separate between campaigns.
            </p>
          </div>
          <Link
            href="/campaigns"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 transition hover:border-indigo-500/50 hover:text-indigo-100"
          >
            Campaign Companion
          </Link>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {cards.map(({ campaign, activeMembers, activeInvites, loadError }) => {
            const theme = getCampaignAdminPresentation(
              campaign.slug,
              campaign.themeKey,
              campaign.companionName
            );

            return (
              <Link
                key={campaign.campaignId}
                href={`/campaigns/${campaign.slug}/gm/members`}
                className={`${theme.panel} group block p-6 transition hover:-translate-y-0.5`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-[0.28em] ${theme.accentText}`}
                >
                  {campaign.subtitle}
                </p>
                <h2
                  className={`mt-3 font-serif text-3xl font-black ${theme.mainText}`}
                >
                  {campaign.companionName}
                </h2>
                <p className={`mt-2 text-sm ${theme.mutedText}`}>
                  {theme.title}
                </p>

                {loadError ? (
                  <p className="mt-5 rounded-xl border border-red-900/45 bg-red-950/20 px-4 py-3 text-sm text-red-300">
                    {loadError}
                  </p>
                ) : (
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className={`rounded-2xl border p-4 ${theme.panelSoft}`}>
                      <p className={`text-xs uppercase tracking-[0.16em] ${theme.faintText}`}>
                        Active members
                      </p>
                      <p className={`mt-2 text-2xl font-black ${theme.mainText}`}>
                        {activeMembers}
                      </p>
                    </div>
                    <div className={`rounded-2xl border p-4 ${theme.panelSoft}`}>
                      <p className={`text-xs uppercase tracking-[0.16em] ${theme.faintText}`}>
                        Invitations
                      </p>
                      <p className={`mt-2 text-2xl font-black ${theme.mainText}`}>
                        {activeInvites}
                      </p>
                    </div>
                  </div>
                )}

                <p
                  className={`mt-6 text-sm font-bold transition group-hover:translate-x-1 ${theme.accentText}`}
                >
                  Manage members and invitations →
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
