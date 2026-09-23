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


export type DaggerheartClassCreationGuidance = {
  startingItems: [string, string];
  backgroundQuestions: [string, string, string];
  connectionQuestions: [string, string, string];
  spellContainerPrompt?: string;
};

export const daggerheartClassCreationGuidance: Record<string, DaggerheartClassCreationGuidance> = {
  bard: {
    startingItems: ["Romance novel", "Letter never opened"],
    spellContainerPrompt: "What do you carry your spells in? (songbook, journal, etc.)",
    backgroundQuestions: [
      "Who from your community taught you to have such confidence in yourself?",
      "You were in love once. Who did you adore, and how did they hurt you?",
      "You’ve always looked up to another bard. Who are they, and why do you idolize them?",
    ],
    connectionQuestions: [
      "What made you realize we were going to be such good friends?",
      "What do I do that annoys you?",
      "Why do you grab my hand at night?",
    ],
  },
  druid: {
    startingItems: ["Small bag of rocks and bones", "Strange pendant found in the dirt"],
    backgroundQuestions: [
      "Why was the community you grew up in so reliant on nature and its creatures?",
      "Who was the first wild animal you bonded with? Why did your bond end?",
      "Who has been trying to hunt you down? What do they want from you?",
    ],
    connectionQuestions: [
      "What did you confide in me that makes me leap into danger for you every time?",
      "What animal do I say you remind me of?",
      "What affectionate nickname have you given me?",
    ],
  },
  guardian: {
    startingItems: ["Totem from your mentor", "Secret key"],
    backgroundQuestions: [
      "Who from your community did you fail to protect, and why do you still think of them?",
      "You’ve been tasked with protecting something important and delivering it somewhere dangerous. What is it, and where does it need to go?",
      "You consider an aspect of yourself to be a weakness. What is it, and how has it affected you?",
    ],
    connectionQuestions: [
      "How did I save your life the first time we met?",
      "What small gift did you give me that you notice I always carry with me?",
      "What lie have you told me about yourself that I absolutely believe?",
    ],
  },
  ranger: {
    startingItems: ["Trophy from your first kill", "Seemingly broken compass"],
    backgroundQuestions: [
      "A terrible creature hurt your community, and you’ve vowed to hunt them down. What are they, and what unique trail or sign do they leave behind?",
      "Your first kill almost killed you, too. What was it, and what part of you was never the same after that event?",
      "You’ve traveled many dangerous lands, but what is the one place you refuse to go?",
    ],
    connectionQuestions: [
      "What friendly competition do we have?",
      "Why do you act differently when we’re alone than when others are around?",
      "What threat have you asked me to watch for, and why are you worried about it?",
    ],
  },
  rogue: {
    startingItems: ["Set of forgery tools", "Grappling hook"],
    backgroundQuestions: [
      "What did you get caught doing that got you exiled from your home community?",
      "You used to have a different life, but you’ve tried to leave it behind. Who from your past is still chasing you?",
      "Who from your past were you most sad to say goodbye to?",
    ],
    connectionQuestions: [
      "What did I recently convince you to do that got us both in trouble?",
      "What have I discovered about your past that I hold secret from the others?",
      "Who do you know from my past, and how have they influenced your feelings about me?",
    ],
  },
  seraph: {
    startingItems: ["Bundle of offerings", "Sigil of your god"],
    backgroundQuestions: [
      "Which god did you devote yourself to? What incredible feat did they perform for you in a moment of desperation?",
      "How did your appearance change after taking your oath?",
      "In what strange or unique way do you communicate with your god?",
    ],
    connectionQuestions: [
      "What promise did you make me agree to, should you die on the battlefield?",
      "Why do you ask me so many questions about my god?",
      "You’ve told me to protect one member of our party above all others, even yourself. Who are they and why?",
    ],
  },
  sorcerer: {
    startingItems: ["Whispering orb", "Family heirloom"],
    backgroundQuestions: [
      "What did you do that made the people in your community wary of you?",
      "What mentor taught you to control your untamed magic, and why are they no longer able to guide you?",
      "You have a deep fear you hide from everyone. What is it, and why does it scare you?",
    ],
    connectionQuestions: [
      "Why do you trust me so deeply?",
      "What did I do that makes you cautious around me?",
      "Why do we keep our shared past a secret?",
    ],
  },
  warrior: {
    startingItems: ["Drawing of a lover", "Sharpening stone"],
    backgroundQuestions: [
      "Who taught you to fight, and why did they stay behind when you left home?",
      "Somebody defeated you in battle years ago and left you to die. Who was it, and how did they betray you?",
      "What legendary place have you always wanted to visit, and why is it so special?",
    ],
    connectionQuestions: [
      "We knew each other long before this party came together. How?",
      "What mundane task do you usually help me with off the battlefield?",
      "What fear am I helping you overcome?",
    ],
  },
  wizard: {
    startingItems: ["Book you’re trying to translate", "Tiny harmless elemental pet"],
    spellContainerPrompt: "What do you carry your spells in? (large tomes, tarot cards, etc.)",
    backgroundQuestions: [
      "What responsibilities did your community once count on you for? How did you let them down?",
      "You’ve spent your life searching for a book or object of great significance. What is it, and why is it so important to you?",
      "You have a powerful rival. Who are they, and why are you so determined to defeat them?",
    ],
    connectionQuestions: [
      "What favor have I asked of you that you’re not sure you can fulfill?",
      "What weird hobby or strange fascination do we both share?",
      "What secret about yourself have you entrusted only to me?",
    ],
  },
  assassin: {
    startingItems: ["List of names with several marked off", "Rusted blade inscribed with an insignia"],
    backgroundQuestions: [
      "You once killed someone you were close to. What happened, and how did it change you?",
      "What organization trained you in the art of killing, and how did you become a member?",
      "Throughout your career, one target has eluded you. Who are they, and how have they slipped through your fingers?",
    ],
    connectionQuestions: [
      "I’ve killed someone for you. Who were they?",
      "How did you save me when I was on the brink of death? What have I promised you as repayment?",
      "What secret about myself did I tell you, and how did it change your view of me?",
    ],
  },
  brawler: {
    startingItems: ["Hand wraps from a mentor", "Book about your secret hobby"],
    backgroundQuestions: [
      "Where did you spend time during your formative years that taught you, directly or indirectly, how to fight in the style you use?",
      "What organization has vowed to kill you on sight, and what did you do to invoke their ire?",
      "Who did you recently lose a fight to that you’re desperate for a rematch against?",
    ],
    connectionQuestions: [
      "What is one thing we’re both afraid of?",
      "What do I rely on you for during our travels? How do you feel about it?",
      "I still haven’t forgiven you for something you said to me. What was it, and why did you say it?",
    ],
  },
  warlock: {
    startingItems: ["Carving that symbolizes your patron", "Ring you can’t remove"],
    backgroundQuestions: [
      "Who from your community shunned you after you made a pact with your patron?",
      "What desperate situation led you to pledge your life to your patron?",
      "Your patron has given you one task you must accomplish above all else. What is it, and why does it worry you?",
    ],
    connectionQuestions: [
      "Why do you think I confide in you about what my patron says and does?",
      "Our relationship has changed since you saw me show tribute to my patron. What did you see, and how has it affected you?",
      "I once did something very foolish, and you’ve never let me live it down. What was it?",
    ],
  },
  witch: {
    startingItems: ["Small harmless pet", "Scrying stone"],
    backgroundQuestions: [
      "Who from your community feared your magical craft? What rumor did they spread about you, and what truth did it contain?",
      "You once used your power to help someone in a dire situation. Who were they, and why did they come to you?",
      "Your magic once opened a door best left closed. Who or what was on the other side?",
    ],
    connectionQuestions: [
      "What unique ritual or practice have I taught you that we now perform together?",
      "I once appeared to you in a dream and shared a vision of the future. What did I tell you?",
      "What do you typically come to me for advice about?",
    ],
  },
};

export const daggerheartAllClassStartingItems = Object.values(
  daggerheartClassCreationGuidance
).flatMap((entry) => entry.startingItems);
