import { campaign } from "@/config/campaign";

const resources = [
  {
    name: "Resource Points",
    value: campaign.resourcePoints.toString(),
    status: "Available",
    icon: "⚜",
  },
  {
    name: "Morale",
    value: campaign.morale,
    status: "Inspired",
    icon: "🔥",
  },
  {
    name: "Treasury",
    value: campaign.treasury.toString(),
    status: "Gold",
    icon: "💰",
  },
  {
    name: "Supplies",
    value: campaign.supplies,
    status: "Secured",
    icon: "🌾",
  },
  {
    name: "Threat Level",
    value: campaign.threatLevel,
    status: "Enemy movement",
    icon: "⚔",
  },
  {
    name: "Population",
    value: campaign.population,
    status: "Settlers",
    icon: "👥",
  },
];

export function ResourceGrid() {
  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {resources.map((resource) => (
        <div
          key={resource.name}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg"
        >
          <div className="text-3xl">{resource.icon}</div>
          <p className="mt-3 text-sm text-slate-400">{resource.name}</p>
          <p className="mt-1 text-2xl font-bold text-yellow-500">
            {resource.value}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            {resource.status}
          </p>
        </div>
      ))}
    </section>
  );
}