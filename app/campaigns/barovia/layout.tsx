import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Beyond the Mists",
    template: "%s · Beyond the Mists",
  },
  description: "Campaign workspace for Barovia.",
};

export default function BaroviaLayout({ children }: { children: ReactNode }) {
  return children;
}
