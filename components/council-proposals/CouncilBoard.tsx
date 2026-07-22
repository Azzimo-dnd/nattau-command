"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  CouncilProfile,
  CouncilProposalView,
  ProposalStatus,
  ProposalType,
} from "./councilTypes";

type CouncilBoardProps = {
  currentUser: CouncilProfile;
  initialProposals: CouncilProposalView[];
};

const proposalTypes: Array<{ value: ProposalType; label: string }> = [
  { value: "military", label: "Military" },
  { value: "settlement", label: "Settlement" },
  { value: "resources", label: "Resources" },
  { value: "diplomacy", label: "Diplomacy" },
  { value: "expedition", label: "Expedition" },
  { value: "law", label: "Law" },
  { value: "special", label: "Special" },
];

function getTypeLabel(type: ProposalType) {
  return proposalTypes.find((item) => item.value === type)?.label ?? type;
}

function getTypeClass(type: ProposalType) {
  switch (type) {
    case "military":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "settlement":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "resources":
      return "border-green-500/30 bg-green-500/10 text-green-300";
    case "diplomacy":
      return "border-purple-500/30 bg-purple-500/10 text-purple-300";
    case "expedition":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "law":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    case "special":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }
}

function getStatusClass(status: ProposalStatus) {
  switch (status) {
    case "voting":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    case "approved":
      return "border-green-500/30 bg-green-500/10 text-green-300";
    case "rejected":
      return "border-red-500/30 bg-red-500/10 text-red-300";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CouncilBoard({
  currentUser,
  initialProposals,
}: CouncilBoardProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"active" | "resolved" | "mine">(
    "active"
  );
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [proposalType, setProposalType] =
    useState<ProposalType>("military");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const visibleProposals = useMemo(() => {
    switch (activeTab) {
      case "active":
        return initialProposals.filter((proposal) => proposal.status === "voting");
      case "resolved":
        return initialProposals.filter((proposal) => proposal.status !== "voting");
      case "mine":
        return initialProposals.filter(
          (proposal) => proposal.author_id === currentUser.id
        );
    }
  }, [activeTab, currentUser.id, initialProposals]);

  const activeCount = initialProposals.filter(
    (proposal) => proposal.status === "voting"
  ).length;
  const approvedCount = initialProposals.filter(
    (proposal) => proposal.status === "approved"
  ).length;
  const rejectedCount = initialProposals.filter(
    (proposal) => proposal.status === "rejected"
  ).length;
  const pendingVotesCount =
    currentUser.role === "player"
      ? initialProposals.filter(
          (proposal) =>
            proposal.status === "voting" && proposal.current_user_vote === null
        ).length
      : 0;

  async function handleCreateProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (cleanTitle.length < 3) {
      setErrorMessage("The proposal title must contain at least 3 characters.");
      return;
    }

    if (cleanDescription.length < 10) {
      setErrorMessage(
        "The proposal description must contain at least 10 characters."
      );
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.from("council_proposals").insert({
      author_id: currentUser.id,
      title: cleanTitle,
      proposal_type: proposalType,
      description: cleanDescription,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setTitle("");
    setProposalType("military");
    setDescription("");
    setShowForm(false);
    setIsSubmitting(false);
    router.refresh();
  }

  async function handleVote(
    proposalId: string,
    nextVote: 1 | -1,
    currentVote: 1 | -1 | null
  ) {
    if (currentUser.role === "dm") return;

    setErrorMessage(null);
    setPendingProposalId(proposalId);

    const supabase = createClient();

    if (currentVote === nextVote) {
      const { error } = await supabase
        .from("council_votes")
        .delete()
        .eq("proposal_id", proposalId)
        .eq("voter_id", currentUser.id);

      if (error) {
        setErrorMessage(error.message);
        setPendingProposalId(null);
        return;
      }
    } else {
      const { error } = await supabase.from("council_votes").upsert(
        {
          proposal_id: proposalId,
          voter_id: currentUser.id,
          vote: nextVote,
        },
        { onConflict: "proposal_id,voter_id" }
      );

      if (error) {
        setErrorMessage(error.message);
        setPendingProposalId(null);
        return;
      }
    }

    setPendingProposalId(null);
    router.refresh();
  }

  async function handleResolve(
    proposalId: string,
    status: "approved" | "rejected"
  ) {
    if (currentUser.role !== "dm") return;

    setErrorMessage(null);
    setPendingProposalId(proposalId);

    const supabase = createClient();
    const { error } = await supabase
      .from("council_proposals")
      .update({
        status,
        closed_at: new Date().toISOString(),
      })
      .eq("id", proposalId)
      .eq("status", "voting");

    if (error) {
      setErrorMessage(error.message);
      setPendingProposalId(null);
      return;
    }

    setPendingProposalId(null);
    router.refresh();
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Active Proposals"
          value={activeCount}
          detail="Open for voting"
          valueClass="text-yellow-400"
        />
        <SummaryCard
          label="Approved"
          value={approvedCount}
          detail="Council support"
          valueClass="text-green-400"
        />
        <SummaryCard
          label="Rejected"
          value={rejectedCount}
          detail="Closed proposals"
          valueClass="text-red-400"
        />
        <SummaryCard
          label={currentUser.role === "dm" ? "Council Role" : "Your Pending Votes"}
          value={currentUser.role === "dm" ? "GM" : pendingVotesCount}
          detail={
            currentUser.role === "dm"
              ? "Resolution authority"
              : "Active proposals without your vote"
          }
          valueClass="text-blue-400"
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <TabButton
              active={activeTab === "active"}
              onClick={() => setActiveTab("active")}
            >
              Active
            </TabButton>
            <TabButton
              active={activeTab === "resolved"}
              onClick={() => setActiveTab("resolved")}
            >
              Resolved
            </TabButton>
            <TabButton
              active={activeTab === "mine"}
              onClick={() => setActiveTab("mine")}
            >
              My Proposals
            </TabButton>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-yellow-400"
          >
            {showForm ? "Close Form" : "+ Submit Proposal"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreateProposal}
            className="mt-5 rounded-2xl border border-yellow-600/20 bg-slate-950/50 p-5"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-yellow-500">
              New Council Motion
            </p>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="proposal-title"
                  className="text-sm font-medium text-slate-300"
                >
                  Proposal title
                </label>
                <input
                  id="proposal-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  required
                  placeholder="Improve the Pavise Brothers"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500"
                />
              </div>

              <div>
                <label
                  htmlFor="proposal-type"
                  className="text-sm font-medium text-slate-300"
                >
                  Proposal type
                </label>
                <select
                  id="proposal-type"
                  value={proposalType}
                  onChange={(event) =>
                    setProposalType(event.target.value as ProposalType)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-yellow-500"
                >
                  {proposalTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5">
              <label
                htmlFor="proposal-description"
                className="text-sm font-medium text-slate-300"
              >
                Description
              </label>
              <textarea
                id="proposal-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
                rows={6}
                required
                placeholder="Describe what the council should approve and why."
                className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500"
              />
              <p className="mt-2 text-right text-xs text-slate-600">
                {description.length} / 4000
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-5 rounded-xl bg-yellow-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit for Voting"}
            </button>
          </form>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      <div className="space-y-4">
        {visibleProposals.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-4xl">⚖️</p>
            <h2 className="mt-4 text-xl font-bold text-slate-200">
              No proposals here
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Submit a new motion or choose another section.
            </p>
          </div>
        ) : (
          visibleProposals.map((proposal) => (
            <article
              key={proposal.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${getTypeClass(
                        proposal.proposal_type
                      )}`}
                    >
                      {getTypeLabel(proposal.proposal_type)}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${getStatusClass(
                        proposal.status
                      )}`}
                    >
                      {proposal.status}
                    </span>
                  </div>

                  <h2 className="mt-4 text-2xl font-bold text-slate-100">
                    {proposal.title}
                  </h2>
                  <p className="mt-2 text-xs text-slate-500">
                    Submitted by{" "}
                    <span className="font-bold text-slate-300">
                      {proposal.author_name}
                    </span>{" "}
                    · {formatDate(proposal.created_at)}
                  </p>
                </div>

                {proposal.status === "voting" && currentUser.role === "dm" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pendingProposalId === proposal.id}
                      onClick={() => handleResolve(proposal.id, "approved")}
                      className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-300 transition hover:bg-green-500/20 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={pendingProposalId === proposal.id}
                      onClick={() => handleResolve(proposal.id, "rejected")}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {proposal.description}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-5">
                <div className="flex flex-wrap gap-3">
                  <VoteButton
                    label={`For · ${proposal.votes_for}`}
                    icon="👍"
                    active={proposal.current_user_vote === 1}
                    disabled={
                      proposal.status !== "voting" ||
                      currentUser.role === "dm" ||
                      pendingProposalId === proposal.id
                    }
                    onClick={() =>
                      handleVote(proposal.id, 1, proposal.current_user_vote)
                    }
                    activeClass="border-green-500 bg-green-500/15 text-green-300"
                  />
                  <VoteButton
                    label={`Against · ${proposal.votes_against}`}
                    icon="👎"
                    active={proposal.current_user_vote === -1}
                    disabled={
                      proposal.status !== "voting" ||
                      currentUser.role === "dm" ||
                      pendingProposalId === proposal.id
                    }
                    onClick={() =>
                      handleVote(proposal.id, -1, proposal.current_user_vote)
                    }
                    activeClass="border-red-500 bg-red-500/15 text-red-300"
                  />
                </div>

                <div className="text-right text-xs text-slate-500">
                  {proposal.status === "voting" ? (
                    currentUser.role === "dm" ? (
                      <span>GM observes and resolves the vote.</span>
                    ) : proposal.current_user_vote === null ? (
                      <span>Your vote is still pending.</span>
                    ) : (
                      <span>Click your selected vote again to remove it.</span>
                    )
                  ) : (
                    <span>
                      Closed{" "}
                      {proposal.closed_at ? formatDate(proposal.closed_at) : ""}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

type SummaryCardProps = {
  label: string;
  value: string | number;
  detail: string;
  valueClass: string;
};

function SummaryCard({ label, value, detail, valueClass }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-600">
        {detail}
      </p>
    </div>
  );
}

type TabButtonProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm transition ${
        active
          ? "border-yellow-500 bg-yellow-500/10 text-yellow-300"
          : "border-slate-700 bg-slate-950/60 text-slate-400 hover:border-yellow-600/40 hover:text-yellow-300"
      }`}
    >
      {children}
    </button>
  );
}

type VoteButtonProps = {
  label: string;
  icon: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  activeClass: string;
};

function VoteButton({
  label,
  icon,
  active,
  disabled,
  onClick,
  activeClass,
}: VoteButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? activeClass
          : "border-slate-700 bg-slate-950/60 text-slate-300 hover:border-yellow-600/40"
      }`}
    >
      {icon} {label}
    </button>
  );
}
