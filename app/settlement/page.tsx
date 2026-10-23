import Link from "next/link";
import { SettlementMap } from "@/components/settlement/SettlementMap";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";
import { loadSettlement } from "@/lib/settlement/loadSettlement";

export const dynamic = "force-dynamic";

export default async function SettlementPage() {
  const access = await requireCampaignMembership("nattau");
  const snapshot = await loadSettlement(access.membership.campaignId);
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 text-slate-100">
      <div className="mb-6">
        <Link href="/campaigns/nattau" className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300">
          ← Back to Command Center
        </Link>
        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">Settlement Command · Nattau</p>
          <h1 className="mt-3 text-4xl font-bold">UĆ — Ashes & Rebirth</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            The aftermath of the Imperial siege, confirmed losses and the long road toward reconstruction.
            This view distinguishes historical map locations from their present condition.
          </p>
        </div>
      </div>
      <SettlementMap
        campaignId={access.membership.campaignId}
        canEdit={access.membership.role === "dm"}
        storageReady={snapshot.storageReady}
        initialBuildings={snapshot.buildings}
        initialSummary={snapshot.summary}
      />
    </main>
  );
}
