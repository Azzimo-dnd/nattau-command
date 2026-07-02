import { latestChronicleEntries } from "./chronicle/chronicleData";

export function SituationPanel() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-5 text-2xl font-bold text-yellow-500">
        ⚠ Current Situation
      </h2>

      <div className="grid gap-3 md:grid-cols-3">
        {latestChronicleEntries.map((event) => (
          <div
            key={event.title}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xl">{event.icon}</span>

              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                {event.type}
              </span>
            </div>

            <h3 className="mt-4 font-bold text-slate-100">{event.title}</h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {event.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}