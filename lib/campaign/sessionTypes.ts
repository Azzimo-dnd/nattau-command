export type CampaignSessionStatus = "scheduled" | "tba";

export type CampaignSessionSettings = {
  status: CampaignSessionStatus;
  nextSessionAt: string | null;
  message: string;
  updatedAt: string | null;
  updatedBy: string | null;
  databaseReady: boolean;
};

export const DEFAULT_SESSION_MESSAGE =
  "The next session has not yet been announced.";
