import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DicePhysicsLabClient } from "@/components/dice-physics/DicePhysicsLabClient";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Bone Yard | Beyond the Mists",
  description: "Game Master controls for Barovia's physical dice.",
};

export default async function BaroviaDicePhysicsLabPage() {
  const access = await requireCampaignMembership("barovia");
  if (access.membership.role !== "dm") redirect("/campaigns/barovia");

  return (
    <main className="mx-auto min-h-screen max-w-[1760px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <Link href="/campaigns/barovia" className="inline-flex min-h-11 items-center rounded-xl border border-[#51303c] bg-black/25 px-4 text-sm font-semibold text-[#bda5ad] transition hover:border-[#8f4057] hover:text-[#ebc9d2]">
        ← Return through the Mists
      </Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#bd687f]">Game Master Tool</p>
        <h1 className="mt-3 font-serif text-4xl font-black text-[#ead7dc] sm:text-5xl">The Bone Yard</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#aa949c]">
          Tune the dice beneath the Mists. Saved physical values are applied to every player roll in Beyond the Mists.
        </p>
      </div>
      <div className="mt-7">
        <DicePhysicsLabClient
          theme="barovia"
          campaignName="Beyond the Mists"
          campaignId={access.membership.campaignId}
          currentUserId={access.userId}
        />
      </div>
    </main>
  );
}
