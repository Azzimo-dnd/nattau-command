import type {
  AppRole,
  NavigationItem,
  NavigationSection,
} from "./navigationTypes";

export const mobilePrimaryItems: NavigationItem[] = [
  { label: "Home", href: "/campaigns/nattau", icon: "home", exact: true },
  { label: "Planner", href: "/session-planner", icon: "session" },
  { label: "Council", href: "/council", icon: "council" },
  { label: "Fate", href: "/fate", icon: "fate" },
];

export function getNavigationSections(
  role: AppRole,
  canSwitchCampaign = false
): NavigationSection[] {
  const betweenSessions: NavigationItem[] = [
    {
      label: "Session Planner",
      href: "/session-planner",
      icon: "session",
      description: "Share availability and vote on possible session dates.",
    },
    {
      label: "Council Proposals",
      href: "/council/proposals",
      icon: "proposal",
      description: "Submit motions and vote on expedition decisions.",
    },
  ];

  if (role === "player") {
    betweenSessions.push(
      {
        label: "Threads of Fate",
        href: "/fate",
        icon: "fate",
        description: "Reveal one blessing before the next session.",
      },
      {
        label: "GM Messages",
        href: "/gm-chat",
        icon: "chat",
        description: "Private conversation with the Game Master.",
      }
    );
  }

  const sections: NavigationSection[] = [
    {
      label: "Command",
      items: [
        {
          label: "Command Center",
          href: "/campaigns/nattau",
          icon: "home",
          exact: true,
        },
      ],
    },
    {
      label: "Campaign",
      items: [
        { label: "Map", href: "/map", icon: "map" },
        {
          label: "Settlement",
          href: "/settlement",
          icon: "settlement",
        },
        {
          label: "Resources",
          href: "/resources",
          icon: "resources",
        },
        { label: "War Room", href: "/war-room", icon: "war-room" },
        {
          label: "Council",
          href: "/council",
          icon: "council",
          exact: true,
        },
      ],
    },
    {
      label: "Between Sessions",
      items: betweenSessions,
    },
    {
      label: "Tools",
      items: [{ label: "Dice Roller", href: "/dice", icon: "dice" }],
    },
  ];

  if (role === "dm") {
    sections.push({
      label: "GM Tools",
      items: [
        {
          label: "Session Controls",
          href: "/gm/session",
          icon: "session",
          description: "Publish the next session date or a waiting message.",
        },
        {
          label: "Fate Management",
          href: "/fate",
          icon: "fate",
          description: "Review draws and begin the next Fate Cycle.",
        },
        {
          label: "Expedition Roster",
          href: "/campaigns/nattau/gm/members",
          icon: "account",
          description: "Manage Nattau members and invitation codes.",
        },
        {
          label: "Dice Physics Lab",
          href: "/campaigns/nattau/gm/dice-lab",
          icon: "dice",
          description: "Test genuine Rapier rigid-body dice before campaign rollout.",
        },
        {
          label: "Player Conversations",
          href: "/gm-chat",
          icon: "chat",
          description: "Open private conversations with every player.",
        },
      ],
    });
  }

  const accountItems: NavigationItem[] = [];

  if (canSwitchCampaign) {
    accountItems.push({
      label: "Campaign Companion",
      href: "/campaigns",
      icon: "campaigns",
      description: "Switch between campaigns assigned to your account.",
    });
  }

  accountItems.push({ label: "Account", href: "/account", icon: "account" });

  sections.push({
    label: "Account",
    items: accountItems,
  });

  return sections;
}

export function isRouteActive(
  pathname: string,
  item: Pick<NavigationItem, "href" | "exact">
) {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
