import { createClient } from "@/lib/supabase/server";
import type {
  CampaignChatMessage,
  CampaignChatParticipant,
  CampaignChatRole,
  CampaignChatThreadData,
  CampaignChatThreadSummary,
} from "@/components/chat/campaignChatTypes";

type ThreadSummaryRow = {
  campaign_id: string;
  player_id: string;
  player_display_name: string;
  thread_id: string | null;
  unread_messages: number | string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
};

type MessageRow = {
  id: string;
  campaign_id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
};

type ThreadContextRow = {
  campaign_id: string;
  campaign_slug: string;
  player_id: string;
  other_user_id: string;
  other_display_name: string;
  other_role: string;
  other_last_read_at: string | null;
};

function normalizeRole(value: string | null | undefined): CampaignChatRole {
  return value === "dm" ? "dm" : "player";
}

function firstRow<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function loadCampaignChatThreadSummaries(
  campaignSlug: string
): Promise<CampaignChatThreadSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_campaign_chat_thread_summaries",
    { p_campaign_slug: campaignSlug }
  );

  if (error) {
    throw new Error(`Could not load player conversations: ${error.message}`);
  }

  return ((data ?? []) as ThreadSummaryRow[]).map((row) => ({
    campaignId: row.campaign_id,
    playerId: row.player_id,
    playerDisplayName: row.player_display_name,
    threadId: row.thread_id,
    unreadMessages: Number(row.unread_messages ?? 0),
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    lastSenderId: row.last_sender_id,
  }));
}

export async function getOrCreateCampaignChatThread(
  campaignSlug: string,
  playerId?: string | null
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_or_create_campaign_chat_thread",
    {
      p_campaign_slug: campaignSlug,
      p_player_id: playerId ?? null,
    }
  );

  if (error || !data) {
    throw new Error(
      `Could not open the private conversation: ${error?.message ?? "No thread was returned."}`
    );
  }

  return String(data);
}

export async function loadCampaignChatThread({
  threadId,
  currentUser,
}: {
  threadId: string;
  currentUser: CampaignChatParticipant;
}): Promise<CampaignChatThreadData> {
  const supabase = await createClient();

  const [contextResult, messagesResult] = await Promise.all([
    supabase.rpc("get_campaign_chat_thread_context", {
      p_thread_id: threadId,
    }),
    supabase.rpc("get_campaign_chat_messages", {
      p_thread_id: threadId,
    }),
  ]);

  if (contextResult.error) {
    throw new Error(
      `Could not load conversation context: ${contextResult.error.message}`
    );
  }

  if (messagesResult.error) {
    throw new Error(`Could not load messages: ${messagesResult.error.message}`);
  }

  const context = firstRow(
    contextResult.data as ThreadContextRow[] | ThreadContextRow | null
  );

  if (!context?.other_user_id) {
    throw new Error("No Game Master or player counterpart was found.");
  }

  const otherParticipant: CampaignChatParticipant = {
    id: context.other_user_id,
    displayName: context.other_display_name,
    role: normalizeRole(context.other_role),
  };

  const messages: CampaignChatMessage[] = ((messagesResult.data ?? []) as MessageRow[]).map(
    (row) => ({
      id: row.id,
      campaignId: row.campaign_id,
      threadId: row.thread_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderRole: normalizeRole(row.sender_role),
      content: row.content,
      createdAt: row.created_at,
    })
  );

  return {
    threadId,
    campaignId: context.campaign_id,
    campaignSlug: context.campaign_slug,
    currentUser,
    otherParticipant,
    otherLastReadAt: context.other_last_read_at,
    messages,
  };
}

export function createCurrentChatParticipant({
  userId,
  displayName,
  role,
}: {
  userId: string;
  displayName: string;
  role: CampaignChatRole;
}): CampaignChatParticipant {
  return {
    id: userId,
    displayName,
    role,
  };
}
