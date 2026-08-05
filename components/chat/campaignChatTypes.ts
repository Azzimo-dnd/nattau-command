export type CampaignChatRole = "dm" | "player";

export type CampaignChatTheme = "nattau" | "barovia";

export type CampaignChatParticipant = {
  id: string;
  displayName: string;
  role: CampaignChatRole;
};

export type CampaignChatMessage = {
  id: string;
  campaignId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: CampaignChatRole;
  content: string;
  createdAt: string;
};

export type CampaignChatThreadSummary = {
  campaignId: string;
  playerId: string;
  playerDisplayName: string;
  threadId: string | null;
  unreadMessages: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastSenderId: string | null;
};

export type CampaignChatThreadData = {
  threadId: string;
  campaignId: string;
  campaignSlug: string;
  currentUser: CampaignChatParticipant;
  otherParticipant: CampaignChatParticipant;
  otherLastReadAt: string | null;
  messages: CampaignChatMessage[];
};
