/**
 * Legacy campaign data used by older dashboard components,
 * including ResourceGrid.
 *
 * The next session date is no longer managed here.
 * It is loaded from Supabase through the GM Session Controls panel.
 */
export type Campaign = {
  resourcePoints: number;
  maxResourcePoints: number;
  resourcePointsMax: number;
  population: number;
  morale: number;
  influence: string;
  deploymentCapacity: number;
  lastUpdate: string;

  /**
   * Kept only for compatibility with older components.
   * The current Command Center does not use this value.
   */
  nextSession: string;
};

export const campaign: Campaign = {
  resourcePoints: 12,
  maxResourcePoints: 15,
  resourcePointsMax: 15,

  population: 200,
  morale: 75,
  influence: "High",

  deploymentCapacity: 8,

  lastUpdate: "20th Nighal, 1505 DR",

  // Session date is now managed in Supabase.
  nextSession: "",
};

export type CampaignEvent = {
  title: string;
  description: string;
  tag: string;
};

export const campaignConfig: {
  recentEvents: CampaignEvent[];
} = {
  recentEvents: [
    {
      title: "Imperial troops reinforce the province",
      description:
        "Additional imperial forces were reported in the province containing Dom Straznika.",
      tag: "Military",
    },
    {
      title: "Magical cabbage stores sabotaged",
      description:
        "UĆ is assessing the losses and searching for those responsible.",
      tag: "Settlement",
    },
    {
      title: "Pipdock joins the expedition network",
      description:
        "The newly founded port is beginning to support travel and regular trade.",
      tag: "Trade",
    },
  ],
};