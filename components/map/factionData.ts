export type FactionRelation = {
  type: "ally" | "trade" | "neutral" | "non-aggression" | "enemy" | "unknown";
  faction: string;
};

export type Faction = {
  id: string;
  name: string;
  description: string;
  controlledProvinces: number;
  controlledArmies: number;
  relations: FactionRelation[];
};

export const factions: Faction[] = [
  {
    id: "kainites",
    name: "Kainites & Allies",
    description:
      "The Kainite Expedition is a growing military-religious force centered around UĆ, Baldar's faith and the survival of the settlers.",
    controlledProvinces: 3,
    controlledArmies: 1,
    relations: [
      { type: "trade", faction: "Merrydock" },
      { type: "non-aggression", faction: "Cult of Lord Mazamundi" },
      { type: "enemy", faction: "Wild Lizardfolk" },
      { type: "neutral", faction: "Jin Yan Chao" },
    ],
  },
  {
    id: "jin-yan-chao",
    name: "Jin Yan Chao",
    description:
      "An imperial city-state force with strong military presence on Hinewai. Their long-term intentions toward the expedition remain uncertain.",
    controlledProvinces: 2,
    controlledArmies: 6,
    relations: [
      { type: "neutral", faction: "Kainites & Allies" },
      { type: "enemy", faction: "Wild Lizardfolk" },
      { type: "enemy", faction: "Cult of Lord Mazamundi" },
      { type: "neutral", faction: "Merrydock" },
    ],
  },
  {
    id: "wild-lizardfolk",
    name: "Wild Lizardfolk",
    description:
      "Hostile tribal forces scattered across the island. Aggressive toward nearly every other faction.",
    controlledProvinces: 1,
    controlledArmies: 3,
    relations: [
      { type: "enemy", faction: "Kainites & Allies" },
      { type: "enemy", faction: "Jin Yan Chao" },
      { type: "enemy", faction: "Cult of Lord Mazamundi" },
      { type: "enemy", faction: "Merrydock" },
    ],
  },
  {
    id: "cult-mazamundi",
    name: "Cult of Lord Mazamundi",
    description:
      "A militant cult controlling corrupted territory. Currently bound to the Kainites by a non-aggression agreement and border passage rights.",
    controlledProvinces: 4,
    controlledArmies: 3,
    relations: [
      { type: "non-aggression", faction: "Kainites & Allies" },
      { type: "enemy", faction: "Wild Lizardfolk" },
      { type: "enemy", faction: "Jin Yan Chao" },
      { type: "unknown", faction: "Merrydock" },
    ],
  },
  {
    id: "merrydock",
    name: "Merrydock",
    description:
      "A northern trade settlement focused on commerce, survival and profitable neutrality.",
    controlledProvinces: 1,
    controlledArmies: 0,
    relations: [
      { type: "trade", faction: "Kainites & Allies" },
      { type: "neutral", faction: "Jin Yan Chao" },
      { type: "neutral", faction: "Cult of Lord Mazamundi" },
      { type: "enemy", faction: "Wild Lizardfolk" },
    ],
  },
];