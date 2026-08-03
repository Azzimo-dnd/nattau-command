import Link from "next/link";
import { SessionPlanner } from "@/components/session-planner/SessionPlanner";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export default async function BaroviaPlannerPage() {
  const access = await requireCampaignMembership("barovia");

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-3 py-6 sm:px-6 sm:py-8 xl:px-8">
      <Link
        href="/campaigns/barovia"
        className="inline-flex min-h-11 items-center rounded-xl border border-[#51303c] bg-black/25 px-4 py-2 text-sm text-[#bda5ad] transition hover:border-[#8f4057] hover:text-[#ebc9d2]"
      >
        ← Return through the Mists
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#a7566d]">
            Call the Lost Souls together
          </p>
          <h1 className="mt-3 font-serif text-4xl font-black text-[#ead7dc] md:text-5xl">
            The Gathering
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#a9929a]">
            Choose the nights when the Mists may allow the party to meet.
            Availability, votes and confirmed dates remain completely separate
            from Nattau.
          </p>
        </div>

        <div className="rounded-2xl border border-[#432832] bg-[#160e13]/80 px-4 py-3 text-sm text-[#a9929a]">
          Walking the Mists as
          <strong className="ml-1 text-[#ead7dc]">{access.displayName}</strong>
          {access.membership.role === "dm" ? " · Game Master" : ""}
        </div>
      </div>

      <div className="mt-8">
        <SessionPlanner
          campaignSlug="barovia"
          variant="barovia"
          currentUser={{
            id: access.userId,
            displayName: access.displayName,
            role: access.membership.role,
          }}
        />
      </div>
    </main>
  );
}
