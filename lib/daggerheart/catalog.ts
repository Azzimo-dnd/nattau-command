export type DaggerheartClassOption = {
  key: string;
  label: string;
  source: "core" | "hope-fear";
  domains: [string, string];
  startingEvasion: number;
  startingHitPoints: number;
  subclasses: { key: string; label: string }[];
};

export const daggerheartDomains = [
  "Arcana", "Blade", "Bone", "Codex", "Grace", "Midnight", "Sage", "Splendor", "Valor", "Dread",
] as const;

export const daggerheartClasses: DaggerheartClassOption[] = [
  { key: "bard", label: "Bard", source: "core", domains: ["Grace", "Codex"], startingEvasion: 10, startingHitPoints: 5, subclasses: [
    { key: "troubadour", label: "Troubadour" }, { key: "wordsmith", label: "Wordsmith" },
  ]},
  { key: "druid", label: "Druid", source: "core", domains: ["Sage", "Arcana"], startingEvasion: 10, startingHitPoints: 6, subclasses: [
    { key: "warden-elements", label: "Warden of the Elements" }, { key: "warden-renewal", label: "Warden of Renewal" },
  ]},
  { key: "guardian", label: "Guardian", source: "core", domains: ["Valor", "Blade"], startingEvasion: 9, startingHitPoints: 7, subclasses: [
    { key: "stalwart", label: "Stalwart" }, { key: "vengeance", label: "Vengeance" },
  ]},
  { key: "ranger", label: "Ranger", source: "core", domains: ["Bone", "Sage"], startingEvasion: 12, startingHitPoints: 6, subclasses: [
    { key: "beastbound", label: "Beastbound" }, { key: "wayfinder", label: "Wayfinder" },
  ]},
  { key: "rogue", label: "Rogue", source: "core", domains: ["Midnight", "Grace"], startingEvasion: 12, startingHitPoints: 6, subclasses: [
    { key: "nightwalker", label: "Nightwalker" }, { key: "syndicate", label: "Syndicate" },
  ]},
  { key: "seraph", label: "Seraph", source: "core", domains: ["Splendor", "Valor"], startingEvasion: 9, startingHitPoints: 7, subclasses: [
    { key: "divine-wielder", label: "Divine Wielder" }, { key: "winged-sentinel", label: "Winged Sentinel" },
  ]},
  { key: "sorcerer", label: "Sorcerer", source: "core", domains: ["Arcana", "Midnight"], startingEvasion: 10, startingHitPoints: 6, subclasses: [
    { key: "elemental-origin", label: "Elemental Origin" }, { key: "primal-origin", label: "Primal Origin" },
  ]},
  { key: "warrior", label: "Warrior", source: "core", domains: ["Blade", "Bone"], startingEvasion: 11, startingHitPoints: 6, subclasses: [
    { key: "call-brave", label: "Call of the Brave" }, { key: "call-slayer", label: "Call of the Slayer" },
  ]},
  { key: "wizard", label: "Wizard", source: "core", domains: ["Codex", "Splendor"], startingEvasion: 11, startingHitPoints: 5, subclasses: [
    { key: "school-knowledge", label: "School of Knowledge" }, { key: "school-war", label: "School of War" },
  ]},
  { key: "assassin", label: "Assassin", source: "hope-fear", domains: ["Blade", "Midnight"], startingEvasion: 12, startingHitPoints: 5, subclasses: [
    { key: "executioners-guild", label: "Executioners Guild" }, { key: "poisoners-guild", label: "Poisoners Guild" },
  ]},
  { key: "brawler", label: "Brawler", source: "hope-fear", domains: ["Valor", "Bone"], startingEvasion: 10, startingHitPoints: 6, subclasses: [
    { key: "juggernaut", label: "Juggernaut" }, { key: "martial-artist", label: "Martial Artist" },
  ]},
  { key: "warlock", label: "Warlock", source: "hope-fear", domains: ["Dread", "Grace"], startingEvasion: 11, startingHitPoints: 5, subclasses: [
    { key: "pact-endless", label: "Pact of the Endless" }, { key: "pact-wrathful", label: "Pact of the Wrathful" },
  ]},
  { key: "witch", label: "Witch", source: "hope-fear", domains: ["Sage", "Dread"], startingEvasion: 10, startingHitPoints: 6, subclasses: [
    { key: "hedge", label: "Hedge" }, { key: "moon", label: "Moon" },
  ]},
];

export const daggerheartAncestries = [
  "Clank", "Drakona", "Dwarf", "Elf", "Faerie", "Faun", "Firbolg", "Fungril", "Galapa", "Giant",
  "Goblin", "Halfling", "Human", "Infernis", "Katari", "Orc", "Ribbet", "Simiah",
  "Aetheris", "Earthkin", "Emberkin", "Skykin", "Tidekin", "Gnome",
] as const;

export const daggerheartCommunities = [
  "Highborne", "Loreborne", "Orderborne", "Ridgeborne", "Seaborne", "Slyborne", "Underborne", "Wanderborne", "Wildborne",
  "Duneborne", "Freeborne", "Frostborne", "Hearthborne", "Reborne", "Warborne",
] as const;

export const daggerheartTransformations = [
  "Demigod", "Ghost", "Reanimated", "Shapeshifter", "Vampire", "Werewolf",
] as const;

export const daggerheartTraits = [
  "agility", "strength", "finesse", "instinct", "presence", "knowledge",
] as const;

export function classOption(key: string | null | undefined) {
  return daggerheartClasses.find((item) => item.key === key) ?? null;
}
