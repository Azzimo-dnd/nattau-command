import Link from "next/link";
import { NavIcon } from "@/components/navigation/NavIcon";
import type {
  AppRole,
  NavigationIconName,
} from "@/components/navigation/navigationTypes";
import type { FateState } from "@/lib/home/loadCommandCenterData";

type BeforeSessionProps = {
  role: AppRole;
  fateState: FateState;
  activeProposalCount: number;
  proposalsAwaitingVote: number;
  fateDrawCount: number;
  playerCount: number;
};

type PreparationItem = {
  title: string;
  description: string;
  href: string;
  icon: NavigationIconName;
  badge: string;
  needsAttention: boolean;
};

export function BeforeSession({
  role,
  fateState,
  activeProposalCount,
  proposalsAwaitingVote,
  fateDrawCount,
  playerCount,
}: BeforeSessionProps) {
  const playerItems: PreparationItem[] = [
    {
      title: "Session Planner",
      description:
        "Mark the days when you can play and review the group availability calendar.",
      href: "/session-planner",
      icon: "session",
      badge: "Update",
      needsAttention: true,
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
          ? `${proposalsAwaitingVote} proposal${proposalsAwaitingVote === 1 ? "" : "s"} may need your vote.`
          : "No active proposal requires your vote.",
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
    },
  ];

  const gmWaiting = Math.max(0, playerCount - fateDrawCount);
  const gmItems: PreparationItem[] = [
    {
      title: "Session Planner",
      description:
        "Review group availability and open the most convenient dates for voting.",
      href: "/session-planner",
      icon: "session",
      badge: "Review",
      needsAttention: false,
    },
    {
      title: "Fate Management",
      description:
        playerCount > 0
          ? `${fateDrawCount} of ${playerCount} players have revealed a card.`
          : "No player profiles are currently available.",
      href: "/fate",
      icon: "fate",
      badge: playerCount > 0 ? `${gmWaiting} waiting` : "No players",
      needsAttention: gmWaiting > 0,
    },
    {
      title: "Council Proposals",
      description:
        activeProposalCount > 0
          ? `${activeProposalCount} active proposal${activeProposalCount === 1 ? "" : "s"} await a decision.`
          : "There are no active proposals.",
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
              <span className="mt-1 block text-xs leading-5 text-slate-500 sm:truncate">
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
              {item.badge}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
