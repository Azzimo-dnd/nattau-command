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

export type ResourceDeploymentCost = {
  type: "resource";
  resource: "RP";
  options: Array<{
    amount: number;
    label?: string;
  }>;
};

export type SessionDebuffDeploymentCost = {
  type: "session-debuff";
  amount: number;
  timing: "next-session";
};

export type DeploymentCost =
  | ResourceDeploymentCost
  | SessionDebuffDeploymentCost;

export type MilitaryTheme = "standard" | "azzimo";

export type MilitaryDurability =
  | {
      type: "finite";
      current: number;
      max: number;
    }
  | {
      type: "infinite";
      label: string;
      description: string;
    };

export type MilitaryUnit = {
  name: string;
  commander: string;
  size: string;
  cost: DeploymentCost;
  status: MilitaryStatus;
  detail: string;
  durability: MilitaryDurability;
  headquarters: Headquarters;
  members: string[];
  theme?: MilitaryTheme;
};

export function formatDeploymentCost(cost: DeploymentCost) {
  if (cost.type === "session-debuff") {
    const noun = cost.amount === 1 ? "Debuff" : "Debuffs";
    return `${cost.amount} ${noun} · next session`;
  }

  return cost.options
    .map((option) => {
      const base = `${option.amount} ${cost.resource}`;
      return option.label ? `${base} ${option.label}` : base;
    })
    .join(" / ");
}

export const militaryUnits: MilitaryUnit[] = [
  {
    name: "Defensive Detachment",
    commander: "Captain Varron Holt",
    size: "6 combatants",
    cost: {
      type: "resource",
      resource: "RP",
      options: [{ amount: 1 }],
    },
    status: "Ready",
    detail: "Fighters, battle mages and line support.",
    durability: { type: "finite", current: 1, max: 1 },
    headquarters: {
      state: "available",
      constructionCost: "3 RP",
    },
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
    cost: {
      type: "resource",
      resource: "RP",
      options: [{ amount: 1 }],
    },
    status: "Ready",
    detail: "Artificers, heavy weapons, traps and prototypes.",
    durability: { type: "finite", current: 1, max: 1 },
    headquarters: {
      state: "available",
      constructionCost: "3 RP",
    },
    members: ["Master Tink Reval", "Bratt Copperbelly", "Velka Marr", "Pykko"],
  },
  {
    name: "Hunters of Ared",
    commander: "Ared Helmsong",
    size: "12 hunters",
    cost: {
      type: "resource",
      resource: "RP",
      options: [{ amount: 2 }],
    },
    status: "On Mission",
    detail:
      "Scouts and trackers. The unit has doubled in size and established a new headquarters.",
    durability: { type: "finite", current: 2, max: 2 },
    headquarters: {
      state: "built",
      name: "Hunter's Lodge",
    },
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
    cost: {
      type: "resource",
      resource: "RP",
      options: [{ amount: 3 }, { amount: 6 }],
    },
    status: "Inactive",
    detail:
      "Faith, battlefield support and morale control. Currently inactive due to Mother Tyllen's poor health.",
    durability: { type: "finite", current: 4, max: 4 },
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
    cost: {
      type: "resource",
      resource: "RP",
      options: [{ amount: 2 }],
    },
    status: "Ready",
    detail: "Heavy shield infantry and defensive formation troops.",
    durability: { type: "finite", current: 1, max: 1 },
    headquarters: {
      state: "available",
      constructionCost: "3 RP",
    },
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
    cost: {
      type: "resource",
      resource: "RP",
      options: [{ amount: 1 }],
    },
    status: "Garrisoned",
    detail: "Line guards, officers and limited magical support.",
    durability: { type: "finite", current: 1, max: 1 },
    headquarters: {
      state: "available",
      constructionCost: "3 RP",
    },
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
    cost: {
      type: "resource",
      resource: "RP",
      options: [{ amount: 1 }],
    },
    status: "Supporting",
    detail: "Repairs, logistics, field maintenance and emergency fixes.",
    durability: { type: "finite", current: 1, max: 1 },
    headquarters: {
      state: "available",
      constructionCost: "3 RP",
    },
    members: ["Goran Smelt", "Nisra Coilhand", "Tullen Barrow", "Hoppik"],
  },
  {
    name: "Azzimo's Carnival",
    commander: "Jerry the Clown",
    size: "13 horrors",
    cost: {
      type: "session-debuff",
      amount: 1,
      timing: "next-session",
    },
    status: "Ready",
    detail:
      "A grotesque travelling circus devoted to Azzimo. The Carnival asks for no Expedition resources — its price is paid by the Kainites during the next session. Killing its horrors offers only a temporary reprieve: they always return.",
    durability: {
      type: "infinite",
      label: "Eternal",
      description:
        "The Carnival cannot be permanently destroyed. Its horrors return after death and are always available to serve Azzimo again.",
    },
    headquarters: {
      state: "unavailable",
      reason: "The Carnival is nomadic and maintains no permanent headquarters.",
    },
    members: [
      "Jerry the Clown",
      "Inky",
      "Otto",
      "Lady of Fire",
      "Lobster Boy",
      "Stabitha",
      "Little TiMmy",
      "White Rabbit Mage",
      "Bulette on a Ball ×3",
      "Clown Hydra",
      "Contortionist",
    ],
    theme: "azzimo",
  },
];
