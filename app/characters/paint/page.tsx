import Link from "next/link";
import { redirect } from "next/navigation";
import { MiniaturePainterLab } from "@/components/miniatures/MiniaturePainterLab";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function PlayerMiniaturePainterPage() {
  const access = await requireCampaignMembership("nattau");
  if (access.membership.role === "dm") redirect("/gm/miniatures/paint");

  return (
    <main className="min-h-screen bg-[#090e15] px-4 py-7 text-slate-100 sm:px-6 lg:py-9">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">Character miniature</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Paint My Miniature</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              Create as many paint skins as you like for your current miniature. Saving a skin never changes the source STL, and you can choose which saved version becomes your default.
            </p>
          </div>
          <Link href="/characters" className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300">
            ← Characters
          </Link>
        </div>

        <MiniaturePainterLab
          campaignId={access.membership.campaignId}
          initialPlayerId={access.userId}
          lockToPlayer
          canManage
        />
      </div>
    </main>
  );
}
