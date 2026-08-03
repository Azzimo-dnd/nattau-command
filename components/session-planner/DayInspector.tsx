"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { formatLongDate, isPastDate } from "./plannerDateUtils";
import { getPlannerTheme } from "./plannerTheme";
import type {
  AvailabilityEntry,
  PlannerMember,
  PlannerVariant,
  ProposalMode,
  SessionPlannerUser,
  SessionProposal,
} from "./plannerTypes";

type DayInspectorProps = {
  variant: PlannerVariant;
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
  variant,
  dateKey,
  members,
  availability,
  proposals,
  currentUser,
  busy,
  onCreateProposal,
}: DayInspectorProps) {
  const [message, setMessage] = useState("");
  const theme = getPlannerTheme(variant);

  const entries = useMemo(
    () => availability.filter((entry) => entry.availability_date === dateKey),
    [availability, dateKey]
  );

  if (!dateKey) {
    return (
      <aside className={`rounded-3xl border p-5 xl:sticky xl:top-6 xl:self-start ${theme.panel}`}>
        <p className={`text-xs uppercase tracking-[0.32em] ${theme.accentText}`}>
          {theme.detailsEyebrow}
        </p>
        <h2 className={`mt-2 text-xl font-black ${theme.heading}`}>
          Select a date
        </h2>
        <p className={`mt-3 text-sm leading-6 ${theme.subtle}`}>
          Use the small information button inside a day to inspect every
          response. On phones, tapping the day itself adds it to the stable
          multi-selection instead.
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
    <aside className={`rounded-3xl border p-5 xl:sticky xl:top-6 xl:self-start ${theme.panel}`}>
      <p className={`text-xs uppercase tracking-[0.32em] ${theme.accentText}`}>
        {theme.detailsEyebrow}
      </p>
      <h2 className={`mt-2 text-xl font-black ${theme.heading}`}>
        {formatLongDate(dateKey)}
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <CountCard
          label="Online"
          value={onlineMembers.length}
          total={members.length}
          className="text-blue-300"
          variant={variant}
        />
        <CountCard
          label="In person"
          value={inPersonMembers.length}
          total={members.length}
          className="text-emerald-300"
          variant={variant}
        />
      </div>

      <div className="mt-5 space-y-4">
        <MemberGroup title="Online" members={onlineMembers} className="border-blue-500/20 bg-blue-500/5" variant={variant} />
        <MemberGroup title="In person" members={inPersonMembers} className="border-emerald-500/20 bg-emerald-500/5" variant={variant} />
        <MemberGroup title="Unavailable" members={unavailableMembers} className="border-red-500/20 bg-red-500/5" variant={variant} />
        <MemberGroup title="No response" members={noResponseMembers} className={theme.panelMuted} variant={variant} />
      </div>

      {pastDate && (
        <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${theme.panelMuted} ${theme.subtle}`}>
          This date is in the past. Availability and session proposals can no
          longer be changed.
        </div>
      )}

      {currentUser.role === "dm" && !pastDate && (
        <div className={`mt-6 border-t pt-5 ${theme.border}`}>
          <p className={`text-xs uppercase tracking-[0.28em] ${theme.accentText}`}>
            GM action
          </p>
          <h3 className={`mt-2 font-bold ${theme.heading}`}>
            {variant === "barovia" ? "Call this night to a vote" : "Propose this date"}
          </h3>
          <textarea
            value={message}
            maxLength={280}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setMessage(event.target.value)
            }
            placeholder={variant === "barovia" ? "Optional message from beyond the Mists" : "Optional note for the players"}
            className={`mt-3 min-h-20 w-full resize-none rounded-xl border bg-black/35 px-3 py-2 text-sm outline-none transition placeholder:opacity-50 ${theme.border} ${theme.heading}`}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <button
              type="button"
              disabled={busy || openOnline}
              onClick={() => void onCreateProposal(dateKey, "online", message)}
              className="min-h-11 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-200 transition hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {openOnline ? "Online vote open" : "Propose online"}
            </button>
            <button
              type="button"
              disabled={busy || openInPerson}
              onClick={() => void onCreateProposal(dateKey, "in_person", message)}
              className="min-h-11 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-200 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
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
  variant,
}: {
  label: string;
  value: number;
  total: number;
  className: string;
  variant: PlannerVariant;
}) {
  const theme = getPlannerTheme(variant);
  return (
    <div className={`rounded-2xl border p-4 ${theme.panelMuted}`}>
      <p className={`text-xs uppercase tracking-wider ${theme.subtle}`}>{label}</p>
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
  variant,
}: {
  title: string;
  members: PlannerMember[];
  className: string;
  variant: PlannerVariant;
}) {
  const theme = getPlannerTheme(variant);
  return (
    <div className={`rounded-2xl border p-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs font-bold uppercase tracking-wider ${theme.body}`}>
          {title}
        </p>
        <span className={`text-xs ${theme.subtle}`}>{members.length}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {members.length === 0 ? (
          <span className={`text-xs ${theme.subtle}`}>Nobody</span>
        ) : (
          members.map((member) => (
            <span
              key={member.id}
              className={`rounded-full border bg-black/25 px-2 py-1 text-xs ${theme.border} ${theme.body}`}
            >
              {member.display_name}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
