export type ChronicleEntry = {
  type: string;
  icon: string;
  title: string;
  description: string;
};

export const latestChronicleEntries: ChronicleEntry[] = [
  {
    type: "Festival",
    icon: "👑",
    title: "Odetta Crowned Lady of Kainalia",
    description:
      "Sister Odetta won the Ladies' Run and was proclaimed Lady of Kainalia, securing one of the most celebrated victories of this year's festival.",
  },
  {
    type: "Military",
    icon: "⚔️",
    title: "Sixty Men Begin Martial Training",
    description:
      "Sixty men will take part in military training led by War Master Ra-Bar-Bar and Sheriff of Celibacy Kevin the Paladin.",
  },
  {
    type: "Arcane Incident",
    icon: "✨",
    title: "Magical Clone Incident During Battle Reenactment",
    description:
      "During the staged battle performance, magical clones unexpectedly attacked the reenactors. The situation was quickly brought under control.",
  },
];