import { getNattauRuneDefinition, type NattauRuneDefinition } from "./nattauRunes";

// Original visual motifs for our Barovia puzzles, not a replacement Tarokka deck.
export const BAROVIA_RUNES: NattauRuneDefinition[] = [
  { id: "raven", label: "Raven", title: "The watcher", paths: ["M3 15 L10 9 L13 4 L16 9 L21 10 L17 12 L15 19 L9 17 Z", "M10 9 L12 15 L5 18", "M15 9 H15.1"] },
  { id: "thorn", label: "Thorn", title: "The wound", paths: ["M5 21 C18 14 7 9 19 3", "M8 18 L4 13 L11 15", "M13 10 L9 5 L16 6"] },
  { id: "candle", label: "Candle", title: "The vigil", paths: ["M9 10 H15 V21 H9 Z", "M7 21 H17", "M12 8 C5 7 13 2 12 2 C17 6 15 9 12 8 Z"] },
  { id: "moon", label: "Moon", title: "The witness", paths: ["M16 3 A9 9 0 1 0 20 17 A8 8 0 0 1 16 3 Z"] },
  { id: "key", label: "Key", title: "The threshold", paths: ["M15 3 A4 4 0 1 0 15 11 A4 4 0 1 0 15 3", "M12 10 L3 19 L5 21 L7 19 L6 18 L8 16 L9 17 L11 15"] },
  { id: "bell", label: "Bell", title: "The warning", paths: ["M6 17 C8 15 7 12 8 8 C9 4 15 4 16 8 C17 12 16 15 18 17 Z", "M10 20 H14", "M12 3 V5"] },
  { id: "mirror", label: "Mirror", title: "The absence", paths: ["M5 3 H19 V21 H5 Z", "M8 6 H16 V18 H8 Z", "M12 6 L10 10 L14 13 L11 18"] },
  { id: "rose", label: "Rose", title: "The promise", paths: ["M12 3 L17 6 L18 11 L14 15 L8 14 L5 9 L7 5 Z", "M12 6 L15 9 L12 12 L9 9 Z", "M12 15 V22", "M12 20 L18 16"] },
];

export const BAROVIA_RUNE_IDS = BAROVIA_RUNES.map((rune) => rune.id);
export function getCampaignRuneDefinition(id: string) {
  return BAROVIA_RUNES.find((rune) => rune.id === id) ?? getNattauRuneDefinition(id);
}
