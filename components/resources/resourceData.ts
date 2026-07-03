export type ResourceType = "resource" | "potential-resource" | "food";

export type ResourceSource = {
  id: string;
  name: string;
  type: ResourceType;
  monthlyGain: number;
  unit: string;
  status: string;
  description: string;
  notes?: string[];
};

export const resourceSources: ResourceSource[] = [
  {
    id: "ore-mine",
    name: "Ore Mine",
    type: "resource",
    monthlyGain: 2,
    unit: "RP",
    status: "Stable",
    description:
      "The ore mine provides a stable monthly supply of raw materials for settlement development, repairs and military projects.",
    notes: [
      "Small chance each month to discover diamonds.",
      "Small chance each month to discover traces of magical ore.",
    ],
  },
  {
    id: "coal-mine",
    name: "Coal Mine",
    type: "resource",
    monthlyGain: 1,
    unit: "RP",
    status: "Understaffed",
    description:
      "The coal mine is currently underused due to insufficient workforce allocation. Its production is lower than expected.",
    notes: [
      "Output may increase if more workers are assigned.",
      "Current production is limited by low workforce coverage.",
    ],
  },
  {
    id: "swamp-herb-production",
    name: "Swamp Herb Production",
    type: "potential-resource",
    monthlyGain: 2,
    unit: "PRP",
    status: "Requires Trade",
    description:
      "Swamp herb production generates potential resource points. These must be converted through trade before they can be spent.",
    notes: [
      "Does not directly increase available Resource Points.",
      "Requires buyer, trade route or merchant contact.",
    ],
  },
];

export const foodProduction = {
  name: "Magical Cabbage & Grain Fields",
  monthlyProduction: "Slightly above demand",
  status: "Stable Surplus",
  supportedPopulation: "Current settlement population with a narrow surplus",
  description:
    "Current food production slightly exceeds the needs of the settlement. The surplus is small, but enough to keep the population supplied under normal conditions.",
  notes: [
    "Magical cabbage remains a strategic food source.",
    "Grain production stabilizes the basic food supply.",
    "A major population increase or another sabotage event may create shortages.",
  ],
};

export function getMonthlyResourcePoints() {
  return resourceSources
    .filter((source) => source.type === "resource")
    .reduce((sum, source) => sum + source.monthlyGain, 0);
}

export function getMonthlyPotentialResourcePoints() {
  return resourceSources
    .filter((source) => source.type === "potential-resource")
    .reduce((sum, source) => sum + source.monthlyGain, 0);
}