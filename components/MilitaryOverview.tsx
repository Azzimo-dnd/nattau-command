import { campaign } from "@/config/campaign";

export function MilitaryOverview() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-yellow-500">
          Military Overview
        </h2>
        <a href="#war-room" className="text-sm text-yellow-400 hover:underline">
          Open War Room →
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-sm text-slate-400">Ready Units</p>
          <p className="mt-1 text-3xl font-bold text-yellow-500">4</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-sm text-slate-400">Inactive Units</p>
          <p className="mt-1 text-3xl font-bold text-red-400">1</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-sm text-slate-400">Support Units</p>
          <p className="mt-1 text-3xl font-bold text-slate-100">2</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-sm text-slate-400">Deployment Capacity</p>
          <p className="mt-1 text-3xl font-bold text-yellow-500">{campaign.resourcePoints} RP</p>
        </div>
      </div>
    </section>
  );
}