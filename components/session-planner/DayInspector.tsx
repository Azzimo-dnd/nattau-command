"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { formatLongDate, isPastDate } from "./plannerDateUtils";
import type {
  AvailabilityEntry,
  PlannerMember,
  ProposalMode,
  SessionPlannerUser,
  SessionProposal,
} from "./plannerTypes";

type DayInspectorProps = {
  dateKey: string | null;
  members: PlannerMember[];
  availability: AvailabilityEntry[];
  proposals: SessionProposal[];
  currentUser: SessionPlannerUser;
  busy: boolean;
  onCreateProposal: (
    dateKey: string,
    mode: ProposalMode,
    message: string
  ) => Promise<void>;
};

export function DayInspector({
  dateKey,
  members,
  availability,
  proposals,
  currentUser,
  busy,
  onCreateProposal,
}: DayInspectorProps) {
  const [message, setMessage] = useState("");

  const entries = useMemo(
    () => availability.filter((entry) => entry.availability_date === dateKey),
    [availability, dateKey]
  );

  if (!dateKey) {
    return (
      <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 xl:sticky xl:top-6 xl:self-start">
        <p className="text-xs uppercase tracking-[0.32em] text-yellow-500">
          Day details
        </p>
        <h2 className="mt-2 text-xl font-black text-slate-100">
          Select a date
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Use the small details button inside a day to inspect every response.
          Painting availability also selects that date automatically.
        </p>
      </aside>
    );
  }

  const modeByUser = new Map(
    entries.map((entry) => [entry.user_id, entry.availability_mode])
  );

  const onlineMembers = members.filter((member) => {
    const mode = modeByUser.get(member.id);
    return mode === "online" || mode === "both";
  });
  const inPersonMembers = members.filter((member) => {
    const mode = modeByUser.get(member.id);
    return mode === "in_person" || mode === "both";
  });
  const unavailableMembers = members.filter(
    (member) => modeByUser.get(member.id) === "unavailable"
  );
  const noResponseMembers = members.filter(
    (member) => !modeByUser.has(member.id)
  );

  const pastDate = isPastDate(dateKey);

  const openOnline = proposals.some(
    (proposal) =>
      proposal.proposed_date === dateKey &&
      proposal.session_mode === "online" &&
      proposal.status === "voting"
  );
  const openInPerson = proposals.some(
    (proposal) =>
      proposal.proposed_date === dateKey &&
      proposal.session_mode === "in_person" &&
      proposal.status === "voting"
  );

  return (
    <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 xl:sticky xl:top-6 xl:self-start">
      <p className="text-xs uppercase tracking-[0.32em] text-yellow-500">
        Day details
      </p>
      <h2 className="mt-2 text-xl font-black text-slate-100">
        {formatLongDate(dateKey)}
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <CountCard
          label="Online"
          value={onlineMembers.length}
          total={members.length}
          className="text-blue-300"
        />
        <CountCard
          label="In person"
          value={inPersonMembers.length}
          total={members.length}
          className="text-emerald-300"
        />
      </div>

      <div className="mt-5 space-y-4">
        <MemberGroup
          title="Online"
          members={onlineMembers}
          className="border-blue-500/20 bg-blue-500/5"
        />
        <MemberGroup
          title="In person"
          members={inPersonMembers}
          className="border-emerald-500/20 bg-emerald-500/5"
        />
        <MemberGroup
          title="Unavailable"
          members={unavailableMembers}
          className="border-red-500/20 bg-red-500/5"
        />
        <MemberGroup
          title="No response"
          members={noResponseMembers}
          className="border-slate-700 bg-slate-950/35"
        />
      </div>

      {pastDate && (
        <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3 text-sm text-slate-500">
          This date is in the past. Availability and session proposals can no
          longer be changed.
        </div>
      )}

      {currentUser.role === "dm" && !pastDate && (
        <div className="mt-6 border-t border-slate-800 pt-5">
          <p className="text-xs uppercase tracking-[0.28em] text-purple-400">
            GM action
          </p>
          <h3 className="mt-2 font-bold text-slate-100">
            Propose this date
          </h3>
          <textarea
            value={message}
            maxLength={280}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setMessage(event.target.value)
            }
            placeholder="Optional note for the players"
            className="mt-3 min-h-20 w-full resize-none rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-purple-500"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <button
              type="button"
              disabled={busy || openOnline}
              onClick={() => onCreateProposal(dateKey, "online", message)}
              className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-200 transition hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {openOnline ? "Online vote open" : "Propose online"}
            </button>
            <button
              type="button"
              disabled={busy || openInPerson}
              onClick={() => onCreateProposal(dateKey, "in_person", message)}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-200 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {openInPerson ? "In-person vote open" : "Propose in person"}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function CountCard({
  label,
  value,
  total,
  className,
}: {
  label: string;
  value: number;
  total: number;
  className: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${className}`}>
        {value}/{total}
      </p>
    </div>
  );
}

function MemberGroup({
  title,
  members,
  className,
}: {
  title: string;
  members: PlannerMember[];
  className: string;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {title}
        </p>
        <span className="text-xs text-slate-500">{members.length}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {members.length === 0 ? (
          <span className="text-xs text-slate-600">Nobody</span>
        ) : (
          members.map((member) => (
            <span
              key={member.id}
              className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-300"
            >
              {member.display_name}
              {member.role === "dm" ? " · GM" : ""}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
