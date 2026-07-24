import type { SVGProps } from "react";
import type { NavigationIconName } from "./navigationTypes";

type NavIconProps = SVGProps<SVGSVGElement> & {
  name: NavigationIconName;
};

export function NavIcon({ name, ...props }: NavIconProps) {
  const commonProps: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };

  switch (name) {
    case "home":
      return <svg {...commonProps}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>;
    case "map":
      return <svg {...commonProps}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></svg>;
    case "settlement":
      return <svg {...commonProps}><path d="M3 21h18" /><path d="M5 21V10l7-5 7 5v11" /><path d="M9 21v-6h6v6M8 11h.01M16 11h.01" /></svg>;
    case "resources":
      return <svg {...commonProps}><path d="M12 3c4 0 7 1.3 7 3s-3 3-7 3-7-1.3-7-3 3-3 7-3Z" /><path d="M5 6v6c0 1.7 3 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3 3 7 3s7-1.3 7-3v-6" /></svg>;
    case "war-room":
      return <svg {...commonProps}><path d="m5 3 14 18M19 3 5 21" /><path d="m4 2 3 1-2 2ZM20 2l-3 1 2 2ZM4 22l3-1-2-2ZM20 22l-3-1 2-2Z" /></svg>;
    case "council":
      return <svg {...commonProps}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20c0-4 2.7-6 6-6s6 2 6 6" /><path d="M15 15c3 0 5 1.7 5 5" /></svg>;
    case "proposal":
      return <svg {...commonProps}><path d="M6 3h12v18H6z" /><path d="M9 7h6M9 11h6M9 15h3" /><path d="m14 17 2 2 4-4" /></svg>;
    case "fate":
      return <svg {...commonProps}><path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2Z" /><path d="m19 3 .7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7Z" /></svg>;
    case "chat":
      return <svg {...commonProps}><path d="M4 5h16v11H8l-4 4Z" /><path d="M8 9h8M8 12h5" /></svg>;
    case "dice":
      return <svg {...commonProps}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" /></svg>;
    case "account":
      return <svg {...commonProps}><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-5 3.3-7 8-7s7.3 2 8 7" /></svg>;
    case "more":
      return <svg {...commonProps}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>;
    case "close":
      return <svg {...commonProps}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case "collapse":
      return <svg {...commonProps}><path d="m14 6-6 6 6 6" /><path d="M20 4v16" /></svg>;
    case "logout":
      return <svg {...commonProps}><path d="M10 5H5v14h5" /><path d="m14 8 4 4-4 4M18 12H9" /></svg>;
    case "session":
      return <svg {...commonProps}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;
    case "history":
      return <svg {...commonProps}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6M12 7v5l3 2" /></svg>;
    case "spark":
      return <svg {...commonProps}><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6Z" /></svg>;
    default:
      return null;
  }
}
