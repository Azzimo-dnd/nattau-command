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
      title: "Sebilla's Ship Destroyed",
      description:
        "Acting on direct orders from the party, the spectral circus troupe destroyed Sebilla's ship, bringing the vessel's voyage to a violent end.",
      tag: "Military",
    },
    {
      title: "The Mine Holds Against Attack",
      description:
        "The mine came under attack, but its defenders successfully repelled the assault and maintained control of the facility.",
      tag: "Military",
    },
    {
      title: "Imperial Officer Interrogated",
      description:
        "An officer of the Empire was interrogated following the recent confrontation with Imperial forces.",
      tag: "Intelligence",
    },
    {
      title: "Fifty Recruits Survive Kevin's Training",
      description:
        "The grueling military training overseen by Kevin has concluded. Of the sixty volunteers who entered the program, only fifty survived.",
      tag: "Military",
    },
    {
      title: "Reinforcements Assigned to Ared",
      description:
        "The party ordered a portion of the newly trained recruits to join Ared's forces, strengthening border security and the defenses of the settlement.",
      tag: "Military",
    },
    {
      title: "The Buried Chamber of Dom Strażnika",
      description:
        "Previously locked doors within the fortress of Dom Strażnika were finally opened, revealing a chamber buried beneath rubble. The Guardian was discovered lying beneath the debris. Khael and others have begun clearing the collapsed room.",
      tag: "Discovery",
    },
    {
      title: "Kealith and Drakar Brought to Safety",
      description:
        "Sally and Albert successfully located Kealith and Drakar and escorted them back to the fortress of Dom Strażnika.",
      tag: "Settlement",
    },
    {
      title: "Mother Tyllen's Child Draws Near",
      description:
        "An important moment approaches for Torsten's family. Mother Tyllen is now less than a month away from giving birth.",
      tag: "Personal",
    },
    {
      title: "New Clues in the Search for the Key",
      description:
        "Szejmus provided valuable information regarding the missing key, confirming that it is neither in the city nor with the Cult of Mazamundi.",
      tag: "Intelligence",
    },
    {
      title: "Pippo Assigned a Diplomatic Mission",
      description:
        "Pippo was entrusted with a trade and diplomatic mission to Avanui, tasked with establishing relations and exploring opportunities for cooperation.",
      tag: "Diplomacy",
    },
    {
      title: "Tsalan Agrees to a Meeting",
      description:
        "The party established contact with Tsalan. Although displeased by the manner in which he was approached, Tsalan agreed to meet Pippo in Pipport.",
      tag: "Diplomacy",
    },
    {
      title: "The Search for Mariusz",
      description:
        "Odetta entrusted Kevin with the task of locating Mariusz, setting a new search in motion.",
      tag: "Quest",
    },
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