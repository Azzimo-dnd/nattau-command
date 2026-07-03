export type MilitaryStatus =
  | "Ready"
  | "Operational"
  | "Expanded"
  | "Inactive"
  | "Garrisoned"
  | "Supporting"
  | "On Mission"
  | "Wounded";

export type Headquarters =
  | {
      state: "built";
      name: string;
    }
  | {
      state: "available";
      constructionCost: string;
    }
  | {
      state: "unavailable";
      reason: string;
    };

export type MilitaryUnit = {
  name: string;
  commander: string;
  size: string;
  cost: string;
  status: MilitaryStatus;
  detail: string;
  durability: number;
  maxDurability: number;
  headquarters: Headquarters;
  members: string[];
};

export const militaryUnits: MilitaryUnit[] = [
  {
    name: "Defensive Detachment",
    commander: "Captain Varron Holt",
    size: "6 combatants",
    cost: "1 RP",
    status: "Ready",
    detail: "Fighters, battle mages and line support.",
    durability: 1,
    maxDurability: 1,
    headquarters: { state: "available", constructionCost: "3 RP" },
    members: [
      "Captain Varron Holt",
      "Mirael Flamehand",
      "Dorek “Iron Hound”",
      "Sileth",
      "Karos Fen",
    ],
  },
  {
    name: "Artillery Corps",
    commander: "Master Tink Reval",
    size: "4 specialists",
    cost: "1 RP",
    status: "Ready",
    detail: "Artificers, heavy weapons, traps and prototypes.",
    durability: 1,
    maxDurability: 1,
    headquarters: { state: "available", constructionCost: "3 RP" },
    members: ["Master Tink Reval", "Bratt Copperbelly", "Velka Marr", "Pykko"],
  },
  {
    name: "Hunters of Ared",
    commander: "Ared Helmsong",
    size: "12 hunters",
    cost: "2 RP",
    status: "On Mission",
    detail:
      "Scouts and trackers. The unit has doubled in size and established a new headquarters.",
    durability: 2,
    maxDurability: 2,
    headquarters: { state: "built", name: "Hunter's Lodge" },
    members: [
      "Ared Helmsong",
      "Lera Quickstep",
      "Gholz",
      "Elin Marr",
      "Pippo",
      "Noktar",
    ],
  },
  {
    name: "Daughters of Kain",
    commander: "Mother Tyllen",
    size: "Elite priesthood",
    cost: "3 RP / 6 RP",
    status: "Inactive",
    detail:
      "Faith, battlefield support and morale control. Currently inactive due to Mother Tyllen's poor health.",
    durability: 4,
    maxDurability: 4,
    headquarters: {
      state: "unavailable",
      reason: "Unavailable while Mother Tyllen is in poor health.",
    },
    members: ["Mother Tyllen"],
  },
  {
    name: "Pavise Brothers of Kain",
    commander: "Brother Ruven",
    size: "6 shieldbearers",
    cost: "2 RP",
    status: "Ready",
    detail: "Heavy shield infantry and defensive formation troops.",
    durability: 1,
    maxDurability: 1,
    headquarters: { state: "available", constructionCost: "3 RP" },
    members: [
      "Brother Ruven",
      "Brother Vosk",
      "Brother Elgor",
      "Brother Silen",
      "Brother Jarn",
      "Brother Mern",
    ],
  },
  {
    name: "Triboar Guard",
    commander: "Captain Elira Dox",
    size: "12 guards",
    cost: "1 RP",
    status: "Garrisoned",
    detail: "Line guards, officers and limited magical support.",
    durability: 1,
    maxDurability: 1,
    headquarters: { state: "available", constructionCost: "3 RP" },
    members: [
      "Captain Elira Dox",
      "Lieutenant Kral Vint",
      "Renn",
      "Jaro",
      "Fellek",
      "Tramm",
      "Siles",
      "Morrin",
      "Debra",
      "Keth",
      "Sira Menn",
      "Orr Valin",
    ],
  },
  {
    name: "Pit Stop Crew",
    commander: "Goran Smelt",
    size: "4 craftsmen",
    cost: "1 RP",
    status: "Supporting",
    detail: "Repairs, logistics, field maintenance and emergency fixes.",
    durability: 1,
    maxDurability: 1,
    headquarters: { state: "available", constructionCost: "3 RP" },
    members: ["Goran Smelt", "Nisra Coilhand", "Tullen Barrow", "Hoppik"],
  },
];