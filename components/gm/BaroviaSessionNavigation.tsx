import Link from "next/link";
import type { SessionDeskView } from "@/lib/campaign/baroviaSessionDesk";

const sections = [
  { key: "overview", label: "Overview", hint: "Party readiness", href: "/campaigns/barovia/gm/session" },
  { key: "planning", label: "Availability & votes", hint: "Choose a night", href: "/campaigns/barovia/gm/session?view=planning" },
  { key: "publication", label: "Session announcement", hint: "Publish date & notes", href: "/campaigns/barovia/gm/session?view=publication" },
  { key: "tarokka", label: "Tarokka control", hint: "Turnings, omens & deck", href: "/campaigns/barovia/gm/tarokka" },
] as const;

export function BaroviaSessionNavigation({ active }: { active: SessionDeskView | "tarokka" }) {
  return (
    <nav aria-label="Barovia GM session tools" className="mb-6 grid gap-2 rounded-2xl border border-[#49303b] bg-[#130d12] p-2 sm:grid-cols-2 xl:grid-cols-4">
      {sections.map((section) => (
        <Link key={section.key} href={section.href} aria-current={active === section.key ? "page" : undefined}
          className={`min-h-16 rounded-xl border px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b91] ${active === section.key ? "border-[#94516a] bg-[#542235]/60 text-[#f1dce3]" : "border-transparent text-[#b6a0aa] hover:border-[#644052] hover:bg-[#2b1923]"}`}>
          <span className="block text-sm font-bold">{section.label}</span>
          <span className="mt-1 block text-xs text-[#ac8f9c]">{section.hint}</span>
        </Link>
      ))}
    </nav>
  );
}
