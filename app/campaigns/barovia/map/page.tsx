import type { Metadata } from "next";
import Link from "next/link";
import { AtlasOfTheMists } from "@/components/atlas/AtlasOfTheMists";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const metadata: Metadata = {
  title: "Atlas of the Mists | Beyond the Mists",
  description:
    "A discoverable map of Barovia with Game Master controlled locations.",
};

export default async function BaroviaMapPage() {
  const access = await requireCampaignMembership("barovia");

  return (
    <main className="mx-auto min-h-screen max-w-[1840px] px-3 py-6 sm:px-6 sm:py-8 xl:px-8">
      <Link
        href="/campaigns/barovia"
        className="inline-flex min-h-11 items-center rounded-xl border border-[#51303c] bg-black/25 px-4 py-2 text-sm text-[#bda5ad] transition hover:border-[#8f4057] hover:text-[#ebc9d2]"
      >
        ← Return through the Mists
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#a7566d]">
            Roads remembered by the fog
          </p>
          <h1 className="mt-3 font-serif text-4xl font-black text-[#ead7dc] md:text-5xl">
            Atlas of the Mists
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#a9929a]">
            Explore an unlabelled map of Barovia. The Game Master decides which
            places remain hidden, which exist only as rumors and which have
            become part of the party&apos;s known world.
          </p>
        </div>

        <div className="rounded-2xl border border-[#432832] bg-[#160e13]/80 px-4 py-3 text-sm text-[#a9929a]">
          Reading the Atlas as
          <strong className="ml-1 text-[#ead7dc]">{access.displayName}</strong>
          {access.membership.role === "dm" ? " · Game Master" : ""}
        </div>
      </div>

      <div className="mt-8">
        <AtlasOfTheMists
          campaignId={access.membership.campaignId}
          currentUserId={access.userId}
          role={access.membership.role}
        />
      </div>
    </main>
  );
}
