import Link from "next/link";
import type { CampaignSessionStatus } from "@/lib/campaign/sessionTypes";

type GmOverviewProps = {
  activeFateCycle: boolean;
  fateCycleNumber: number | null;
  fateDrawCount: number;
  playerCount: number;
  activeProposalCount: number;
  sessionStatus: CampaignSessionStatus;
  nextSessionAt: string | null;
};

function formatSessionDate(value: string | null) {
  if (!value) return "Not announced";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not announced";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function GmOverview({
  activeFateCycle,
  fateCycleNumber,
  fateDrawCount,
  playerCount,
  activeProposalCount,
  sessionStatus,
  nextSessionAt,
}: GmOverviewProps) {
  const sessionScheduled = sessionStatus === "scheduled" && nextSessionAt;

  return (
    <section className="rounded-3xl border border-purple-500/20 bg-purple-500/5 p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.32em] text-purple-300">
        GM Overview
      </p>
      <h2 className="mt-2 text-2xl font-black text-slate-100">
        Session Readiness
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm text-slate-500">Next session</p>
          <p
            className={`mt-2 text-xl font-black ${
              sessionScheduled ? "text-yellow-300" : "text-slate-300"
            }`}
          >
            {formatSessionDate(nextSessionAt)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {sessionScheduled ? "Published to players" : "Awaiting announcement"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm text-slate-500">Fate draws</p>
          <p className="mt-2 text-3xl font-black text-purple-300">
            {fateDrawCount} / {playerCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {activeFateCycle
              ? `Cycle ${fateCycleNumber ?? "—"}`
              : "No active cycle"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm text-slate-500">Council</p>
          <p className="mt-2 text-3xl font-black text-blue-300">
            {activeProposalCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">Active proposals</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/gm/session"
          className="inline-flex rounded-xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-200 transition hover:bg-yellow-500/15"
        >
          Session controls →
        </Link>
        <Link
          href="/fate"
          className="inline-flex rounded-xl border border-purple-500/25 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/15"
        >
          Fate controls →
        </Link>
        <Link
          href="/council/proposals"
          className="inline-flex rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-500/30 hover:text-blue-200"
        >
          Review proposals →
        </Link>
      </div>
    </section>
  );
}
