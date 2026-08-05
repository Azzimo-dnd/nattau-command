export type CampaignAdminMember = {
  userId: string;
  displayName: string;
  email: string | null;
  role: "dm" | "player";
  planningEnabled: boolean;
  countsTowardProgress: boolean;
  isTestAccount: boolean;
  isActive: boolean;
  joinedAt: string;
  lastSeenAt: string | null;
};

export type CampaignInviteSummary = {
  id: string;
  label: string | null;
  codePreview: string;
  role: "player";
  planningEnabled: boolean;
  countsTowardProgress: boolean;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  createdByName: string | null;
};

export type CreatedCampaignInvite = {
  inviteId: string;
  inviteCode: string;
  invitePath: string;
  expiresAt: string | null;
};

export type CampaignInvitePreview = {
  valid: boolean;
  reason: string | null;
  campaignId: string | null;
  campaignSlug: string | null;
  campaignName: string | null;
  companionName: string | null;
  subtitle: string | null;
  systemKey: string | null;
  themeKey: string | null;
  label: string | null;
  expiresAt: string | null;
};

export type RedeemedCampaignInvite = {
  campaignId: string;
  campaignSlug: string;
  companionName: string;
  membershipCreated: boolean;
};
