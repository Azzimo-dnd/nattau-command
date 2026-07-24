import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthenticatedNavigation } from "@/components/navigation/AuthenticatedNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nattau Command",
  description: "Command center of the Kainite Expedition.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <AuthenticatedNavigation>{children}</AuthenticatedNavigation>
      </body>
    </html>
  );
}
