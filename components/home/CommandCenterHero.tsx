import { NavIcon } from "@/components/navigation/NavIcon";
import type { AppRole } from "@/components/navigation/navigationTypes";
import type { CampaignSessionStatus } from "@/lib/campaign/sessionTypes";
import { NextSessionCountdown } from "./NextSessionCountdown";

type CommandCenterHeroProps = {
  displayName: string;
  role: AppRole;
  sessionStatus: CampaignSessionStatus;
  nextSessionAt: string | null;
  sessionMessage: string;
};

export function CommandCenterHero({
  displayName,
  role,
  sessionStatus,
  nextSessionAt,
  sessionMessage,
}: CommandCenterHeroProps) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-yellow-500/15 bg-slate-900/70 p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-yellow-500/5 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.34em] text-yellow-500">
            Command Center
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-100 sm:text-5xl">
            Welcome, {displayName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            {role === "dm"
              ? "Review the expedition and prepare the next chapter."
              : "Everything that may need your attention before the next session is collected below."}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-1 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-yellow-300 xl:flex">
            <NavIcon name="session" className="h-5 w-5" />
          </span>
          <NextSessionCountdown
            status={sessionStatus}
            target={nextSessionAt}
            message={sessionMessage}
          />
        </div>
      </div>
    </header>
  );
}
