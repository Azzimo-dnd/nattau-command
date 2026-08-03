import Link from "next/link";
import { SessionPlanner } from "@/components/session-planner/SessionPlanner";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export default async function NattauSessionPlannerPage() {
  const access = await requireCampaignMembership("nattau");

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-3 py-6 text-slate-100 sm:px-6 sm:py-8 xl:px-8">
      <Link
        href="/campaigns/nattau"
        className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
      >
        ← Back to Command Center
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Between Sessions
          </p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">
            Session Planner
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Mark the days when you can play. Desktop users may paint with the
            mouse; phones use stable multi-select without drag gestures.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-400">
          Signed in as
          <strong className="ml-1 text-slate-100">{access.displayName}</strong>
          {access.membership.role === "dm" ? " · Game Master" : ""}
        </div>
      </div>

      <div className="mt-8">
        <SessionPlanner
          campaignSlug="nattau"
          variant="nattau"
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
