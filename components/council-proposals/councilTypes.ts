export type ProposalType =
  | "military"
  | "settlement"
  | "resources"
  | "diplomacy"
  | "expedition"
  | "law"
  | "special";

export type ProposalStatus = "voting" | "approved" | "rejected";

export type CouncilProfile = {
  id: string;
  display_name: string;
  role: "dm" | "player";
};

export type CouncilProposal = {
  id: string;
  author_id: string;
  title: string;
  proposal_type: ProposalType;
  description: string;
  status: ProposalStatus;
  created_at: string;
  closed_at: string | null;
};

export type CouncilVote = {
  proposal_id: string;
  voter_id: string;
  vote: 1 | -1;
  created_at: string;
  updated_at: string;
};

export type CouncilProposalView = CouncilProposal & {
  author_name: string;
  votes_for: number;
  votes_against: number;
  current_user_vote: 1 | -1 | null;
};
