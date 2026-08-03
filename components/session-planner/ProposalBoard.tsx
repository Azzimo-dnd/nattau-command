"use client";

import { formatShortDate } from "./plannerDateUtils";
import { getPlannerTheme } from "./plannerTheme";
import type {
  PlannerVariant,
  ProposalVoteValue,
  SessionPlannerUser,
  SessionProposal,
} from "./plannerTypes";

type ProposalBoardProps = {
  variant: PlannerVariant;
  proposals: SessionProposal[];
  currentUser: SessionPlannerUser;
  eligibleVoterIds: string[];
  currentUserCountsTowardPlanning: boolean;
  busyProposalId: string | null;
  onVote: (proposalId: string, vote: ProposalVoteValue) => Promise<void>;
  onRemoveVote: (proposalId: string) => Promise<void>;
  onConfirm: (proposalId: string) => Promise<void>;
  onCancel: (proposalId: string) => Promise<void>;
};

function getModeLabel(mode: SessionProposal["session_mode"]) {
  return mode === "online" ? "Online" : "In person";
}

function getModeClasses(mode: SessionProposal["session_mode"]) {
  return mode === "online"
    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function getVoteClasses(vote: ProposalVoteValue, selected: boolean) {
  const selectedClasses = {
    yes: "border-green-400 bg-green-500/20 text-green-100",
    maybe: "border-yellow-400 bg-yellow-500/20 text-yellow-100",
    no: "border-red-400 bg-red-500/20 text-red-100",
  };
  const idleClasses = {
    yes: "border-green-500/25 bg-green-500/5 text-green-300",
    maybe: "border-yellow-500/25 bg-yellow-500/5 text-yellow-300",
    no: "border-red-500/25 bg-red-500/5 text-red-300",
  };
  return selected ? selectedClasses[vote] : idleClasses[vote];
}

export function ProposalBoard({
  variant,
  proposals,
  currentUser,
  eligibleVoterIds,
  currentUserCountsTowardPlanning,
  busyProposalId,
  onVote,
  onRemoveVote,
  onConfirm,
  onCancel,
}: ProposalBoardProps) {
  const theme = getPlannerTheme(variant);
  const activeProposals = proposals.filter(
    (proposal) => proposal.status === "voting" || proposal.status === "confirmed"
  );
  const eligibleVoterIdSet = new Set(eligibleVoterIds);

  return (
    <section className={`rounded-3xl border p-5 shadow-2xl shadow-black/20 sm:p-6 ${theme.panel}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={`text-xs uppercase tracking-[0.32em] ${theme.accentText}`}>
            {theme.proposalEyebrow}
          </p>
          <h2 className={`mt-2 text-2xl font-black ${theme.heading}`}>
            {theme.proposalTitle}
          </h2>
          <p className={`mt-2 max-w-2xl text-sm leading-6 ${theme.subtle}`}>
            {theme.proposalDescription}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-xs ${theme.panelMuted} ${theme.body}`}>
          {activeProposals.length} visible
        </span>
      </div>

      {activeProposals.length === 0 ? (
        <div className={`mt-5 rounded-2xl border border-dashed p-5 text-sm ${theme.panelMuted} ${theme.subtle}`}>
          No date is currently under consideration. Mark availability so the
          strongest options become easy to see.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {activeProposals.map((proposal) => {
            const ownVote = proposal.votes.find(
              (vote) => vote.voter_id === currentUser.id
            )?.vote;
            const countedVotes = proposal.votes.filter((vote) =>
              eligibleVoterIdSet.has(vote.voter_id)
            );
            const yesVotes = countedVotes.filter((vote) => vote.vote === "yes");
            const maybeVotes = countedVotes.filter(
              (vote) => vote.vote === "maybe"
            );
            const noVotes = countedVotes.filter((vote) => vote.vote === "no");
            const isBusy = busyProposalId === proposal.id;
            const isConfirmed = proposal.status === "confirmed";

            return (
              <article
                key={proposal.id}
                className={`rounded-2xl border p-5 transition ${
                  isConfirmed ? theme.confirmAccent : theme.panelMuted
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.28em] ${theme.subtle}`}>
                      {isConfirmed
                        ? variant === "barovia"
                          ? "Chosen by the Mists"
                          : "Confirmed session"
                        : "Open vote"}
                    </p>
                    <h3 className={`mt-2 text-xl font-black ${theme.heading}`}>
                      {formatShortDate(proposal.proposed_date)}
                    </h3>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${getModeClasses(proposal.session_mode)}`}>
                    {getModeLabel(proposal.session_mode)}
                  </span>
                </div>

                {proposal.message && (
                  <p className={`mt-4 text-sm leading-6 ${theme.body}`}>
                    {proposal.message}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <VoteSummary label="Yes" value={yesVotes.length} names={yesVotes.map((vote) => vote.voter_name)} className="text-green-300" variant={variant} />
                  <VoteSummary label="Maybe" value={maybeVotes.length} names={maybeVotes.map((vote) => vote.voter_name)} className="text-yellow-300" variant={variant} />
                  <VoteSummary label="No" value={noVotes.length} names={noVotes.map((vote) => vote.voter_name)} className="text-red-300" variant={variant} />
                </div>

                {!isConfirmed && currentUser.role === "player" && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(["yes", "maybe", "no"] as ProposalVoteValue[]).map(
                      (vote) => {
                        const selected = ownVote === vote;
                        return (
                          <button
                            key={vote}
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              selected
                                ? void onRemoveVote(proposal.id)
                                : void onVote(proposal.id, vote)
                            }
                            className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold capitalize transition disabled:opacity-60 ${getVoteClasses(vote, selected)}`}
                          >
                            {vote}
                          </button>
                        );
                      }
                    )}
                  </div>
                )}

                {!isConfirmed &&
                  currentUser.role === "player" &&
                  !currentUserCountsTowardPlanning && (
                    <p className="mt-3 text-xs leading-5 text-cyan-300">
                      Your test vote is saved for interface testing but is not
                      included in the totals above.
                    </p>
                  )}

                {!isConfirmed && currentUser.role === "dm" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onConfirm(proposal.id)}
                      className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-60 ${theme.confirmAccent}`}
                    >
                      Confirm this date
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onCancel(proposal.id)}
                      className="min-h-11 rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-2 text-sm font-bold text-red-300 disabled:opacity-60"
                    >
                      Cancel proposal
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VoteSummary({
  label,
  value,
  names,
  className,
  variant,
}: {
  label: string;
  value: number;
  names: string[];
  className: string;
  variant: PlannerVariant;
}) {
  const theme = getPlannerTheme(variant);
  return (
    <div
      className={`rounded-xl border p-3 text-center ${theme.panelMuted}`}
      title={names.length > 0 ? names.join(", ") : "Nobody"}
    >
      <p className={`text-[10px] uppercase tracking-wider ${theme.subtle}`}>
        {label}
      </p>
      <p className={`mt-1 text-xl font-black ${className}`}>{value}</p>
    </div>
  );
}
