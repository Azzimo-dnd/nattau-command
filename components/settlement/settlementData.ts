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
};

export const settlementSummary = {
  name: "UĆ Village",
  population: "100+",
  morale: "High",
  food: "Stable Surplus",
  defense: "Fortified",
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
    status: "active",
    x: 48,
    y: 51,
    icon: "⛵",
    summary: "Grounded flying galleon at the center of UĆ.",
    notes: [
      "A major landmark of the settlement.",
      "May serve as storage, command space or transport.",
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
    status: "active",
    x: 31,
    y: 44,
    icon: "📦",
    summary: "Storage and animal handling area.",
    notes: [
      "Used for supplies, transport animals and general logistics.",
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
    status: "stable",
    x: 25,
    y: 86,
    icon: "🏠",
    summary: "Main housing area for settlers.",
    notes: [
      "Unmarked smaller houses are treated as residential buildings.",
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