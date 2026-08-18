export type NattauRuneDefinition = {
  id: string;
  label: string;
  title: string;
  paths: string[];
};

export const NATTAU_RUNE_DEFINITIONS: NattauRuneDefinition[] = [
  {
    id: "awa",
    label: "Awa",
    title: "River-tide",
    paths: [
      "M7 3 V21",
      "M7 6 C11 8, 13 8, 17 6",
      "M7 12 C11 14, 13 14, 17 12",
      "M7 18 C11 20, 13 20, 17 18",
    ],
  },
  {
    id: "matau",
    label: "Matau",
    title: "Hook of the deep",
    paths: [
      "M8 3 V15",
      "M8 15 C8 19, 12 21, 16 19",
      "M16 19 C18 18, 19 16, 19 13",
      "M19 13 L14 13",
    ],
  },
  {
    id: "tara",
    label: "Tara",
    title: "Spear-point",
    paths: [
      "M12 3 V21",
      "M7 9 L12 3 L17 9",
      "M7 21 L12 16 L17 21",
      "M5 12 H19",
    ],
  },
  {
    id: "koru",
    label: "Koru",
    title: "Unfurling frond",
    paths: [
      "M17 7 C15 4, 10 4, 8 8",
      "M8 8 C6 12, 8 17, 13 17",
      "M13 17 C16 17, 18 15, 18 12",
      "M18 12 C18 10, 16.5 9, 15 9",
      "M15 9 C13.5 9, 12.5 10, 12.5 11.5",
      "M12.5 11.5 C12.5 13, 13.7 14, 15.2 14",
    ],
  },
  {
    id: "whetu",
    label: "Whetu",
    title: "Guiding star",
    paths: [
      "M12 3 V21",
      "M4 12 H20",
      "M6 6 L18 18",
      "M18 6 L6 18",
    ],
  },
  {
    id: "ahi",
    label: "Ahi",
    title: "Sacred flame",
    paths: [
      "M12 3 C15 6, 16 9, 15 12",
      "M15 12 C18 13, 19 16, 18 18",
      "M18 18 C16 21, 8 21, 6 17",
      "M6 17 C5 14, 7 11, 10 10",
      "M10 10 C9 7, 10 5, 12 3",
      "M12 9 C13.5 11, 13.5 13.5, 12 16",
    ],
  },
  {
    id: "niho",
    label: "Niho",
    title: "Teeth of the beast",
    paths: [
      "M4 7 H20",
      "M4 17 H20",
      "M6 7 L9 17",
      "M12 7 L15 17",
      "M18 7 L20 14",
    ],
  },
  {
    id: "rangi",
    label: "Rangi",
    title: "Sky-path",
    paths: [
      "M6 5 C9 3, 15 3, 18 5",
      "M6 10 C9 8, 15 8, 18 10",
      "M6 15 C9 13, 15 13, 18 15",
      "M6 20 C9 18, 15 18, 18 20",
      "M12 5 V20",
    ],
  },
];

export const NATTAU_RUNE_IDS = NATTAU_RUNE_DEFINITIONS.map((rune) => rune.id);

export const NATTAU_RUNE_COMPATIBILITY: Record<string, string> = {
  "ᚠ": "awa",
  "ᚢ": "matau",
  "ᚦ": "tara",
  "ᚨ": "koru",
  "ᚱ": "whetu",
  "ᚲ": "ahi",
  "ᚷ": "niho",
  "ᚹ": "rangi",
};

export const NATTAU_RUNE_LOOKUP = Object.fromEntries(
  NATTAU_RUNE_DEFINITIONS.map((rune) => [rune.id, rune])
);

export function normalizeNattauRuneId(rune: string) {
  return NATTAU_RUNE_COMPATIBILITY[rune] ?? rune;
}

export function getNattauRuneDefinition(rune: string) {
  return NATTAU_RUNE_LOOKUP[normalizeNattauRuneId(rune)] ?? null;
}
