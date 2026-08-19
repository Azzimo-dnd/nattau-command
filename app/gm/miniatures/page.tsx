import Link from "next/link";
import { redirect } from "next/navigation";
import { MiniatureManager } from "@/components/miniatures/MiniatureManager";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function MiniatureStudioPage() {
  const access = await requireCampaignMembership("nattau");
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);

  return (
    <main className="min-h-screen bg-[#090e15] px-4 py-7 text-slate-100 sm:px-6 lg:py-9">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-500">GM miniature studio</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Character Miniatures</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Preview an STL, assign it to an active character and save it as the campaign&apos;s current miniature. Previous versions remain available to the Game Master, while players can only load the model currently selected for the campaign.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/gm/miniatures/paint" className="inline-flex min-h-11 items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 text-sm font-semibold text-fuchsia-100">
              Paint Miniatures
            </Link>
            <Link href="/characters" className="inline-flex min-h-11 items-center rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 text-sm font-semibold text-yellow-200">
              View Characters
            </Link>
            <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300">
              ← Command Center
            </Link>
          </div>
        </div>

        <MiniatureManager campaignId={access.membership.campaignId} />
      </div>
    </main>
  );
}
