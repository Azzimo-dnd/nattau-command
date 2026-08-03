"use client";

import { useMemo } from "react";
import {
  formatShortDate,
  getMonthDateKeys,
  isPastDate,
} from "./plannerDateUtils";
import { getPlannerTheme } from "./plannerTheme";
import type {
  AvailabilityEntry,
  PlannerMember,
  PlannerVariant,
  ProposalMode,
  SessionPlannerUser,
  SessionProposal,
} from "./plannerTypes";

type BestDatesProps = {
  variant: PlannerVariant;
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
  return mode === "online"
    ? availabilityMode === "online" || availabilityMode === "both"
    : availabilityMode === "in_person" || availabilityMode === "both";
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

  for (const entry of availability) {
    if (!memberIds.has(entry.user_id)) continue;
    const current = entriesByDate.get(entry.availability_date) ?? [];
    current.push(entry);
    entriesByDate.set(entry.availability_date, current);
  }

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

export function BestDates({
  variant,
  month,
  members,
  availability,
  proposals,
  currentUser,
  busy,
  onInspect,
  onCreateProposal,
}: BestDatesProps) {
  const theme = getPlannerTheme(variant);
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
    <section className={`rounded-3xl border p-5 shadow-2xl shadow-black/20 sm:p-6 ${theme.panel}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={`text-xs uppercase tracking-[0.32em] ${theme.accentText}`}>
            {theme.bestEyebrow}
          </p>
          <h2 className={`mt-2 text-2xl font-black ${theme.heading}`}>
            {theme.bestTitle}
          </h2>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${theme.subtle}`}>
            {theme.bestDescription} Test profiles are not included in the score.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-xs ${theme.panelMuted} ${theme.body}`}>
          {members.length} player{members.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <CandidateColumn
          variant={variant}
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
          variant={variant}
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
  variant: PlannerVariant;
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
  variant,
  title,
  mode,
  candidates,
  totalPlayers,
  currentUser,
  busy,
  onInspect,
  onCreateProposal,
}: CandidateColumnProps) {
  const theme = getPlannerTheme(variant);
  const modeClasses =
    mode === "online"
      ? "border-blue-500/25 bg-blue-500/5"
      : "border-emerald-500/25 bg-emerald-500/5";

  return (
    <div className={`rounded-2xl border p-4 ${modeClasses}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={`font-black ${theme.heading}`}>{title}</h3>
        <span className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
          Top {MAX_RESULTS_PER_MODE}
        </span>
      </div>

      {candidates.length === 0 ? (
        <div className={`mt-4 rounded-xl border border-dashed p-4 text-sm leading-6 ${theme.panelMuted} ${theme.subtle}`}>
          No future date in this month has a positive response for this format yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {candidates.map((candidate, index) => (
            <CandidateCard
              key={`${candidate.dateKey}-${candidate.mode}`}
              variant={variant}
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
  variant: PlannerVariant;
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
  variant,
  candidate,
  rank,
  totalPlayers,
  currentUser,
  busy,
  onInspect,
  onCreateProposal,
}: CandidateCardProps) {
  const theme = getPlannerTheme(variant);
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
    if (accepted) {
      await onCreateProposal(candidate.dateKey, candidate.mode, "");
    }
  }

  return (
    <article className={`rounded-2xl border p-4 ${theme.panelMuted}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black ${theme.accentBorder} ${theme.accentSoft} ${theme.accentText}`}>
            {rank}
          </span>
          <div className="min-w-0">
            <h4 className={`font-black ${theme.heading}`}>
              {formatShortDate(candidate.dateKey)}
            </h4>
            <p className={`mt-1 text-sm ${theme.body}`}>
              {availableCount}/{totalPlayers} players available
            </p>
          </div>
        </div>

        {(hasOpenProposal || isConfirmed) && (
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${isConfirmed ? theme.confirmAccent : theme.voteAccent}`}>
            {isConfirmed ? "Confirmed" : "Vote open"}
          </span>
        )}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/35">
        <div
          className={`h-full rounded-full ${candidate.mode === "online" ? "bg-blue-400" : "bg-emerald-400"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <p className={`rounded-xl border px-3 py-2 ${theme.panelMuted} ${theme.subtle}`}>
          <span className={theme.body}>No response:</span>{" "}
          {candidate.noResponseMembers.length === 0
            ? "None"
            : candidate.noResponseMembers.map((member) => member.display_name).join(", ")}
        </p>
        <p className={`rounded-xl border px-3 py-2 ${theme.panelMuted} ${theme.subtle}`}>
          <span className={theme.body}>Unavailable:</span>{" "}
          {candidate.unavailableMembers.length}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onInspect(candidate.dateKey)}
          className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-bold ${theme.panelMuted} ${theme.body}`}
        >
          Review day
        </button>
        {currentUser.role === "dm" && !candidate.proposalStatus && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void proposeDate()}
            className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50 ${theme.voteAccent}`}
          >
            Open for vote
          </button>
        )}
      </div>
    </article>
  );
}
