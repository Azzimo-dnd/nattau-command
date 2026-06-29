const resources = [
  { name: "Resource Points", value: "8", status: "Available", icon: "⚜" },
  { name: "Morale", value: "High", status: "Inspired", icon: "🔥" },
  { name: "Treasury", value: "3200", status: "Gold", icon: "💰" },
  { name: "Supplies", value: "Stable", status: "Secured", icon: "🌾" },
  { name: "Threat Level", value: "High", status: "Enemy movement", icon: "⚔" },
  { name: "Population", value: "200+", status: "Settlers", icon: "👥" },
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