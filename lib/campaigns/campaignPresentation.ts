export type SupportedCampaign = "nattau" | "barovia";

/** Keep links inside the current campaign, including legacy Nattau routes. */
export function campaignPath(slug: string, path: string) {
  return slug === "nattau" ? path : `/campaigns/${slug}${path}`;
}

export function campaignPresentation(slug: SupportedCampaign) {
  const barovia = slug === "barovia";
  return {
    barovia,
    system: barovia ? "daggerheart" : "dnd5e",
    home: `/campaigns/${slug}`,
    homeLabel: barovia ? "Beyond the Mists" : "Command Center",
    characters: barovia ? "Lost Souls" : "Characters",
    tabletop: barovia ? "The Mists Await" : "Expedition Tabletop",
    enemies: barovia ? "Creatures of the Mists" : "Enemy Miniature Studio",
  } as const;
}
