export type AppRole = "dm" | "player";

export type NavigationIconName =
  | "home"
  | "map"
  | "settlement"
  | "resources"
  | "war-room"
  | "council"
  | "proposal"
  | "fate"
  | "chat"
  | "dice"
  | "account"
  | "more"
  | "close"
  | "collapse"
  | "logout"
  | "session"
  | "history"
  | "spark";

export type NavigationItem = {
  label: string;
  href: string;
  icon: NavigationIconName;
  exact?: boolean;
  description?: string;
};

export type NavigationSection = {
  label: string;
  items: NavigationItem[];
};
