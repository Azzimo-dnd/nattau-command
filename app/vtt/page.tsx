import Link from "next/link";
import { VttBattleBoard } from "@/components/vtt/VttBattleBoard";
import { VttObjectUrlGuard } from "@/components/vtt/VttObjectUrlGuard";
import { VttThreeMaterialPatch } from "@/components/vtt/VttThreeMaterialPatch";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function VttPage() {
  const access = await requireCampaignMembership("nattau");
  const isDm = access.membership.role === "dm";

  return (
    <main className="min-h-screen bg-[#070b11] px-3 py-5 text-slate-100 sm:px-5 lg:px-7 lg:py-7">
      <VttObjectUrlGuard />
      <VttThreeMaterialPatch />
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-4 overflow-hidden rounded-[30px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,#263249_0%,#111925_55%,#090e16_100%)] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-300">Nattau VTT Alpha</p>
              <h1 className="mt-3 text-4xl font-black sm:text-5xl">Virtual Tabletop</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                A clean 5 ft D&amp;D grid with the expedition&apos;s real 3D miniatures. Players are spectators in Alpha; the Game Master alone controls placement, movement and enemy reveals.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isDm ? (
                <Link href="/gm/vtt/enemies" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-400/10 px-5 text-sm font-black text-rose-100">
                  Enemy Studio
                </Link>
              ) : null}
              <Link href="/characters" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/50 px-5 text-sm font-bold text-slate-300">
                Characters
              </Link>
            </div>
          </div>
        </header>

        <VttBattleBoard campaignId={access.membership.campaignId} isDm={isDm} />
      </div>
    </main>
  );
}
