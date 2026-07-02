export type ProvinceStatus =
  | "controlled"
  | "neutral"
  | "hostile"
  | "contested";

export type ThreatLevel = "low" | "medium" | "high";

export type FactionId =
  | "kainites"
  | "empire"
  | "mazamundi-cult"
  | "wild-lizardfolk"
  | "merrydock"
  | "unknown";

export type Province = {
  id: string;
  number: number;
  name: string;
  owner: string;
  status: ProvinceStatus;
  threatLevel: ThreatLevel;
  description: string;
  points: string;
};

export const provinceControl: Record<number, FactionId[]> = {
  1: ["kainites"],
  2: ["empire"],
  3: ["kainites"],
  4: ["unknown"],
  5: ["unknown"],
  6: ["merrydock"],
  7: ["kainites", "mazamundi-cult"],
  8: ["empire"],
  9: ["mazamundi-cult"],
  10: ["mazamundi-cult"],
  11: ["mazamundi-cult"],
  12: ["wild-lizardfolk"],
};

export function getFactionLabel(factionId: FactionId) {
  switch (factionId) {
    case "kainites":
      return "Kainites";
    case "empire":
      return "Jin Yan Chao";
    case "mazamundi-cult":
      return "Cult of Lord Mazamundi";
    case "wild-lizardfolk":
      return "Wild Lizardfolk";
    case "merrydock":
      return "Merrydock";
    case "unknown":
      return "Unknown";
    default:
      return "Unknown";
  }
}

export function getProvinceControlLabel(provinceNumber: number) {
  const controlledBy = provinceControl[provinceNumber] ?? ["unknown"];

  return controlledBy.map(getFactionLabel).join(" / ");
}

export const provinces: Province[] = [
  {
  id: "uc",
  number: 1,
  name: "UĆ",
  owner: "Kainites",
  status: "controlled",
  threatLevel: "low",
  description:
    "Central province of the Kainite Expedition and the heartland around UĆ.",
  points:
    "36.9,34.6 38.1,34.7 39.2,34.7 40.2,34.7 41.2,34.9 42.3,35.3 43.8,35.3 45.5,35.5 46.7,36.4 47.8,37 48.4,38.6 49.1,40.7 49.6,42.5 49.6,44.1 49.6,44.7 49.4,46.1 49,46.7 47.8,47.4 46.7,48.1 45.8,49 45.4,49.3 44.8,49.7 43.3,49.6 41.7,48.5 40.8,48.2 39.7,47.7 38.2,47.4 36.9,47.4 35.9,47.1 35.3,46.5 36.1,45.9 36.9,44.8 37.5,43.8 37.7,43 37.9,42.1 37.4,40.7 36.9,39.9 36.5,38.9 36.3,37.9 36.6,36.9 36.6,36 36.8,35",
},
  {
  id: "whangaroa",
  number: 2,
  name: "Whangaroa",
  owner: "Jin Yan Chao",
  status: "hostile",
  threatLevel: "high",
  description:
    "Imperial province centered around Whangaroa, a major city of the Jin Yan Chao.",
  points:
    "34.6,38.5 35.6,38.8 36.3,39.6 36.9,39.9 37.4,40.7 37.9,42.1 37.7,43 37.5,43.8 36.9,44.8 36.1,45.9 35.3,46.5 34.8,46.5 33.9,46.2 33.1,45.4 32.4,44.9 31.3,43.7 30,43.3 29,43 28.1,42 28.8,41.3 29.7,41.7 30.4,41 31,40.4 31.5,39.4 32,38.7 33.1,38.5",
},
  {  id: "guardian-house",
  number: 3,
  name: "Guardian House",
  owner: "Kainites",
  status: "controlled",
  threatLevel: "medium",
  description:
    "Strategic fortress province guarding the northern approaches and mountain passes.",
  points:
    "36.5,34.4 36.7,35.6 36.9,37 37,38.1 36.9,39 36.3,39.6 35.6,38.8 34.6,38.5 33.1,38.5 32,38.7 31.5,39.4 31,40.4 30.4,41 29.7,41.7 28.3,41.7 27.5,40.4 26.9,39 26.3,38.1 24.6,36.8 24.4,35.6 25.5,35.6 26.5,34.1 27.1,33.2 28.4,31.9 29,32.5 29.9,32.1 31.2,31.9 32.9,31.9 33.5,32.2 34.7,32.5 35.6,33.2 36,33.3",
},
  {
  id: "northwestern-wilds",
  number: 4,
  name: "Northwestern Wilds",
  owner: "Unknown",
  status: "neutral",
  threatLevel: "medium",
  description:
    "Remote jungle and coastal wilderness west of the northern mountains.",
  points:
    "27.1,33.2 26.5,34.1 25.5,35.6 24.5,35.8 23.2,35.6 22.3,34.5 20.8,33.2 19.9,32.5 18.9,31 17.4,29.5 16.5,28.4 16,26.9 16.2,25.5 16.5,24 17.4,23.3 18.5,22.7 19.4,22.6 20.4,22 21.1,22.1 21.7,23.5 22.5,24.7 23.6,25.8 24.7,26.9 25.5,27.9 26.9,28.7 27.9,28.9 28.4,31.9",
},
  {
  id: "northern-road",
  number: 5,
  name: "Northern Road",
  owner: "Merrydock",
  status: "neutral",
  threatLevel: "low",
  description:
    "Northern inland province connecting Merrydock, the mountains and the western wilds.",
  points:
    "21.1,22.1 22.1,21.4 24,20.6 26.9,20.6 28.4,20.6 31.2,20.3 32.4,20.1 33,21.5 33.7,22.6 33.9,24.1 33.9,25.5 33.7,27 33.1,27.9 31.5,28.7 30.5,28.7 29.4,28.6 28.6,28.6 27.9,28.9 26.9,28.7 25.5,27.9 24.7,26.9 23.6,25.8 22.5,24.7 21.7,23.5",
},
  {
    id: "merrydock",
    number: 6,
    name: "Merrydock",
    owner: "Merrydock",
    status: "neutral",
    threatLevel: "low",
    description:
      "Northern trade province controlled by Merrydock, known for halflings, trade and suspiciously practical cabbage logistics.",
    points:
      "32.4,20.3 32.8,21.4 33.3,22 33.7,23.7 33.8,24.9 33.6,26.4 34.6,27.6 36.8,28.6 38.2,28.9 39.7,29.2 43.5,29.8 44.6,29.9 45.6,30.2 47.3,30.7 47.9,30.7 48.1,29.6 47.4,26.4 46.3,24.9 45.2,23.8 44.4,23.5 42.9,22.6 41.7,21.8 40.4,21.4 39.2,20.7 38.2,20.3 37.1,20 35.8,19.8 34.4,19.8 33.6,19.7 32.7,19.7",
  },
  {
    id: "pipdock",
    number: 7,
    name: "Pipdock",
    owner: "Kainites",
    status: "controlled",
    threatLevel: "medium",
    description:
      "Eastern coastal province around Pipdock, important for sea access and supply routes.",
    points:
      "50.1,44.8 49,46.3 48.4,46.9 47.5,47.7 46.4,48.3 45.8,49.2 45.8,51.1 47,52.2 48.4,52.9 49.4,53.8 50,54.6 50.8,55.1 51.8,55.7 53.6,56.3 54.5,56.6 55.5,56.6 56.4,56.4 57.2,56.3 57,54.8 56.9,53.5 56.4,51.8 56,50 55.4,49.1 54.7,48.3 53.9,47.2 53,46.5 52.4,45.7 51.5,45.1 50.7,44.9",
  },
  {
  id: "western-jungle",
  number: 8,
  name: "Western Jungle",
  owner: "Unknown",
  status: "contested",
  threatLevel: "medium",
  description:
    "Dense jungle province between Whangaroa, UĆ and the southern lands.",
  points:
    "35.3,46.5 35.9,47.1 36.9,47.4 38.2,47.4 39.7,47.7 40.8,48.2 41.7,48.5 43.3,49.6 44.8,49.7 45.4,49.3 45.8,49 46.3,51.5 46.4,53.1 45.8,53.7 44.5,54.1 43.1,54.6 42.5,55.7 42.3,56.7 42.1,57.8 42.2,59 42.4,60.4 41,60.3 40,60.3 39.1,60.4 37.8,60.4 36.9,58.7 36.1,57.1 35.8,55.1 35.8,53.7 35.3,51.2 35.2,49.9 35.1,47.7",
},
  {
    id: "central-hills",
    number: 9,
    name: "Central Hills",
    owner: "Wild Lizardfolk",
    status: "hostile",
    threatLevel: "high",
    description:
      "Central highland and jungle region, difficult to cross and dangerous to control.",
    points:
      "46.4,53.1 47.3,52.7 48.2,53.1 49,53.4 49.8,54.3 50.8,54.6 51.4,55.5 51.8,56.3 51.4,57.7 51,59 50.8,60.7 49.9,61.5 49.7,63 48.9,62.9 47.8,62.9 46.7,62.7 45.6,61.9 44.4,61 43.5,60.6 42.7,60.3 42.2,59 42.1,57.8 42.3,56.7 42.5,55.7 43.1,54.6 44.5,54.1 45.8,53.7",
  },
  {
  id: "eastern-corridor",
  number: 10,
  name: "Eastern Corridor",
  owner: "Cult of Lord Mazamundi",
  status: "hostile",
  threatLevel: "high",
  description:
    "Eastern jungle corridor between Pipdock and the southern temple lands.",
  points:
    "51.8,56.3 52.1,56.4 54.7,56.9 56,57.2 56.9,57.2 58.1,58.1 58.7,58.9 59.2,60.4 59,62.1 58.9,63.3 58.7,65.2 59.3,65.6 58.9,66.1 57.1,66.5 55.9,66.8 55.2,66.8 52.4,66.5 51,66.4 50.9,65.3 50.5,63.8 49.7,63 49.9,61.5 50.8,60.7 51,59 51.4,57.7",
},
  {
  id: "southern-ruins",
  number: 11,
  name: "Southern Ruins",
  owner: "Wild Lizardfolk",
  status: "hostile",
  threatLevel: "high",
  description:
    "Southern jungle province marked by ruins, old stonework and hostile wilderness.",
  points:
    "37.8,60.4 39.1,60.4 40,60.3 41,60.3 42.4,60.4 43.5,60.8 44.4,61.2 45.6,62 46.7,62.7 47.8,62.9 48.9,62.9 49.7,63 50.5,63.8 50.9,65.3 51,66.4 52.4,66.5 53.4,66.8 54.2,67.3 54.5,68.2 53.9,69.1 52.8,69.9 51.7,70.7 50.7,71.3 50,72.1 46.6,72.7 45.4,72.1 44.4,71.1 43,69.6 41.7,68.2 41,67.3 39.9,66.2 39.1,65 38.3,63.3 38.1,62.2 37.7,61.3",
},
  {
  id: "main-temple",
  number: 12,
  name: "Main Temple",
  owner: "Cult of Lord Mazamundi",
  status: "hostile",
  threatLevel: "high",
  description:
    "Southern temple province dominated by ancient structures and cult influence.",
  points:
    "52.4,66.5 55.2,66.8 55.9,66.8 57.1,66.5 58.9,66.1 59.3,65.6 61,65.5 62.2,65.9 63.3,66.4 64.6,67 65.6,67.6 67.6,69.1 67.9,69.5 68.1,70.5 68.3,71.7 68.1,72.8 67.7,74 67,75.1 66.3,75.7 64.6,77.3 61.5,77.4 58.2,77.3 57.6,77.3 56.2,77.3 54.8,77.3 53.9,78 53,78.5 52,78.5 50.7,77.1 49.6,76.3 48.6,75.7 47.8,74.8 46.6,73.9 45.9,73.1 45.1,72.1 46.3,72.7 47.9,72.7 48.7,72.7 49.8,72.4 50,72.1 50.7,71.3 51.7,70.7 52.8,69.9 53.9,69.1 54.5,68.2 54.2,67.3 53.4,66.8",
},
];