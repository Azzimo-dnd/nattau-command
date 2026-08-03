import type { PlannerVariant } from "./plannerTypes";

export type PlannerTheme = {
  variant: PlannerVariant;
  pageTitle: string;
  pageEyebrow: string;
  pageDescription: string;
  proposalEyebrow: string;
  proposalTitle: string;
  proposalDescription: string;
  bestEyebrow: string;
  bestTitle: string;
  bestDescription: string;
  calendarEyebrow: string;
  detailsEyebrow: string;
  accentText: string;
  accentBorder: string;
  accentSoft: string;
  accentRing: string;
  panel: string;
  panelMuted: string;
  border: string;
  heading: string;
  body: string;
  subtle: string;
  selectedOutline: string;
  rangeOutline: string;
  voteAccent: string;
  confirmAccent: string;
  dock: string;
};

const nattauTheme: PlannerTheme = {
  variant: "nattau",
  pageTitle: "Session Planner",
  pageEyebrow: "Between Sessions",
  pageDescription:
    "Mark the days when you can play. Desktop users may paint with the mouse; phones use stable multi-select without drag gestures.",
  proposalEyebrow: "Group decision",
  proposalTitle: "Session Proposals",
  proposalDescription:
    "The Game Master may nominate the strongest dates. Players answer Yes, Maybe or No until one date is confirmed.",
  bestEyebrow: "Group availability",
  bestTitle: "Best Dates",
  bestDescription:
    "The strongest dates in the visible month, ranked separately for online and in-person sessions.",
  calendarEyebrow: "Shared calendar",
  detailsEyebrow: "Day details",
  accentText: "text-yellow-400",
  accentBorder: "border-yellow-500/40",
  accentSoft: "bg-yellow-500/10",
  accentRing: "ring-yellow-300/70",
  panel: "border-slate-800 bg-slate-900/70",
  panelMuted: "border-slate-800 bg-slate-950/45",
  border: "border-slate-800",
  heading: "text-slate-100",
  body: "text-slate-400",
  subtle: "text-slate-500",
  selectedOutline: "outline-purple-400/70",
  rangeOutline: "outline-yellow-300",
  voteAccent: "border-purple-500/30 bg-purple-500/10 text-purple-200",
  confirmAccent: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
  dock: "border-slate-700 bg-slate-950/95",
};

const baroviaTheme: PlannerTheme = {
  variant: "barovia",
  pageTitle: "The Gathering",
  pageEyebrow: "Call the Lost Souls together",
  pageDescription:
    "Choose the nights when the Mists may allow the party to meet. Availability, votes and confirmed dates remain separate from Nattau.",
  proposalEyebrow: "Council of the Mists",
  proposalTitle: "Nights under Consideration",
  proposalDescription:
    "The Game Master may call a promising night to a vote. The Lost Souls answer Yes, Maybe or No before the Mists close around the chosen date.",
  bestEyebrow: "Signs within the fog",
  bestTitle: "Favourable Nights",
  bestDescription:
    "The strongest nights in the visible month, ranked separately for distant and in-person gatherings.",
  calendarEyebrow: "The Moon's Passage",
  detailsEyebrow: "Night revealed",
  accentText: "text-[#c8798e]",
  accentBorder: "border-[#8f4057]/60",
  accentSoft: "bg-[#5a1825]/25",
  accentRing: "ring-[#c8798e]/70",
  panel: "border-[#432832] bg-[#160e13]/82",
  panelMuted: "border-[#3a252e] bg-black/25",
  border: "border-[#432832]",
  heading: "text-[#ead7dc]",
  body: "text-[#b8a3aa]",
  subtle: "text-[#806a72]",
  selectedOutline: "outline-[#c8798e]/80",
  rangeOutline: "outline-[#d6b275]",
  voteAccent: "border-[#8f4057]/60 bg-[#5a1825]/25 text-[#e2a8b7]",
  confirmAccent: "border-[#b68a55]/50 bg-[#8c642f]/15 text-[#e6c890]",
  dock: "border-[#55303e] bg-[#120b10]/95",
};

export function getPlannerTheme(variant: PlannerVariant): PlannerTheme {
  return variant === "barovia" ? baroviaTheme : nattauTheme;
}
