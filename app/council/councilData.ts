export type Ability = {
  name: string;
  score: number;
  modifier: string;
};

export type CharacterSheet = {
  portrait: string;
  id: string;
  name: string;
  title: string;
  race: string;
  characterClass: string;
  level: number;
  hp: {
    current: number;
    max: number;
  };
  armorClass: number;
  initiative: string;
  speed: string;
  abilities: Ability[];
  savingThrows: Ability[];
  passives: {
    perception: number;
    investigation: number;
    insight: number;
  };
  defenses: string[];
};

export const councilMembers: CharacterSheet[] = [
  {
    portrait: "/public/portraits/torsten.jpg",
    id: "torsten",
    name: "Torsten",
    title: "Master of Baldar's Inquisition",
    race: "Drow",
    characterClass: "Paladin 13",
    level: 13,
    hp: { current: 130, max: 130 },
    armorClass: 19,
    initiative: "+14",
    speed: "30 ft.",
    abilities: [
      { name: "STR", score: 14, modifier: "+2" },
      { name: "DEX", score: 18, modifier: "+4" },
      { name: "CON", score: 14, modifier: "+2" },
      { name: "INT", score: 10, modifier: "+0" },
      { name: "WIS", score: 12, modifier: "+1" },
      { name: "CHA", score: 16, modifier: "+3" },
    ],
    savingThrows: [
      { name: "STR", score: 0, modifier: "+5" },
      { name: "DEX", score: 0, modifier: "+7" },
      { name: "CON", score: 0, modifier: "+5" },
      { name: "INT", score: 0, modifier: "+3" },
      { name: "WIS", score: 0, modifier: "+9" },
      { name: "CHA", score: 0, modifier: "+11" },
    ],
    passives: {
      perception: 16,
      investigation: 10,
      insight: 16,
    },
    defenses: ["Frightened", "Magical Sleep"],
  },
  {
    portrait: "/public/portraits/odetta.jpg",
    id: "odetta",
    name: "Sister Odetta",
    title: "N/A",
    race: "Tiefling",
    characterClass: "Cleric 6 / Sorcerer 5",
    level: 11,
    hp: { current: 87, max: 87 },
    armorClass: 15,
    initiative: "+2",
    speed: "30 ft.",
    abilities: [
      { name: "STR", score: 15, modifier: "+2" },
      { name: "DEX", score: 14, modifier: "+2" },
      { name: "CON", score: 14, modifier: "+2" },
      { name: "INT", score: 13, modifier: "+1" },
      { name: "WIS", score: 15, modifier: "+2" },
      { name: "CHA", score: 16, modifier: "+3" },
    ],
    savingThrows: [
      { name: "STR", score: 0, modifier: "+2" },
      { name: "DEX", score: 0, modifier: "+2" },
      { name: "CON", score: 0, modifier: "+2" },
      { name: "INT", score: 0, modifier: "+1" },
      { name: "WIS", score: 0, modifier: "+6" },
      { name: "CHA", score: 0, modifier: "+7" },
    ],
    passives: {
      perception: 12,
      investigation: 11,
      insight: 16,
    },
    defenses: ["Fire resistance"],
  },
  {
    portrait: "/public/portraits/rabarbar.jpg",
    id: "rabarbar",
    name: "Ra-Bar-Bar",
    title: "N/A",
    race: "Human",
    characterClass: "Barbarian 11",
    level: 11,
    hp: { current: 179, max: 179 },
    armorClass: 18,
    initiative: "+3",
    speed: "50 ft.",
    abilities: [
      { name: "STR", score: 20, modifier: "+5" },
      { name: "DEX", score: 16, modifier: "+3" },
      { name: "CON", score: 20, modifier: "+5" },
      { name: "INT", score: 8, modifier: "-1" },
      { name: "WIS", score: 10, modifier: "+0" },
      { name: "CHA", score: 11, modifier: "+0" },
    ],
    savingThrows: [
      { name: "STR", score: 0, modifier: "+9" },
      { name: "DEX", score: 0, modifier: "+3" },
      { name: "CON", score: 0, modifier: "+9" },
      { name: "INT", score: 0, modifier: "-1" },
      { name: "WIS", score: 0, modifier: "+0" },
      { name: "CHA", score: 0, modifier: "+0" },
    ],
    passives: {
      perception: 10,
      investigation: 9,
      insight: 10,
    },
    defenses: [],
  },
  {
    portrait: "/public/portraits/zibbeth.jpg",
    id: "zibbet",
    name: "Zibbet Stillwater",
    title: "N/A",
    race: "Goblin",
    characterClass: "Rogue 3 / Monk 8",
    level: 11,
    hp: { current: 94, max: 94 },
    armorClass: 19,
    initiative: "+5",
    speed: "55 ft.",
    abilities: [
      { name: "STR", score: 14, modifier: "+2" },
      { name: "DEX", score: 20, modifier: "+5" },
      { name: "CON", score: 14, modifier: "+2" },
      { name: "INT", score: 8, modifier: "-1" },
      { name: "WIS", score: 17, modifier: "+3" },
      { name: "CHA", score: 12, modifier: "+1" },
    ],
    savingThrows: [
      { name: "STR", score: 0, modifier: "+3" },
      { name: "DEX", score: 0, modifier: "+10" },
      { name: "CON", score: 0, modifier: "+3" },
      { name: "INT", score: 0, modifier: "+4" },
      { name: "WIS", score: 0, modifier: "+8" },
      { name: "CHA", score: 0, modifier: "+2" },
    ],
    passives: {
      perception: 13,
      investigation: 9,
      insight: 13,
    },
    defenses: ["Damage dealt by traps"],
  },
];