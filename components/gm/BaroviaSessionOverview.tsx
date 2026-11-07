import Link from "next/link";
import type { ReactNode } from "react";
import type { BaroviaSessionOverview as Overview, OmenReadiness } from "@/lib/campaign/baroviaSessionDesk";
import type { CampaignSessionSettings } from "@/lib/campaign/sessionTypes";
import { SessionDeskRefresh } from "./SessionDeskRefresh";

const panel = "rounded-2xl border border-[#49303b] bg-[#170f16] p-5 sm:p-6";
const muted = "text-sm leading-6 text-[#ad97a2]";
const link = "inline-flex min-h-11 items-center rounded-xl border border-[#75465c] bg-[#341b29] px-4 text-sm font-bold text-[#e9c6d6] transition hover:border-[#b36d8d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b91]";

function formatDate(value: string, dateOnly = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "short", year: "numeric",
    ...(!dateOnly ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
  }).format(new Date(dateOnly ? `${value}T12:00:00Z` : value));
}

function Metric({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return <section className={panel}>
    <h3 className="text-xs font-bold uppercase tracking-[0.13em] text-[#c393a9]">{label}</h3>
    <p className="mt-3 text-3xl font-black tabular-nums text-[#f0dce5]">{value}</p>
    <div className={`mt-2 ${muted}`}>{children}</div>
  </section>;
}

const omenLabels: Record<OmenReadiness, string> = {
  waiting: "Waiting for draw", "face-down": "Chosen · face-down", available: "Available", used: "Used",
  "not-open": "No active Turning", unavailable: "Status unavailable",
};

export function BaroviaSessionOverview({ overview, session }: { overview: Overview; session: CampaignSessionSettings }) {
  const hasDate = session.databaseReady && session.status === "scheduled" && Boolean(session.nextSessionAt);
  const datePassed = hasDate && Date.parse(session.nextSessionAt!) < Date.parse(overview.refreshedAt);
  const cycle = overview.tarokka.cycle;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-serif text-2xl font-black text-[#ebd7e1]">Before the next gathering</h2>
        <p className={muted}>Planning snapshot for {overview.monthLabel}. Times below use Europe/Warsaw.</p></div>
      <SessionDeskRefresh />
    </div>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" aria-label="Published gathering and Tarokka cycle">
      <div className={`${panel} bg-gradient-to-br from-[#361c2b] to-[#120c11]`}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c88ca7]">Published for the party</p>
        <h3 className="mt-3 font-serif text-2xl font-black text-[#f0e0e8]">
          {!session.databaseReady ? "Announcement unavailable" : hasDate ? formatDate(session.nextSessionAt!) : "Date to be announced"}
        </h3>
        {datePassed && <p className="mt-2 text-sm font-semibold text-amber-200">This published date has passed. Review the announcement for the next gathering.</p>}
        {session.databaseReady && <p className={`mt-3 whitespace-pre-wrap ${muted}`}>{session.message || "No additional note published."}</p>}
        {session.databaseReady && session.debuffs.length > 0 && <div className="mt-4 rounded-xl border border-[#644052] bg-black/20 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#d0a2b6]">Marks of the Mists · {session.debuffs.length}</p>
          <ul className={`mt-2 list-disc space-y-1 pl-4 ${muted}`}>{session.debuffs.map((note, index) => <li key={index} className="break-words">{note}</li>)}</ul>
        </div>}
        <div className="mt-5 flex flex-wrap gap-2"><Link className={link} href="/campaigns/barovia/gm/session?view=publication">Edit announcement</Link>
          <Link className={link} href="/campaigns/barovia/gm/session?view=planning">Choose a date</Link></div>
      </div>
      <div className={panel}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c88ca7]">Tarokka · the current Turning</p>
        <h3 className="mt-3 font-serif text-2xl font-black text-[#ebd7e1]">{!overview.tarokkaAvailable ? "Tarokka unavailable" : cycle ? `#${cycle.cycle_number} · ${cycle.title}` : "The deck is waiting"}</h3>
        <p className={`mt-3 ${muted}`}>{!overview.tarokkaAvailable ? "The cycle could not be refreshed. Open Tarokka control or try refreshing the overview." : !cycle ? "Open the first Turning when the party is ready for personal omens." : cycle.draws_open ? "Drawing is open. Players can choose their personal omen." : "Drawing is paused. Held omens remain available for use."}</p>
        <Link className={`mt-5 ${link}`} href="/campaigns/barovia/gm/tarokka">Manage Tarokka</Link>
      </div>
    </section>

    <div className="grid gap-3 md:grid-cols-3" aria-label="Session readiness">
      <Metric label="Availability entered" value={overview.planningAvailable ? `${overview.respondents} / ${overview.eligiblePlayers}` : "Unavailable"}>
        <p>{overview.planningAvailable ? "Active planning players with at least one answer for a remaining day this month." : "Planning data could not be refreshed."}</p>
        {overview.planningAvailable && overview.waitingAvailability.length > 0 && <p className="mt-2 text-[#d2afbf]">Waiting: {overview.waitingAvailability.join(", ")}</p>}
      </Metric>
      <Metric label="Dates under vote" value={overview.planningAvailable ? overview.proposals.length : "Unavailable"}>
        <p>Open votes for remaining dates in {overview.monthLabel}. Browse other months in Availability &amp; votes.</p>
      </Metric>
      <Metric label="Personal omens chosen" value={!overview.tarokkaAvailable ? "Unavailable" : !cycle ? "Not opened" : `${overview.tarokka.chosen} / ${overview.tarokka.total}`}>
        <p>{cycle && overview.tarokkaAvailable ? `${overview.tarokka.waiting} waiting for a draw · ${overview.tarokka.used} used` : "Progress counts only the players included in Barovia's omen totals."}</p>
      </Metric>
    </div>

    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-serif text-xl font-black text-[#ebd7e1]">Party readiness</h3>
        <p className={`mt-1 ${muted}`}>Planning and omen participation follow each player&apos;s campaign settings.</p></div>
        <Link className={link} href="/campaigns/barovia/gm/members">Manage party</Link></div>
      {!overview.planningAvailable ? <p className={`mt-5 ${muted}`}>The party list could not be refreshed. Refresh the overview to try again.</p> : !overview.players.length ? <p className={`mt-5 ${muted}`}>No active players are assigned to Barovia yet.</p> : <ul className="mt-5 divide-y divide-[#422b38]">
        {overview.players.map((player) => <li key={player.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div><p className="break-words font-bold text-[#eddae3]">{player.name}</p>
            {!player.planningEnabled && <p className="mt-1 text-xs text-[#b39aa7]">Outside planning totals</p>}
            {player.countsTowardOmens === false && <p className="mt-1 text-xs text-[#b39aa7]">Outside omen totals</p>}</div>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a77d90]">Availability &amp; votes</p>
            <p className={`mt-1 ${muted}`}>{player.planningEnabled ? `${player.daysEntered} remaining days entered` : "Not counted"}</p>
            {player.planningEnabled && <p className="mt-1 text-xs text-[#a78c9a]">{player.votesEntered} / {overview.proposals.length} open votes answered</p>}</div>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a77d90]">Personal omen</p>
            <p className={`mt-1 text-sm font-semibold ${player.omen === "available" ? "text-emerald-200" : player.omen === "waiting" ? "text-amber-200" : "text-[#c8aebc]"}`}>{omenLabels[player.omen]}</p>
            {player.cardName && player.omen !== "unavailable" && player.omen !== "not-open" && <p className="mt-1 break-words text-xs text-[#a78c9a]">{player.cardName}</p>}</div>
        </li>)}
      </ul>}
    </section>

    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-serif text-xl font-black text-[#ebd7e1]">Open date proposals</h3>
        <p className={`mt-1 ${muted}`}>{overview.monthLabel} · active planning players</p></div>
        <Link className={link} href="/campaigns/barovia/gm/session?view=planning">Manage votes</Link></div>
      {!overview.planningAvailable ? <p className={`mt-4 ${muted}`}>Votes are unavailable. Refresh the overview to try again.</p> : !overview.proposals.length ? <p className={`mt-4 ${muted}`}>No remaining date is under vote this month. Use the calendar to compare availability and propose a night.</p> : <ul className="mt-4 grid gap-3 lg:grid-cols-2">{overview.proposals.map((proposal) => <li key={proposal.id} className="rounded-xl border border-[#533345] bg-black/20 p-4">
        <p className="font-bold text-[#ead4df]">{formatDate(proposal.date, true)} · {proposal.mode === "online" ? "Online" : "In person"}</p>
        <p className={`mt-2 ${muted}`}>{proposal.yes} yes · {proposal.maybe} maybe · {proposal.no} no · {proposal.waiting} waiting</p>
      </li>)}</ul>}
    </section>
    <p className="text-xs text-[#967c8b]">Overview refreshed {formatDate(overview.refreshedAt)}. Refresh after another GM or player makes a change.</p>
  </div>;
}
