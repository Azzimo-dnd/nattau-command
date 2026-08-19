import Link from "next/link";
import { redirect } from "next/navigation";
import { MiniaturePainterLab } from "@/components/miniatures/MiniaturePainterLab";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function MiniaturePainterPage() {
  const access = await requireCampaignMembership("nattau");
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);

  return (
    <main className="min-h-screen bg-[#090e15] px-4 py-7 text-slate-100 sm:px-6 lg:py-9">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">GM miniature studio</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Miniature Painter</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              Paint any current campaign miniature, save unlimited lightweight skins, load an existing skin as a starting point, and choose the default version shown to the expedition.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/gm/miniatures" className="inline-flex min-h-11 items-center rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/10 px-4 text-sm font-semibold text-fuchsia-100">
              ← Miniature Studio
            </Link>
            <Link href="/characters" className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300">
              Characters
            </Link>
          </div>
        </div>

        <MiniaturePainterLab
          campaignId={access.membership.campaignId}
          currentUserId={access.userId}
          isDm
        />
      </div>
    </main>
  );
}
