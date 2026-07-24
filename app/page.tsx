import { redirect } from "next/navigation";
import { BeforeSession } from "@/components/home/BeforeSession";
import { CommandCenterHero } from "@/components/home/CommandCenterHero";
import { GmOverview } from "@/components/home/GmOverview";
import { HomeShortcuts } from "@/components/home/HomeShortcuts";
import { RecentCampaignEvents } from "@/components/home/RecentCampaignEvents";
import { campaignConfig } from "@/config/campaign";
import { loadCommandCenterData } from "@/lib/home/loadCommandCenterData";

export default async function CommandCenterPage() {
  const data = await loadCommandCenterData();

  if (!data) {
    redirect("/login");
  }

  const fateStatus =
    data.role === "dm"
      ? data.activeFateCycle
        ? `${data.fateDrawCount} / ${data.playerCount} drawn`
        : "No active cycle"
      : data.fateState === "available"
        ? "Card available"
        : data.fateState === "drawn"
          ? "Blessing revealed"
          : "No active cycle";

  const councilStatus =
    data.role === "dm"
      ? `${data.activeProposalCount} active`
      : `${data.proposalsAwaitingVote} to review`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <CommandCenterHero
        displayName={data.displayName}
        role={data.role}
        sessionStatus={data.sessionStatus}
        nextSessionAt={data.nextSessionAt}
        sessionMessage={data.sessionMessage}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <BeforeSession
          role={data.role}
          fateState={data.fateState}
          activeProposalCount={data.activeProposalCount}
          proposalsAwaitingVote={data.proposalsAwaitingVote}
          fateDrawCount={data.fateDrawCount}
          playerCount={data.playerCount}
        />

        {data.role === "dm" ? (
          <GmOverview
            activeFateCycle={data.activeFateCycle}
            fateCycleNumber={data.fateCycleNumber}
            fateDrawCount={data.fateDrawCount}
            playerCount={data.playerCount}
            activeProposalCount={data.activeProposalCount}
            sessionStatus={data.sessionStatus}
            nextSessionAt={data.nextSessionAt}
          />
        ) : (
          <RecentCampaignEvents events={campaignConfig.recentEvents} />
        )}
      </div>

      {data.role === "dm" && (
        <div className="mt-6">
          <RecentCampaignEvents events={campaignConfig.recentEvents} />
        </div>
      )}

      <div className="mt-8">
        <HomeShortcuts
          fateStatus={fateStatus}
          councilStatus={councilStatus}
          chatStatus="Open channel"
        />
      </div>
    </main>
  );
}
