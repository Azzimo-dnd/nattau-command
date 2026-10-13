import type { StrategicFaction } from "./types";

export const fallbackStrategicFactions: StrategicFaction[] = [
  {
    id: "kainites",
    name: "Kainites & Allies",
    shortName: "Kainites",
    description:
      "The Kainite Expedition is a growing military-religious force centered around UĆ, Baldar's faith and the survival of the settlers.",
    status: "Expedition command",
    armyCount: 1,
    relations: [
      "Trade with Merrydock",
      "Non-aggression with Cult of Lord Mazamundi",
    ],
  },
  {
    id: "empire",
    name: "Jin Yan Chao",
    shortName: "Empire",
    description:
      "An imperial city-state force with strong military presence on Hinewai. Their long-term intentions toward the expedition remain uncertain.",
    status: "Imperial power",
    armyCount: 7,
    relations: [
      "Enemy of Wild Lizardfolk",
      "Enemy of Cult of Lord Mazamundi",
    ],
  },
  {
    id: "mazamundi-cult",
    name: "Cult of Lord Mazamundi",
    shortName: "Mazamundi",
    description:
      "A militant cult controlling corrupted territory. Currently bound to the Kainites by a non-aggression agreement and border passage rights.",
    status: "Dangerous allies?",
    armyCount: 3,
    relations: [
      "Non-aggression with Kainites",
      "Enemy of Jin Yan Chao",
    ],
  },
  {
    id: "wild-lizardfolk",
    name: "Wild Lizardfolk",
    shortName: "Lizardfolk",
    description:
      "Hostile tribal forces scattered across the island. Aggressive toward nearly every other faction.",
    status: "Hostile tribes",
    armyCount: 3,
    relations: ["Enemy of everyone"],
  },
  {
    id: "merrydock",
    name: "Merrydock",
    shortName: "Merrydock",
    description:
      "A northern trade settlement focused on commerce, survival and profitable neutrality.",
    status: "Trade settlement",
    armyCount: 0,
    relations: [
      "Trade with Kainites",
      "Neutral with Jin Yan Chao",
    ],
  },
];
