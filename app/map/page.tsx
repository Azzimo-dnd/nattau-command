import Link from "next/link";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";
import { loadStrategicMap } from "@/lib/strategic-map/loadStrategicMap";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const access = await requireCampaignMembership("nattau");
  const state = await loadStrategicMap(access.membership.campaignId);

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-yellow-600/30 bg-slate-900/70 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-yellow-500">
              Nattau Command
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
              Strategic Map
            </h1>
            <p className="mt-3 text-slate-400">
              Known locations, faction influence and strategic points across
              Hinewai.
            </p>
          </div>

          <Link
            href="/campaigns/nattau"
            className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-300 hover:border-yellow-600/50 hover:text-yellow-400"
          >
            Back to Command Center
          </Link>
        </header>

        <InteractiveMap
          state={state}
          isDm={access.membership.role === "dm"}
        />
      </section>
    </main>
  );
}
