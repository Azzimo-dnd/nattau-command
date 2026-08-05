import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DicePhysicsLabClient } from "@/components/dice-physics/DicePhysicsLabClient";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dice Physics Lab | Nattau Command",
  description: "GM controls for campaign-wide physical dice behavior.",
};

export default async function NattauDicePhysicsLabPage() {
  const access = await requireCampaignMembership("nattau");
  if (access.membership.role !== "dm") redirect("/campaigns/nattau");

  return (
    <main className="mx-auto min-h-screen max-w-[1760px] px-4 py-6 text-slate-100 sm:px-6 sm:py-8 xl:px-8">
      <Link href="/campaigns/nattau" className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-950/65 px-4 text-sm font-semibold text-slate-300 transition hover:border-yellow-600/45 hover:text-yellow-300">
        ← Back to Command Center
      </Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-yellow-400">Game Master Tool</p>
        <h1 className="mt-3 font-serif text-4xl font-black sm:text-5xl">Dice Physics Lab</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Test the physical engine and save the exact throw, friction, bounce and gravity values used by every Nattau player.
        </p>
      </div>
      <div className="mt-7">
        <DicePhysicsLabClient
          theme="nattau"
          campaignName="Nattau Command"
          campaignId={access.membership.campaignId}
          currentUserId={access.userId}
        />
      </div>
    </main>
  );
}
