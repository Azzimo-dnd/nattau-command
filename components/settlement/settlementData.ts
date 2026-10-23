export type BuildingCategory =
  | "food"
  | "military"
  | "civic"
  | "housing"
  | "special"
  | "infrastructure";

export type BuildingStatus =
  | "active"
  | "stable"
  | "damaged"
  | "destroyed"
  | "rebuilding"
  | "inactive"
  | "planned";

export type SettlementBuilding = {
  id: string;
  name: string;
  category: BuildingCategory;
  status: BuildingStatus;
  x: number;
  y: number;
  icon: string;
  summary: string;
  output?: string;
  notes: string[];
  rebuildProgress?: number;
  rebuildNote?: string;
  confirmedAfterSiege?: boolean;
};

export const settlementSummary = {
  name: "UĆ Village",
  population: "Count pending",
  morale: "High",
  food: "Supplies damaged",
  defense: "Under assessment",
  civilianCasualties: "About 40 civilians",
  galleonCasualties: "60 galleon crew",
  militaryCasualties: "5 soldiers",
  recovery: "Mobilizing",
};
export type SettlementSummary = typeof settlementSummary;
export const SIEGE_DATE = "22 October 2026";
export const settlementAftermath = {
  casualtiesNote: "Kealith fell during the siege. Kevin returned through Nithis's power. Mira remains missing.",
  moraleNote: "Torsten's funeral address held the community together. Pippo pledged workers and materials.",
  mapNote: "Historical layout from before the siege. Markers reflect confirmed aftermath only; other locations have not been reassessed.",
};

export const settlementBuildings: SettlementBuilding[] = [
  {
    id: "village-gate",
    name: "Village Gate",
    category: "infrastructure",
    status: "stable",
    x: 50,
    y: 94,
    icon: "🚪",
    summary: "Main fortified entrance into UĆ.",
    notes: [
      "Controls movement in and out of the village.",
      "Connected to the defensive palisade.",
    ],
  },
  {
    id: "defensive-walls",
    name: "Defensive Palisade",
    category: "military",
    status: "stable",
    x: 98,
    y: 58,
    icon: "🛡",
    summary: "Wooden defensive wall surrounding the settlement.",
    notes: [
      "Provides basic protection against raids.",
      "Supported by watchtowers and the main gate.",
    ],
  },
  {
    id: "watchtower",
    name: "Watchtower",
    category: "military",
    status: "active",
    x: 20,
    y: 23,
    icon: "🗼",
    summary: "Raised observation post watching the jungle approaches.",
    notes: [
      "Useful for early warning.",
      "Can coordinate with scouts and guards.",
    ],
  },
  {
    id: "council-hall",
    name: "Council Hall",
    category: "civic",
    status: "active",
    x: 50,
    y: 29,
    icon: "🏛",
    summary: "Administrative heart of the village.",
    notes: [
      "Used for planning, council meetings and settlement decisions.",
      "Important civic location for the Kainite expedition.",
    ],
  },
  {
    id: "flying-galleon",
    name: "Flying Galleon",
    category: "special",
    status: "destroyed",
    x: 48,
    y: 51,
    icon: "⛵",
    summary: "Destroyed when Imperial fire struck its core; all 60 crew members died.",
    confirmedAfterSiege: true,
    rebuildProgress: 0,
    rebuildNote: "Destroyed; no reconstruction approved.",
    notes: [
      "The historic map still shows the former galleon site.",
      "The wreck remains as a memorial to the lost crew.",
    ],
  },
  {
    id: "temple-of-baldar",
    name: "Temple of Baldar",
    category: "civic",
    status: "active",
    x: 84,
    y: 42,
    icon: "🏆",
    summary: "Stone temple marked with Baldar's golden chalice symbols.",
    notes: [
      "Religious center of the settlement.",
      "Located near the dead fertility tree.",
    ],
  },
  {
    id: "dead-fertility-tree",
    name: "Dead Fertility Tree",
    category: "special",
    status: "damaged",
    x: 71,
    y: 45,
    icon: "🌳",
    summary: "A dead monument of what was once a magical tree of abundance.",
    notes: [
      "No leaves and no magical aura remain.",
      "Its death may have spiritual or agricultural consequences.",
    ],
  },
  {
    id: "fairy-portal",
    name: "Fairy Portal",
    category: "special",
    status: "active",
    x: 50,
    y: 7,
    icon: "✨",
    summary: "A magical portal connected to the fairies.",
    notes: [
      "Located at the northern edge of the village.",
      "Allow contact with the fairy realm and potential magical aid.",
    ],
  },
  {
    id: "swamp-herb-fields",
    name: "Swamp Herb Plantation",
    category: "food",
    status: "active",
    x: 35,
    y: 15,
    icon: "🌿",
    summary: "Cultivated swamp herb plots.",
    output: "+2 PRP / month if sold through trade.",
    notes: [
      "Produces potential resource value rather than direct resources.",
      "Requires buyers, merchants or trade routes.",
    ],
  },
  {
    id: "magical-cabbage-fields",
    name: "Magical Cabbage Fields",
    category: "food",
    status: "active",
    x: 62,
    y: 15,
    icon: "🥬",
    summary: "Strategic magical cabbage crop supporting the food supply.",
    output: "Part of the current stable food surplus.",
    notes: [
      "Together with grain, production slightly exceeds demand.",
      "Gives a glimps of luck after eating, but also has a chance of mild stomach upset.",
    ],
  },
  {
    id: "grain-fields-west",
    name: "Western Grain Fields",
    category: "food",
    status: "active",
    x: 17,
    y: 38,
    icon: "🌾",
    summary: "Large fenced grain field on the western side of the village.",
    output: "Supports the village food supply.",
    notes: [
      "One of the core agricultural areas of UĆ.",
      "Helps maintain current food stability.",
    ],
  },
  {
    id: "grain-fields-southwest",
    name: "Southwestern Grain Fields",
    category: "food",
    status: "active",
    x: 18,
    y: 78,
    icon: "🌾",
    summary: "Southern grain production field.",
    output: "Supports the village food supply.",
    notes: ["Part of the village's stable food production."],
  },
  {
    id: "grain-fields-southeast",
    name: "Southeastern Grain Fields",
    category: "food",
    status: "active",
    x: 76,
    y: 78,
    icon: "🌾",
    summary: "Large grain field near the eastern road.",
    output: "Supports the village food supply.",
    notes: ["Part of the village's stable food production."],
  },
  {
    id: "healers-tent",
    name: "Healers' Tent",
    category: "civic",
    status: "active",
    x: 8,
    y: 42,
    icon: "⛺",
    summary: "Medical tent used by healers and caretakers.",
    notes: [
      "Supports recovery after incidents, raids or expeditions.",
      "Important during festivals and military activity.",
    ],
  },
  {
    id: "warehouse-stables",
    name: "Warehouse & Stables",
    category: "infrastructure",
    status: "damaged",
    x: 31,
    y: 44,
    icon: "📦",
    summary: "The warehouse burned during the siege, destroying part of UĆ\'s supplies; the stables\' condition is unconfirmed.",
    confirmedAfterSiege: true,
    rebuildProgress: 0,
    rebuildNote: "Damage assessment and salvage pending.",
    notes: [
      "Assess surviving stores and the structure before reopening.",
      "Important for trade and expeditions.",
    ],
  },
  {
    id: "tavern",
    name: "Tavern",
    category: "civic",
    status: "active",
    x: 55,
    y: 73,
    icon: "🍺",
    summary: "Social center of the settlement.",
    notes: [
      "Used by travelers, workers and off-duty guards.",
      "Useful place for rumors and informal meetings.",
    ],
  },
  {
    id: "residential-district",
    name: "Residential District",
    category: "housing",
    status: "destroyed",
    x: 25,
    y: 86,
    icon: "🏠",
    summary: "Most homes were set on fire in the Imperial siege; many survivors need shelter.",
    confirmedAfterSiege: true,
    rebuildProgress: 0,
    rebuildNote: "Housing reconstruction not yet started.",
    notes: [
      "Most houses were burned; this does not imply every house was lost.",
      "Pippo pledged materials and workers for the rebuild.",
    ],
  },
];

export function getCategoryLabel(category: BuildingCategory) {
  switch (category) {
    case "food":
      return "Food";
    case "military":
      return "Military";
    case "civic":
      return "Civic";
    case "housing":
      return "Housing";
    case "special":
      return "Special";
    case "infrastructure":
      return "Infrastructure";
    default:
      return "Unknown";
  }
}
export const settlementCategories: BuildingCategory[] = [
  "food", "military", "civic", "housing", "special", "infrastructure",
];
export const settlementStatuses: BuildingStatus[] = [
  "active", "stable", "damaged", "destroyed", "rebuilding", "inactive", "planned",
];
export const settlementSummaryFields = [
  "population", "morale", "food", "defense",
  "civilianCasualties", "galleonCasualties", "militaryCasualties", "recovery",
] as const;

export function isSettlementBuilding(value: unknown): value is SettlementBuilding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && v.id.length > 0 && v.id.length <= 100
    && typeof v.name === "string" && v.name.trim().length > 0 && v.name.length <= 120
    && settlementCategories.includes(v.category as BuildingCategory)
    && settlementStatuses.includes(v.status as BuildingStatus)
    && typeof v.x === "number" && Number.isFinite(v.x) && v.x >= 0 && v.x <= 100
    && typeof v.y === "number" && Number.isFinite(v.y) && v.y >= 0 && v.y <= 100
    && typeof v.icon === "string" && v.icon.length > 0 && v.icon.length <= 24
    && typeof v.summary === "string" && v.summary.trim().length > 0 && v.summary.length <= 2000
    && (v.output === undefined || typeof v.output === "string" && v.output.length <= 500)
    && Array.isArray(v.notes) && v.notes.length <= 15 && v.notes.every(x => typeof x === "string" && x.length <= 400)
    && (v.rebuildProgress === undefined || Number.isInteger(v.rebuildProgress) && (v.rebuildProgress as number) >= 0 && (v.rebuildProgress as number) <= 100)
    && (v.rebuildNote === undefined || typeof v.rebuildNote === "string" && v.rebuildNote.length <= 1000)
    && (v.confirmedAfterSiege === undefined || typeof v.confirmedAfterSiege === "boolean");
}

export function mergeSettlementBuildings(overrides: SettlementBuilding[]): SettlementBuilding[] {
  const merged = new Map(settlementBuildings.map(building => [building.id, building]));
  for (const override of overrides) {
    if (isSettlementBuilding(override)) merged.set(override.id, override);
  }
  return Array.from(merged.values());
}
