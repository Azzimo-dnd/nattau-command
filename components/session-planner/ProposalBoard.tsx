"use client";

import { formatShortDate } from "./plannerDateUtils";
import type {
  ProposalVoteValue,
  SessionPlannerUser,
  SessionProposal,
} from "./plannerTypes";

type ProposalBoardProps = {
  proposals: SessionProposal[];
  currentUser: SessionPlannerUser;
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
    yes: "border-green-400 bg-green-500/20 text-green-200",
    maybe: "border-yellow-400 bg-yellow-500/20 text-yellow-200",
    no: "border-red-400 bg-red-500/20 text-red-200",
  };

  const idleClasses = {
    yes: "border-green-500/20 bg-green-500/5 text-green-300 hover:border-green-400/60",
    maybe:
      "border-yellow-500/20 bg-yellow-500/5 text-yellow-300 hover:border-yellow-400/60",
    no: "border-red-500/20 bg-red-500/5 text-red-300 hover:border-red-400/60",
  };

  return selected ? selectedClasses[vote] : idleClasses[vote];
}

export function ProposalBoard({
  proposals,
  currentUser,
  busyProposalId,
  onVote,
  onRemoveVote,
  onConfirm,
  onCancel,
}: ProposalBoardProps) {
  const activeProposals = proposals.filter(
    (proposal) => proposal.status === "voting" || proposal.status === "confirmed"
  );

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-purple-400">
            Group decision
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-100">
            Session Proposals
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            The Game Master may nominate the most promising dates. Players can
            answer Yes, Maybe or No until one date is confirmed.
          </p>
        </div>

        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-400">
          {activeProposals.length} visible
        </span>
      </div>

      {activeProposals.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/35 p-5 text-sm text-slate-500">
          No date is currently under consideration. Mark availability in the
          calendar so the best options become easy to spot.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {activeProposals.map((proposal) => {
            const ownVote = proposal.votes.find(
              (vote) => vote.voter_id === currentUser.id
            )?.vote;
            const yesVotes = proposal.votes.filter(
              (vote) => vote.vote === "yes"
            );
            const maybeVotes = proposal.votes.filter(
              (vote) => vote.vote === "maybe"
            );
            const noVotes = proposal.votes.filter(
              (vote) => vote.vote === "no"
            );
            const isBusy = busyProposalId === proposal.id;
            const isConfirmed = proposal.status === "confirmed";

            return (
              <article
                key={proposal.id}
                className={`rounded-2xl border p-5 transition ${
                  isConfirmed
                    ? "border-yellow-500/40 bg-yellow-500/10"
                    : "border-slate-800 bg-slate-950/55"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                      {isConfirmed ? "Confirmed session" : "Open vote"}
                    </p>
                    <h3 className="mt-2 text-xl font-black text-slate-100">
                      {formatShortDate(proposal.proposed_date)}
                    </h3>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${getModeClasses(
                      proposal.session_mode
                    )}`}
                  >
                    {getModeLabel(proposal.session_mode)}
                  </span>
                </div>

                {proposal.message && (
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    {proposal.message}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <VoteSummary
                    label="Yes"
                    value={yesVotes.length}
                    names={yesVotes.map((vote) => vote.voter_name)}
                    className="text-green-300"
                  />
                  <VoteSummary
                    label="Maybe"
                    value={maybeVotes.length}
                    names={maybeVotes.map((vote) => vote.voter_name)}
                    className="text-yellow-300"
                  />
                  <VoteSummary
                    label="No"
                    value={noVotes.length}
                    names={noVotes.map((vote) => vote.voter_name)}
                    className="text-red-300"
                  />
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
                                ? onRemoveVote(proposal.id)
                                : onVote(proposal.id, vote)
                            }
                            className={`rounded-xl border px-3 py-2 text-sm font-bold capitalize transition disabled:cursor-wait disabled:opacity-60 ${getVoteClasses(
                              vote,
                              selected
                            )}`}
                          >
                            {vote}
                          </button>
                        );
                      }
                    )}
                  </div>
                )}

                {!isConfirmed && currentUser.role === "dm" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onConfirm(proposal.id)}
                      className="rounded-xl border border-yellow-400/50 bg-yellow-500/15 px-4 py-2 text-sm font-bold text-yellow-200 transition hover:border-yellow-300 hover:bg-yellow-500/25 disabled:cursor-wait disabled:opacity-60"
                    >
                      Confirm as next session
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onCancel(proposal.id)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-400 transition hover:border-red-500/40 hover:text-red-300 disabled:cursor-wait disabled:opacity-60"
                    >
                      Cancel proposal
                    </button>
                  </div>
                )}

                {isConfirmed && (
                  <p className="mt-4 rounded-xl border border-yellow-500/20 bg-slate-950/50 px-3 py-2 text-xs leading-5 text-yellow-200">
                    Published to the main session countdown. The default time is
                    19:00 Europe/Warsaw and may be adjusted in Session Controls.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

type VoteSummaryProps = {
  label: string;
  value: number;
  names: string[];
  className: string;
};

function VoteSummary({ label, value, names, className }: VoteSummaryProps) {
  return (
    <div
      className="rounded-xl border border-slate-800 bg-slate-900/65 p-3 text-center"
      title={names.length > 0 ? names.join(", ") : `No ${label.toLowerCase()} votes`}
    >
      <p className={`text-2xl font-black ${className}`}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}
