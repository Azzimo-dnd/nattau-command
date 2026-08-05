import type { Metadata } from "next";
import Link from "next/link";
import { DaggerheartDiceRoller } from "@/components/dice/DaggerheartDiceRoller";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const metadata: Metadata = {
  title: "The Duality | Beyond the Mists",
  description: "Physical Daggerheart Duality Dice roller for the Barovia campaign.",
};

export default async function BaroviaDicePage() {
  const access = await requireCampaignMembership("barovia");

  return (
    <main className="mx-auto min-h-screen max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <Link
        href="/campaigns/barovia"
        className="inline-flex min-h-11 items-center rounded-xl border border-[#51303c] bg-black/25 px-4 py-2 text-sm text-[#bda5ad] transition hover:border-[#8f4057] hover:text-[#ebc9d2]"
      >
        ← Return through the Mists
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#a7566d]">
            Hope and Fear beneath the Mists
          </p>
          <h1 className="mt-3 font-serif text-4xl font-black text-[#ead7dc] md:text-5xl">
            The Duality
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#a9929a]">
            Physically throw Hope and Fear, resolve adversary attacks with the GM Die,
            and record every settled result
            in Barovia's private campaign space.
          </p>
        </div>

        <div className="rounded-2xl border border-[#432832] bg-[#160e13]/80 px-4 py-3 text-sm text-[#a9929a]">
          Walking the Mists as
          <strong className="ml-1 text-[#ead7dc]">{access.displayName}</strong>
          {access.membership.role === "dm" ? " · Game Master" : ""}
        </div>
      </div>

      <div className="mt-8">
        <DaggerheartDiceRoller
          campaignId={access.membership.campaignId}
          currentUserId={access.userId}
          currentUserName={access.displayName}
          role={access.membership.role}
        />
      </div>
    </main>
  );
}
