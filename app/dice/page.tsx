import type { Metadata } from "next";
import Link from "next/link";
import { NattauDiceRoller } from "@/components/dice/NattauDiceRoller";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const metadata: Metadata = {
  title: "Dice Roller | Nattau Command",
  description: "Campaign dice roller with a shared Supabase roll history.",
};

export default async function NattauDicePage() {
  const access = await requireCampaignMembership("nattau");

  return (
    <main className="mx-auto min-h-screen max-w-[1500px] px-4 py-6 text-slate-100 sm:px-6 sm:py-8 xl:px-8">
      <Link
        href="/campaigns/nattau"
        className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
      >
        ← Back to Command Center
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Campaign Tool
          </p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">
            Dice Roller
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Roll standard polyhedral dice, use d20 advantage or disadvantage,
            and save the results in the shared Nattau campaign log.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-400">
          Rolling as
          <strong className="ml-1 text-slate-100">{access.displayName}</strong>
          {access.membership.role === "dm" ? " · Game Master" : ""}
        </div>
      </div>

      <div className="mt-8">
        <NattauDiceRoller
          campaignId={access.membership.campaignId}
          currentUserId={access.userId}
          currentUserName={access.displayName}
          role={access.membership.role}
        />
      </div>
    </main>
  );
}
