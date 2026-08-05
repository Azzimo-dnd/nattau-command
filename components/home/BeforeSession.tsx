import Link from "next/link";
import { NavIcon } from "@/components/navigation/NavIcon";
import type {
  AppRole,
  NavigationIconName,
} from "@/components/navigation/navigationTypes";
import type { FateState } from "@/lib/home/loadCommandCenterData";
import { CampaignChatUnreadBadge } from "@/components/notifications/CampaignChatNotifications";

type BeforeSessionProps = {
  role: AppRole;
  fateState: FateState;
  activeProposalCount: number;
  proposalsAwaitingVote: number;
  fateDrawCount: number;
  playerCount: number;
  plannerSummaryLoaded: boolean;
  plannerAvailabilityDays: number;
  plannerHasAvailability: boolean;
  plannerPlayersResponded: number;
  plannerMissingPlayerNames: string[];
  plannerOpenProposalCount: number;
  plannerVotesAwaiting: number;
  plannerPromisingDateCount: number;
  plannerResponseWindowDays: number;
};

type PreparationItem = {
  title: string;
  description: string;
  href: string;
  icon: NavigationIconName;
  badge: string;
  needsAttention: boolean;
  chatCampaignSlug?: string;
};

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return value === 1 ? singular : pluralForm;
}

function compactNames(names: string[]) {
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function BeforeSession({
  role,
  fateState,
  activeProposalCount,
  proposalsAwaitingVote,
  fateDrawCount,
  playerCount,
  plannerSummaryLoaded,
  plannerAvailabilityDays,
  plannerHasAvailability,
  plannerPlayersResponded,
  plannerMissingPlayerNames,
  plannerOpenProposalCount,
  plannerVotesAwaiting,
  plannerPromisingDateCount,
  plannerResponseWindowDays,
}: BeforeSessionProps) {
  const playerPlannerNeedsAttention =
    plannerSummaryLoaded &&
    (!plannerHasAvailability || plannerVotesAwaiting > 0);

  const playerPlannerDescription = !plannerSummaryLoaded
    ? "Open the shared calendar to mark availability and review proposed dates."
    : plannerVotesAwaiting > 0
      ? `${plannerVotesAwaiting} proposed session ${plural(
          plannerVotesAwaiting,
          "date"
        )} ${plural(plannerVotesAwaiting, "needs", "need")} your vote.`
      : !plannerHasAvailability
        ? `You have not marked any availability for the next ${plannerResponseWindowDays} days.`
        : `Availability submitted for ${plannerAvailabilityDays} future ${plural(
            plannerAvailabilityDays,
            "day"
          )}. All current session-date votes are complete.`;

  const playerPlannerBadge = !plannerSummaryLoaded
    ? "Open"
    : plannerVotesAwaiting > 0
      ? `${plannerVotesAwaiting} to vote`
      : !plannerHasAvailability
        ? "Mark dates"
        : "Completed";

  const playerItems: PreparationItem[] = [
    {
      title: "Session Planner",
      description: playerPlannerDescription,
      href: "/session-planner",
      icon: "session",
      badge: playerPlannerBadge,
      needsAttention: playerPlannerNeedsAttention,
    },
    {
      title: "Threads of Fate",
      description:
        fateState === "available"
          ? "Your card is waiting to be revealed."
          : fateState === "drawn"
            ? "Your blessing is ready for the next session."
            : "The next Fate Cycle has not started yet.",
      href: "/fate",
      icon: "fate",
      badge:
        fateState === "available"
          ? "Ready"
          : fateState === "drawn"
            ? "Completed"
            : "Inactive",
      needsAttention: fateState === "available",
    },
    {
      title: "Council Proposals",
      description:
        proposalsAwaitingVote > 0
          ? `${proposalsAwaitingVote} council ${plural(
              proposalsAwaitingVote,
              "proposal"
            )} may need your vote.`
          : "No active council proposal requires your vote.",
      href: "/council/proposals",
      icon: "proposal",
      badge:
        proposalsAwaitingVote > 0
          ? `${proposalsAwaitingVote} to review`
          : "Clear",
      needsAttention: proposalsAwaitingVote > 0,
    },
    {
      title: "GM Messages",
      description: "Open your private campaign channel with the Game Master.",
      href: "/gm-chat",
      icon: "chat",
      badge: "Open",
      needsAttention: false,
      chatCampaignSlug: "nattau",
    },
  ];

  const gmWaitingForFate = Math.max(0, playerCount - fateDrawCount);
  const gmWaitingForAvailability = Math.max(
    0,
    playerCount - plannerPlayersResponded
  );
  const missingNames = compactNames(plannerMissingPlayerNames);
  const gmPlannerNeedsAttention =
    plannerSummaryLoaded &&
    (gmWaitingForAvailability > 0 ||
      (plannerPromisingDateCount > 0 && plannerOpenProposalCount === 0));

  const gmPlannerDescription = !plannerSummaryLoaded
    ? "Review group availability and open the most convenient dates for voting."
    : `${plannerPlayersResponded} of ${playerCount} players responded. ${plannerPromisingDateCount} promising ${plural(
        plannerPromisingDateCount,
        "date"
      )}. ${plannerOpenProposalCount} open ${plural(
        plannerOpenProposalCount,
        "vote"
      )}.${missingNames ? ` Waiting: ${missingNames}.` : ""}`;

  const gmPlannerBadge = !plannerSummaryLoaded
    ? "Review"
    : gmWaitingForAvailability > 0
      ? `${gmWaitingForAvailability} waiting`
      : plannerPromisingDateCount > 0 && plannerOpenProposalCount === 0
        ? `${plannerPromisingDateCount} strong`
        : plannerOpenProposalCount > 0
          ? `${plannerOpenProposalCount} open`
          : "Clear";

  const gmItems: PreparationItem[] = [
    {
      title: "Session Planner",
      description: gmPlannerDescription,
      href: "/session-planner",
      icon: "session",
      badge: gmPlannerBadge,
      needsAttention: gmPlannerNeedsAttention,
    },
    {
      title: "Fate Management",
      description:
        playerCount > 0
          ? `${fateDrawCount} of ${playerCount} players have revealed a card.`
          : "No player profiles are currently available.",
      href: "/fate",
      icon: "fate",
      badge: playerCount > 0 ? `${gmWaitingForFate} waiting` : "No players",
      needsAttention: gmWaitingForFate > 0,
    },
    {
      title: "Council Proposals",
      description:
        activeProposalCount > 0
          ? `${activeProposalCount} active council ${plural(
              activeProposalCount,
              "proposal"
            )} await a decision.`
          : "There are no active council proposals.",
      href: "/council/proposals",
      icon: "proposal",
      badge: activeProposalCount > 0 ? `${activeProposalCount} active` : "Clear",
      needsAttention: activeProposalCount > 0,
    },
    {
      title: "Player Conversations",
      description: "Open private conversations with expedition members.",
      href: "/gm-chat",
      icon: "chat",
      badge: "Open",
      needsAttention: false,
      chatCampaignSlug: "nattau",
    },
  ];

  const items = role === "dm" ? gmItems : playerItems;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-yellow-500">
            Preparation
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-100">
            Before the Session
          </h2>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-yellow-300">
          <NavIcon name="session" className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-5 space-y-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-3 rounded-2xl border border-transparent bg-slate-950/40 p-3 transition hover:border-slate-700 hover:bg-slate-950/75"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                item.needsAttention
                  ? "border-yellow-500/25 bg-yellow-500/10 text-yellow-300"
                  : "border-green-500/20 bg-green-500/5 text-green-300"
              }`}
            >
              <NavIcon name={item.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-100">
                {item.title}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {item.description}
              </span>
            </span>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${
                item.needsAttention
                  ? "border-yellow-500/25 bg-yellow-500/5 text-yellow-300"
                  : "border-green-500/20 bg-green-500/5 text-green-300"
              }`}
            >
              {item.chatCampaignSlug ? (
                <span className="flex items-center gap-1.5">
                  <CampaignChatUnreadBadge
                    campaignSlug={item.chatCampaignSlug}
                    theme="nattau"
                  />
                  <span>{item.badge}</span>
                </span>
              ) : (
                item.badge
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
