import type { AppRole } from "@/components/navigation/navigationTypes";
import { getCurrentAppUser } from "@/lib/auth/getCurrentAppUser";
import { DEFAULT_SESSION_MESSAGE } from "@/lib/campaign/sessionTypes";
import type { CampaignSessionStatus } from "@/lib/campaign/sessionTypes";
import { createClient } from "@/lib/supabase/server";

export type FateState = "available" | "drawn" | "inactive";

export type CommandCenterData = {
  userId: string;
  displayName: string;
  role: AppRole;
  activeProposalCount: number;
  proposalsAwaitingVote: number;
  activeFateCycle: boolean;
  fateCycleNumber: number | null;
  fateState: FateState;
  fateDrawCount: number;
  playerCount: number;
  sessionStatus: CampaignSessionStatus;
  nextSessionAt: string | null;
  sessionMessage: string;
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

type ProposalIdRow = {
  id: string;
};

type VoteRow = {
  proposal_id: string;
};

type ActiveCycleRow = {
  id: string;
  cycle_number: number;
};

type SessionRow = {
  status: string;
  next_session_at: string | null;
  message: string | null;
};

type PlannerHomeSummary = {
  player_count?: number;
  players_responded?: number;
  missing_player_names?: unknown;
  current_user_availability_days?: number;
  current_user_has_availability?: boolean;
  open_proposal_count?: number;
  proposals_awaiting_vote?: number;
  promising_date_count?: number;
  response_window_days?: number;
};

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export async function loadCommandCenterData(): Promise<CommandCenterData | null> {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    return null;
  }

  const supabase = await createClient();

  let activeProposalCount = 0;
  let proposalsAwaitingVote = 0;
  let activeFateCycle = false;
  let fateCycleNumber: number | null = null;
  let fateState: FateState = "inactive";
  let fateDrawCount = 0;
  let playerCount = 0;
  let sessionStatus: CampaignSessionStatus = "tba";
  let nextSessionAt: string | null = null;
  let sessionMessage = DEFAULT_SESSION_MESSAGE;
  let plannerSummaryLoaded = false;
  let plannerAvailabilityDays = 0;
  let plannerHasAvailability = false;
  let plannerPlayersResponded = 0;
  let plannerMissingPlayerNames: string[] = [];
  let plannerOpenProposalCount = 0;
  let plannerVotesAwaiting = 0;
  let plannerPromisingDateCount = 0;
  let plannerResponseWindowDays = 45;

  const { data: sessionData, error: sessionError } = await supabase
    .from("campaign_session_settings")
    .select("status, next_session_at, message")
    .eq("id", 1)
    .maybeSingle();

  if (!sessionError && sessionData) {
    const session = sessionData as SessionRow;
    const hasScheduledDate =
      session.status === "scheduled" && Boolean(session.next_session_at);

    sessionStatus = hasScheduledDate ? "scheduled" : "tba";
    nextSessionAt = hasScheduledDate ? session.next_session_at : null;
    sessionMessage = session.message?.trim() || DEFAULT_SESSION_MESSAGE;
  }

  const { data: plannerSummaryData, error: plannerSummaryError } =
    await supabase.rpc("get_session_planner_home_summary");

  if (!plannerSummaryError && plannerSummaryData) {
    const summary = plannerSummaryData as PlannerHomeSummary;

    plannerSummaryLoaded = true;
    playerCount = Number(summary.player_count ?? 0);
    plannerPlayersResponded = Number(summary.players_responded ?? 0);
    plannerMissingPlayerNames = readStringArray(summary.missing_player_names);
    plannerAvailabilityDays = Number(
      summary.current_user_availability_days ?? 0
    );
    plannerHasAvailability = Boolean(
      summary.current_user_has_availability ?? plannerAvailabilityDays > 0
    );
    plannerOpenProposalCount = Number(summary.open_proposal_count ?? 0);
    plannerVotesAwaiting = Number(summary.proposals_awaiting_vote ?? 0);
    plannerPromisingDateCount = Number(summary.promising_date_count ?? 0);
    plannerResponseWindowDays = Number(summary.response_window_days ?? 45);
  }

  const { data: activeProposals, error: proposalError } = await supabase
    .from("council_proposals")
    .select("id")
    .eq("status", "voting");

  if (!proposalError) {
    const proposalRows = (activeProposals ?? []) as ProposalIdRow[];
    activeProposalCount = proposalRows.length;

    if (currentUser.role === "player" && proposalRows.length > 0) {
      const proposalIds = proposalRows.map((proposal) => proposal.id);
      const { data: ownVotes, error: voteError } = await supabase
        .from("council_votes")
        .select("proposal_id")
        .eq("voter_id", currentUser.id)
        .in("proposal_id", proposalIds);

      if (!voteError) {
        const votedIds = new Set(
          ((ownVotes ?? []) as VoteRow[]).map((vote) => vote.proposal_id)
        );
        proposalsAwaitingVote = proposalIds.filter(
          (proposalId) => !votedIds.has(proposalId)
        ).length;
      } else {
        proposalsAwaitingVote = activeProposalCount;
      }
    }
  }

  const { data: cycleData, error: cycleError } = await supabase
    .from("fate_cycles")
    .select("id, cycle_number")
    .eq("is_active", true)
    .maybeSingle();

  if (!cycleError && cycleData) {
    const cycle = cycleData as ActiveCycleRow;
    activeFateCycle = true;
    fateCycleNumber = Number(cycle.cycle_number);

    if (currentUser.role === "player") {
      const { data: draw, error: drawError } = await supabase
        .from("fate_draws")
        .select("id")
        .eq("cycle_id", cycle.id)
        .eq("player_id", currentUser.id)
        .maybeSingle();

      fateState = !drawError && draw ? "drawn" : "available";
    } else {
      const { count: drawsCount, error: drawsError } = await supabase
        .from("fate_draws")
        .select("id", { count: "exact", head: true })
        .eq("cycle_id", cycle.id);

      if (!drawsError) {
        fateDrawCount = drawsCount ?? 0;
      }
    }
  }

  if (currentUser.role === "dm" && !plannerSummaryLoaded) {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "player")
      .eq("planning_enabled", true);

    if (!error) {
      playerCount = count ?? 0;
    }
  }

  return {
    userId: currentUser.id,
    displayName: currentUser.displayName,
    role: currentUser.role,
    activeProposalCount,
    proposalsAwaitingVote,
    activeFateCycle,
    fateCycleNumber,
    fateState,
    fateDrawCount,
    playerCount,
    sessionStatus,
    nextSessionAt,
    sessionMessage,
    plannerSummaryLoaded,
    plannerAvailabilityDays,
    plannerHasAvailability,
    plannerPlayersResponded,
    plannerMissingPlayerNames,
    plannerOpenProposalCount,
    plannerVotesAwaiting,
    plannerPromisingDateCount,
    plannerResponseWindowDays,
  };
}
