import Link from "next/link";
import { campaign } from "@/config/campaign";

const resources = [
  {
    title: "Resource Points",
    value: campaign.resourcePoints.toString(),
    label: "AVAILABLE",
    icon: "⚜",
    href: "/resources",
  },
  {
    title: "Monthly Income",
    value: "+3 RP",
    label: "ORE + COAL",
    icon: "⛏",
    href: "/resources",
  },
  {
    title: "Potential Income",
    value: "+2 PRP",
    label: "SWAMP HERBS",
    icon: "🌿",
    href: "/resources",
  },
  {
    title: "Food Supply",
    value: "Surplus",
    label: "CABBAGE + GRAIN",
    icon: "🌾",
    href: "/resources",
  },
  {
    title: "Threat Level",
    value: "High",
    label: "ENEMY MOVEMENT",
    icon: "⚔",
    href: "/map",
  },
  {
    title: "Population",
    value: "200+",
    label: "SETTLERS",
    icon: "👥",
    href: "#",
  },
];

export function ResourceGrid() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {resources.map((resource) => (
        <Link
          key={resource.title}
          href={resource.href}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-yellow-600/40 hover:bg-yellow-500/5"
        >
          <div className="text-2xl">{resource.icon}</div>

          <p className="mt-5 text-sm text-slate-400">{resource.title}</p>

          <p className="mt-2 text-3xl font-black text-yellow-400">
            {resource.value}
          </p>

          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
            {resource.label}
          </p>
        </Link>
      ))}
    </section>
  );
}