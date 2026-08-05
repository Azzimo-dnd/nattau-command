export type CampaignAdminPresentation = {
  key: "nattau" | "barovia" | "default";
  title: string;
  eyebrow: string;
  description: string;
  backLabel: string;
  createEyebrow: string;
  createPendingLabel: string;
  inviteEntryButton: string;
  joiningLabel: string;
  pageText: string;
  panel: string;
  panelSoft: string;
  border: string;
  accentText: string;
  mainText: string;
  mutedText: string;
  faintText: string;
  primaryButton: string;
  secondaryButton: string;
  dangerButton: string;
  input: string;
  tabActive: string;
  tabInactive: string;
  roleBadge: string;
  notice: string;
  codeBox: string;
};

export function getCampaignAdminPresentation(
  campaignSlug: string,
  themeKey: string,
  companionName: string
): CampaignAdminPresentation {
  const normalizedTheme = themeKey.toLowerCase();
  const normalizedSlug = campaignSlug.toLowerCase();

  if (normalizedTheme === "barovia" || normalizedSlug === "barovia") {
    return {
      key: "barovia",
      title: "Souls & Invitations",
      eyebrow: "Game Master administration",
      description:
        "Control who may enter Barovia, decide which accounts count toward campaign systems and create secure invitation codes for new players.",
      backLabel: "Return through the Mists",
      createEyebrow: "Open a path through the Mists",
      createPendingLabel: "Calling through the Mists…",
      inviteEntryButton: "Continue to invitation",
      joiningLabel: "Entering the Mists…",
      pageText: "text-[#ead7dc]",
      panel:
        "rounded-[26px] border border-[#432832] bg-[#140d12]/92 shadow-2xl shadow-black/25",
      panelSoft: "border-[#3d252f] bg-black/15",
      border: "border-[#4d2c37]",
      accentText: "text-[#a7566d]",
      mainText: "text-[#ead7dc]",
      mutedText: "text-[#a9929a]",
      faintText: "text-[#806c73]",
      primaryButton:
        "border-[#9d4860] bg-[#5a1825]/70 text-[#f1d8df] hover:border-[#bc637b] hover:bg-[#6d2030]/75",
      secondaryButton:
        "border-[#5d3341] bg-black/20 text-[#d3b6bf] hover:border-[#8f4057] hover:text-[#f0d7de]",
      dangerButton:
        "border-red-900/45 bg-red-950/15 text-red-300 hover:border-red-700/60",
      input:
        "border-[#4f2d38] bg-[#0b080a] text-[#ead7dc] placeholder:text-[#604e54] focus:border-[#9d4860]",
      tabActive: "bg-[#5a1825]/60 text-[#f0d4dc]",
      tabInactive: "text-[#907d84] hover:text-[#d9c4cb]",
      roleBadge:
        "border-[#56303d] bg-black/20 text-[#ba9da6]",
      notice: "border-[#653346] bg-[#2b111b]/65 text-[#ddb8c2]",
      codeBox: "border-[#8b4057] bg-[#2a111a]",
    };
  }

  if (normalizedTheme === "nattau" || normalizedSlug === "nattau") {
    return {
      key: "nattau",
      title: "Expedition Roster",
      eyebrow: "Game Master administration",
      description:
        "Manage membership of the Kainite expedition, control participation in campaign systems and issue secure invitation codes to new expedition members.",
      backLabel: "Return to Command Center",
      createEyebrow: "Call a new expedition member",
      createPendingLabel: "Forging invitation…",
      inviteEntryButton: "Continue to invitation",
      joiningLabel: "Joining the expedition…",
      pageText: "text-slate-100",
      panel:
        "rounded-[26px] border border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/25",
      panelSoft: "border-slate-800 bg-slate-950/35",
      border: "border-slate-700",
      accentText: "text-yellow-400",
      mainText: "text-slate-100",
      mutedText: "text-slate-400",
      faintText: "text-slate-500",
      primaryButton:
        "border-yellow-500/45 bg-yellow-500/12 text-yellow-200 hover:border-yellow-400/70 hover:bg-yellow-500/20",
      secondaryButton:
        "border-slate-700 bg-slate-950/45 text-slate-300 hover:border-yellow-600/45 hover:text-yellow-200",
      dangerButton:
        "border-red-900/45 bg-red-950/15 text-red-300 hover:border-red-700/60",
      input:
        "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 focus:border-yellow-500",
      tabActive: "bg-yellow-500/12 text-yellow-200",
      tabInactive: "text-slate-500 hover:text-slate-200",
      roleBadge:
        "border-slate-700 bg-slate-950/40 text-slate-300",
      notice: "border-yellow-700/35 bg-yellow-950/20 text-yellow-200",
      codeBox: "border-yellow-600/40 bg-yellow-950/15",
    };
  }

  return {
    key: "default",
    title: `${companionName} Members`,
    eyebrow: "Game Master administration",
    description:
      "Manage campaign membership, participation settings and secure invitation codes.",
    backLabel: `Return to ${companionName}`,
    createEyebrow: "Create a campaign invitation",
    createPendingLabel: "Creating invitation…",
    inviteEntryButton: "Continue to invitation",
    joiningLabel: "Joining campaign…",
    pageText: "text-slate-100",
    panel:
      "rounded-[26px] border border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/25",
    panelSoft: "border-slate-800 bg-slate-950/35",
    border: "border-slate-700",
    accentText: "text-indigo-300",
    mainText: "text-slate-100",
    mutedText: "text-slate-400",
    faintText: "text-slate-500",
    primaryButton:
      "border-indigo-500/45 bg-indigo-500/12 text-indigo-100 hover:border-indigo-400/70 hover:bg-indigo-500/20",
    secondaryButton:
      "border-slate-700 bg-slate-950/45 text-slate-300 hover:border-indigo-500/45 hover:text-indigo-100",
    dangerButton:
      "border-red-900/45 bg-red-950/15 text-red-300 hover:border-red-700/60",
    input:
      "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500",
    tabActive: "bg-indigo-500/15 text-indigo-100",
    tabInactive: "text-slate-500 hover:text-slate-200",
    roleBadge: "border-slate-700 bg-slate-950/40 text-slate-300",
    notice: "border-indigo-700/35 bg-indigo-950/20 text-indigo-100",
    codeBox: "border-indigo-600/40 bg-indigo-950/15",
  };
}
