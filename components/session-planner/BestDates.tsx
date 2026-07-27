"use client";

import { useMemo } from "react";
import {
  formatShortDate,
  getMonthDateKeys,
  isPastDate,
} from "./plannerDateUtils";
import type {
  AvailabilityEntry,
  PlannerMember,
  ProposalMode,
  SessionPlannerUser,
  SessionProposal,
} from "./plannerTypes";

type BestDatesProps = {
  month: Date;
  members: PlannerMember[];
  availability: AvailabilityEntry[];
  proposals: SessionProposal[];
  currentUser: SessionPlannerUser;
  busy: boolean;
  onInspect: (dateKey: string) => void;
  onCreateProposal: (
    dateKey: string,
    mode: ProposalMode,
    message: string
  ) => Promise<void>;
};

type Candidate = {
  dateKey: string;
  mode: ProposalMode;
  availableMembers: PlannerMember[];
  unavailableMembers: PlannerMember[];
  noResponseMembers: PlannerMember[];
  proposalStatus: "voting" | "confirmed" | null;
};

const MAX_RESULTS_PER_MODE = 3;

function modeMatchesAvailability(
  mode: ProposalMode,
  availabilityMode: AvailabilityEntry["availability_mode"] | undefined
) {
  if (mode === "online") {
    return availabilityMode === "online" || availabilityMode === "both";
  }

  return availabilityMode === "in_person" || availabilityMode === "both";
}

function buildCandidates({
  month,
  mode,
  members,
  availability,
  proposals,
}: {
  month: Date;
  mode: ProposalMode;
  members: PlannerMember[];
  availability: AvailabilityEntry[];
  proposals: SessionProposal[];
}) {
  const memberIds = new Set(members.map((member) => member.id));
  const entriesByDate = new Map<string, AvailabilityEntry[]>();

  availability.forEach((entry) => {
    if (!memberIds.has(entry.user_id)) return;

    const current = entriesByDate.get(entry.availability_date) ?? [];
    current.push(entry);
    entriesByDate.set(entry.availability_date, current);
  });

  return getMonthDateKeys(month)
    .filter((dateKey) => !isPastDate(dateKey))
    .map<Candidate>((dateKey) => {
      const dayEntries = entriesByDate.get(dateKey) ?? [];
      const modeByUser = new Map(
        dayEntries.map((entry) => [entry.user_id, entry.availability_mode])
      );

      const availableMembers = members.filter((member) =>
        modeMatchesAvailability(mode, modeByUser.get(member.id))
      );
      const unavailableMembers = members.filter(
        (member) => modeByUser.get(member.id) === "unavailable"
      );
      const noResponseMembers = members.filter(
        (member) => !modeByUser.has(member.id)
      );
      const matchingProposal = proposals.find(
        (proposal) =>
          proposal.proposed_date === dateKey &&
          proposal.session_mode === mode &&
          (proposal.status === "voting" || proposal.status === "confirmed")
      );

      return {
        dateKey,
        mode,
        availableMembers,
        unavailableMembers,
        noResponseMembers,
        proposalStatus:
          matchingProposal?.status === "voting" ||
          matchingProposal?.status === "confirmed"
            ? matchingProposal.status
            : null,
      };
    })
    .filter((candidate) => candidate.availableMembers.length > 0)
    .sort((left, right) => {
      const availabilityDifference =
        right.availableMembers.length - left.availableMembers.length;

      if (availabilityDifference !== 0) return availabilityDifference;

      const responseDifference =
        left.noResponseMembers.length - right.noResponseMembers.length;

      if (responseDifference !== 0) return responseDifference;

      const unavailableDifference =
        left.unavailableMembers.length - right.unavailableMembers.length;

      if (unavailableDifference !== 0) return unavailableDifference;

      return left.dateKey.localeCompare(right.dateKey);
    })
    .slice(0, MAX_RESULTS_PER_MODE);
}

function getModeLabel(mode: ProposalMode) {
  return mode === "online" ? "Online" : "In person";
}

function getModeClasses(mode: ProposalMode) {
  return mode === "online"
    ? "border-blue-500/25 bg-blue-500/5 text-blue-300"
    : "border-emerald-500/25 bg-emerald-500/5 text-emerald-300";
}

function namesLabel(members: PlannerMember[]) {
  if (members.length === 0) return "None";
  return members.map((member) => member.display_name).join(", ");
}

export function BestDates({
  month,
  members,
  availability,
  proposals,
  currentUser,
  busy,
  onInspect,
  onCreateProposal,
}: BestDatesProps) {
  const onlineCandidates = useMemo(
    () =>
      buildCandidates({
        month,
        mode: "online",
        members,
        availability,
        proposals,
      }),
    [availability, members, month, proposals]
  );

  const inPersonCandidates = useMemo(
    () =>
      buildCandidates({
        month,
        mode: "in_person",
        members,
        availability,
        proposals,
      }),
    [availability, members, month, proposals]
  );

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-yellow-500">
            Group availability
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-100">
            Best Dates
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            The strongest dates in the visible month, ranked separately for
            online and in-person sessions. Only player responses are included
            in the score.
          </p>
        </div>

        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-400">
          {members.length} player{members.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <CandidateColumn
          title="Online"
          mode="online"
          candidates={onlineCandidates}
          totalPlayers={members.length}
          currentUser={currentUser}
          busy={busy}
          onInspect={onInspect}
          onCreateProposal={onCreateProposal}
        />
        <CandidateColumn
          title="In person"
          mode="in_person"
          candidates={inPersonCandidates}
          totalPlayers={members.length}
          currentUser={currentUser}
          busy={busy}
          onInspect={onInspect}
          onCreateProposal={onCreateProposal}
        />
      </div>
    </section>
  );
}

type CandidateColumnProps = {
  title: string;
  mode: ProposalMode;
  candidates: Candidate[];
  totalPlayers: number;
  currentUser: SessionPlannerUser;
  busy: boolean;
  onInspect: (dateKey: string) => void;
  onCreateProposal: (
    dateKey: string,
    mode: ProposalMode,
    message: string
  ) => Promise<void>;
};

function CandidateColumn({
  title,
  mode,
  candidates,
  totalPlayers,
  currentUser,
  busy,
  onInspect,
  onCreateProposal,
}: CandidateColumnProps) {
  return (
    <div className={`rounded-2xl border p-4 ${getModeClasses(mode)}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black text-slate-100">{title}</h3>
        <span className="text-xs uppercase tracking-wider text-slate-500">
          Top {MAX_RESULTS_PER_MODE}
        </span>
      </div>

      {candidates.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/35 p-4 text-sm leading-6 text-slate-500">
          No future date in this month has a positive availability response for
          this session format yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {candidates.map((candidate, index) => (
            <CandidateCard
              key={`${candidate.dateKey}-${candidate.mode}`}
              candidate={candidate}
              rank={index + 1}
              totalPlayers={totalPlayers}
              currentUser={currentUser}
              busy={busy}
              onInspect={onInspect}
              onCreateProposal={onCreateProposal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type CandidateCardProps = {
  candidate: Candidate;
  rank: number;
  totalPlayers: number;
  currentUser: SessionPlannerUser;
  busy: boolean;
  onInspect: (dateKey: string) => void;
  onCreateProposal: (
    dateKey: string,
    mode: ProposalMode,
    message: string
  ) => Promise<void>;
};

function CandidateCard({
  candidate,
  rank,
  totalPlayers,
  currentUser,
  busy,
  onInspect,
  onCreateProposal,
}: CandidateCardProps) {
  const availableCount = candidate.availableMembers.length;
  const percentage =
    totalPlayers > 0 ? Math.round((availableCount / totalPlayers) * 100) : 0;
  const hasOpenProposal = candidate.proposalStatus === "voting";
  const isConfirmed = candidate.proposalStatus === "confirmed";

  async function proposeDate() {
    const accepted = window.confirm(
      `Open ${formatShortDate(candidate.dateKey)} for an ${getModeLabel(
        candidate.mode
      ).toLowerCase()} session vote?`
    );

    if (!accepted) return;
    await onCreateProposal(candidate.dateKey, candidate.mode, "");
  }

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4 text-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-yellow-500/25 bg-yellow-500/10 text-xs font-black text-yellow-300">
            {rank}
          </span>
          <div className="min-w-0">
            <h4 className="font-black text-slate-100">
              {formatShortDate(candidate.dateKey)}
            </h4>
            <p className="mt-1 text-sm text-slate-400">
              {availableCount}/{totalPlayers} players available
            </p>
          </div>
        </div>

        {(hasOpenProposal || isConfirmed) && (
          <span
            className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
              isConfirmed
                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                : "border-purple-500/30 bg-purple-500/10 text-purple-300"
            }`}
          >
            {isConfirmed ? "Confirmed" : "Vote open"}
          </span>
        )}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${
            candidate.mode === "online" ? "bg-blue-400" : "bg-emerald-400"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-500">
          <span className="font-bold text-slate-400">No response:</span>{" "}
          <span title={namesLabel(candidate.noResponseMembers)}>
            {candidate.noResponseMembers.length === 0
              ? "None"
              : namesLabel(candidate.noResponseMembers)}
          </span>
        </p>
        <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-500">
          <span className="font-bold text-slate-400">Unavailable:</span>{" "}
          {candidate.unavailableMembers.length}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onInspect(candidate.dateKey)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-yellow-500/40 hover:text-yellow-200"
        >
          Review day
        </button>

        {currentUser.role === "dm" && !candidate.proposalStatus && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void proposeDate()}
            className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-200 transition hover:border-purple-400 disabled:cursor-wait disabled:opacity-50"
          >
            Open for vote
          </button>
        )}
      </div>
    </article>
  );
}
