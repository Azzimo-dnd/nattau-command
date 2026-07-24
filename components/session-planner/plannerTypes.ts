import type { AppRole } from "@/components/navigation/navigationTypes";

export type AvailabilityMode =
  | "online"
  | "in_person"
  | "both"
  | "unavailable";

export type AvailabilityBrush = AvailabilityMode | "erase";
export type SelectionMode = "paint" | "range";
export type HeatMode = "best" | "online" | "in_person";
export type ProposalMode = "online" | "in_person";
export type ProposalStatus = "voting" | "confirmed" | "cancelled";
export type ProposalVoteValue = "yes" | "maybe" | "no";

export type PlannerMember = {
  id: string;
  display_name: string;
  role: AppRole;
};

export type AvailabilityEntry = {
  user_id: string;
  availability_date: string;
  availability_mode: AvailabilityMode;
  updated_at: string;
};

export type ProposalVote = {
  voter_id: string;
  voter_name: string;
  vote: ProposalVoteValue;
  updated_at: string;
};

export type SessionProposal = {
  id: string;
  proposed_date: string;
  session_mode: ProposalMode;
  message: string | null;
  status: ProposalStatus;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  votes: ProposalVote[];
};

export type SessionPlannerData = {
  month_start: string;
  month_end: string;
  current_user_id: string;
  current_user_role: AppRole;
  members: PlannerMember[];
  availability: AvailabilityEntry[];
  proposals: SessionProposal[];
};

export type SessionPlannerUser = {
  id: string;
  displayName: string;
  role: AppRole;
};
