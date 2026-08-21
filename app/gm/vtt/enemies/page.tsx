import Link from "next/link";
import { redirect } from "next/navigation";
import { VttEnemyStudio } from "@/components/vtt/VttEnemyStudio";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function VttEnemyStudioPage() {
  const access = await requireCampaignMembership("nattau");
  if (access.membership.role !== "dm") redirect("/vtt");

  return (
    <main className="min-h-screen bg-[#070b11] px-4 py-7 text-slate-100 sm:px-6 lg:py-9">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 overflow-hidden rounded-[30px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,#3a2131_0%,#17121c_48%,#090e16_100%)] p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-rose-300">GM only · VTT assets</p>
              <h1 className="mt-3 text-4xl font-black sm:text-5xl">Enemy Miniature Studio</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Upload monster STLs, generate browser-friendly GLBs and paint private enemy variants before revealing anything to players.</p>
            </div>
            <Link href="/vtt" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 font-black text-cyan-100">Open VTT Alpha</Link>
          </div>
        </header>
        <VttEnemyStudio campaignId={access.membership.campaignId} />
      </div>
    </main>
  );
}
