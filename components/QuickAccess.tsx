import Link from "next/link";

const modules = [
  {
    title: "Strategic Map",
    href: "/map",
    icon: "🗺",
    description: "Province borders, faction influence and island control.",
    status: "Available",
  },
  {
    title: "War Room",
    href: "#war-room",
    icon: "⚔",
    description: "Military forces, commanders, statuses and RP costs.",
    status: "On this page",
  },
  {
    title: "Settlement",
    href: "#",
    icon: "🏘",
    description: "Buildings, population and development of ÓĆ.",
    status: "Coming soon",
  },
  {
    title: "Chronicle",
    href: "#chronicle",
    icon: "📜",
    description: "Recent important events known to the expedition.",
    status: "Preview",
  },
];

export function QuickAccess() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-5 text-2xl font-bold text-yellow-500">
        Command Modules
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((module) => (
          <Link
            key={module.title}
            href={module.href}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-yellow-600/40 hover:bg-yellow-500/5"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{module.icon}</span>

              <div>
                <h3 className="font-bold text-slate-100">{module.title}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {module.description}
                </p>
                <p className="mt-3 text-xs uppercase tracking-wide text-yellow-500">
                  {module.status}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}