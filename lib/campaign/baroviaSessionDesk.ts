import type { SessionPlannerData } from "@/components/session-planner/plannerTypes";
import type { TarokkaCycle, TarokkaProgressRow } from "@/components/tarokka/tarokkaTypes";

export type SessionDeskView = "overview" | "planning" | "publication";
export type OmenReadiness = "waiting" | "face-down" | "available" | "used" | "not-open" | "unavailable";
export type OmenUsage = { id: string; cycle_id: string; used_at: string | null; revealed_at: string | null };
export type TarokkaReadiness = {
  cycle: TarokkaCycle | null;
  progress: TarokkaProgressRow[];
  usage: OmenUsage[];
};

export function sessionDeskView(value: string | string[] | undefined): SessionDeskView {
  return value === "planning" || value === "publication" ? value : "overview";
}

export function sessionDeskWindow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return {
    today: `${part("year")}-${part("month")}-${part("day")}`,
    monthStart: `${part("year")}-${part("month")}-01`,
    monthLabel: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw", month: "long", year: "numeric",
    }).format(now),
  };
}

export function buildBaroviaSessionOverview({ campaignId, planner, tarokka, now }: {
  campaignId: string;
  planner: SessionPlannerData | null;
  tarokka: TarokkaReadiness | null;
  now: Date;
}) {
  const window = sessionDeskWindow(now);
  // A result from another campaign/month must never be presented as this desk.
  const planning = planner?.campaign_id === campaignId && planner.campaign_slug === "barovia" &&
    planner.month_start === window.monthStart ? planner : null;
  const omens = tarokka && (!tarokka.cycle || tarokka.cycle.campaign_id === campaignId) ? tarokka : null;
  const members = planning?.members.filter((member) => member.role === "player") ?? [];
  const eligibleIds = new Set(members.filter((member) => member.planning_enabled !== false).map((member) => member.id));
  const availability = planning?.availability.filter((item) => item.availability_date >= window.today && item.availability_date <= planning.month_end) ?? [];
  const proposals = (planning?.proposals ?? [])
    .filter((proposal) => proposal.status === "voting" && proposal.proposed_date >= window.today)
    .map((proposal) => {
      const votes = new Map(proposal.votes.filter((vote) => eligibleIds.has(vote.voter_id)).map((vote) => [vote.voter_id, vote.vote]));
      return {
        id: proposal.id, date: proposal.proposed_date, mode: proposal.session_mode,
        yes: [...votes.values()].filter((vote) => vote === "yes").length,
        maybe: [...votes.values()].filter((vote) => vote === "maybe").length,
        no: [...votes.values()].filter((vote) => vote === "no").length,
        waiting: eligibleIds.size - votes.size,
        voterIds: [...votes.keys()],
      };
    });
  const usageById = new Map((omens?.usage ?? []).filter((draw) => draw.cycle_id === omens?.cycle?.id).map((draw) => [draw.id, draw]));
  const progressById = new Map((omens?.progress ?? []).map((row) => [row.player_id, row]));
  function omenState(row: TarokkaProgressRow | undefined): OmenReadiness {
    if (!omens) return "unavailable";
    if (!omens.cycle) return "not-open";
    if (!row) return "unavailable";
    if (!row.draw_id) return "waiting";
    const draw = usageById.get(row.draw_id);
    if (!draw) return "unavailable";
    return draw.used_at ? "used" : draw.revealed_at ? "available" : "face-down";
  }
  const counted = omens?.progress.filter((row) => row.counts_toward_progress) ?? [];
  const states = counted.map(omenState);
  const players = members.map((member) => {
    const progress = progressById.get(member.id);
    return {
      id: member.id, name: member.display_name,
      planningEnabled: member.planning_enabled !== false,
      daysEntered: new Set(availability.filter((item) => item.user_id === member.id).map((item) => item.availability_date)).size,
      votesEntered: proposals.filter((proposal) => proposal.voterIds.includes(member.id)).length,
      omen: omenState(progress), cardName: progress?.card_name ?? null,
      countsTowardOmens: progress?.counts_toward_progress ?? null,
    };
  });
  const respondents = new Set(availability.filter((item) => eligibleIds.has(item.user_id)).map((item) => item.user_id));
  return {
    ...window, refreshedAt: now.toISOString(),
    planningAvailable: Boolean(planning), tarokkaAvailable: Boolean(omens),
    eligiblePlayers: eligibleIds.size, respondents: respondents.size,
    waitingAvailability: members.filter((member) => eligibleIds.has(member.id) && !respondents.has(member.id)).map((member) => member.display_name),
    proposals, players,
    tarokka: {
      cycle: omens?.cycle ?? null, total: counted.length,
      chosen: omens?.cycle ? counted.filter((row) => row.draw_id).length : 0,
      used: states.filter((state) => state === "used").length,
      waiting: states.filter((state) => state === "waiting").length,
    },
  };
}

export type BaroviaSessionOverview = ReturnType<typeof buildBaroviaSessionOverview>;
