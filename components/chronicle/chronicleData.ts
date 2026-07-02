export type ChronicleEntry = {
  title: string;
  type: string;
  description: string;
};

export const latestChronicleEntries: ChronicleEntry[] = [
  {
    title: "Odetta Crowned Lady of Kainalia",
    type: "Kainalia Festival",
    description:
      "Sister Odetta won the Ladies' Run and was proclaimed Lady of Kainalia, securing one of the most celebrated victories of this year's festival.",
  },
  {
    title: "Sixty Men Begin Martial Training",
    type: "Settlement Defense",
    description:
      "Sixty men will take part in military training led by War Master Ra-Bar-Bar and Sheriff of Celibacy Kevin the Paladin.",
  },
  {
    title: "Magical Clone Incident During Battle Reenactment",
    type: "Arcane Incident",
    description:
      "During the staged battle performance, magical clones unexpectedly attacked the reenactors. The situation was quickly brought under control.",
  },
];