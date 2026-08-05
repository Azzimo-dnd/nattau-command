import type { Metadata } from "next";
import { CampaignChatScreen } from "@/components/chat/CampaignChatScreen";
import {
  createCurrentChatParticipant,
  getOrCreateCampaignChatThread,
  loadCampaignChatThread,
  loadCampaignChatThreadSummaries,
} from "@/lib/chat/loadCampaignChat";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const metadata: Metadata = {
  title: "Whispers Through the Mists | Beyond the Mists",
  description: "Private messages between a Barovian player and the Game Master.",
};

type PageProps = {
  searchParams: Promise<{ player?: string }>;
};

export default async function BaroviaWhispersPage({ searchParams }: PageProps) {
  const access = await requireCampaignMembership("barovia");
  const currentUser = createCurrentChatParticipant({
    userId: access.userId,
    displayName: access.displayName,
    role: access.membership.role,
  });

  if (access.membership.role === "player") {
    const threadId = await getOrCreateCampaignChatThread("barovia");
    const thread = await loadCampaignChatThread({ threadId, currentUser });

    return (
      <CampaignChatScreen
        theme="barovia"
        role="player"
        title="Whispers Through the Mists"
        eyebrow="A voice carried through the fog"
        description="A private channel between you and the Game Master. No other soul in Barovia can read what is written here."
        backHref="/campaigns/barovia"
        backLabel="Return through the Mists"
        searchParamName="player"
        summaries={[]}
        selectedPlayerId={access.userId}
        thread={thread}
      />
    );
  }

  const summaries = await loadCampaignChatThreadSummaries("barovia");
  const query = await searchParams;
  const selectedSummary =
    summaries.find((summary) => summary.playerId === query.player) ??
    summaries[0] ??
    null;

  let thread = null;
  if (selectedSummary) {
    const threadId = await getOrCreateCampaignChatThread(
      "barovia",
      selectedSummary.playerId
    );
    thread = await loadCampaignChatThread({ threadId, currentUser });
  }

  return (
    <CampaignChatScreen
      theme="barovia"
      role="dm"
      title="Whispers Through the Mists"
      eyebrow="Secrets entrusted to the Game Master"
      description="Private conversations with the souls currently wandering your Barovia campaign. Unread whispers are gathered at the top."
      backHref="/campaigns/barovia"
      backLabel="Return through the Mists"
      searchParamName="player"
      summaries={summaries}
      selectedPlayerId={selectedSummary?.playerId ?? null}
      thread={thread}
    />
  );
}
