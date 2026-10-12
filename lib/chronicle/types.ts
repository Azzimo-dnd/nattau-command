export type ChronicleEntry = {
  id: string;
  title: string;
  description: string;
  tag: string;
  created_at: string;
  sort_index: number;
};

export const CHRONICLE_TAGS = [
  "Military", "Settlement", "Trade", "Intelligence", "Discovery",
  "Diplomacy", "Personal", "Quest", "Arcane Incident", "Festival", "Other"
] as const;
