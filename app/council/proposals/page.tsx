import Link from "next/link";
import { redirect } from "next/navigation";
import { CouncilBoard } from "@/components/council-proposals/CouncilBoard";
import type {
  CouncilProfile,
  CouncilProposal,
  CouncilProposalView,
  CouncilVote,
} from "@/components/council-proposals/councilTypes";
import { createClient } from "@/lib/supabase/server";

export default async function CouncilProposalsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: currentProfileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .single();

  if (profileError || !currentProfileData) {
    throw new Error("The current council profile could not be loaded.");
  }

  const currentProfile = currentProfileData as CouncilProfile;

  const [
    { data: proposalsData, error: proposalsError },
    { data: votesData, error: votesError },
    { data: profilesData, error: profilesError },
  ] = await Promise.all([
    supabase
      .from("council_proposals")
      .select(
        "id, author_id, title, proposal_type, description, status, created_at, closed_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("council_votes")
      .select("proposal_id, voter_id, vote, created_at, updated_at"),
    supabase.from("profiles").select("id, display_name, role"),
  ]);

  if (proposalsError) {
    throw new Error(
      `Council proposals could not be loaded: ${proposalsError.message}`
    );
  }

  if (votesError) {
    throw new Error(`Council votes could not be loaded: ${votesError.message}`);
  }

  if (profilesError) {
    throw new Error(
      `Council profiles could not be loaded: ${profilesError.message}`
    );
  }

  const proposals = (proposalsData ?? []) as CouncilProposal[];
  const votes = (votesData ?? []) as CouncilVote[];
  const profiles = (profilesData ?? []) as CouncilProfile[];

  const profileNames = new Map(
    profiles.map((profile) => [profile.id, profile.display_name])
  );

  const proposalViews: CouncilProposalView[] = proposals.map((proposal) => {
    const proposalVotes = votes.filter(
      (vote) => vote.proposal_id === proposal.id
    );

    const currentUserVote =
      proposalVotes.find((vote) => vote.voter_id === currentProfile.id)?.vote ??
      null;

    return {
      ...proposal,
      author_name:
        profileNames.get(proposal.author_id) ?? "Unknown Council Member",
      votes_for: proposalVotes.filter((vote) => vote.vote === 1).length,
      votes_against: proposalVotes.filter((vote) => vote.vote === -1).length,
      current_user_vote: currentUserVote,
    };
  });

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 text-slate-100">
      <Link
        href="/"
        className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
      >
        ← Back to Command Center
      </Link>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
          Council Chamber
        </p>
        <h1 className="mt-3 text-4xl font-bold">Council Proposals</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Submit motions, review active proposals and vote on the future of the
          Kainite expedition.
        </p>
      </div>

      <div className="mt-8">
        <CouncilBoard
          currentUser={currentProfile}
          initialProposals={proposalViews}
        />
      </div>
    </main>
  );
}
