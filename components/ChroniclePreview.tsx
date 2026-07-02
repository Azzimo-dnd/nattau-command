import { latestChronicleEntries } from "./chronicle/chronicleData";

export function ChroniclePreview() {
  return (
    <section
      id="chronicle"
      className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
        Latest Chronicle
      </p>

      <h2 className="mt-3 text-2xl font-bold text-slate-100">
        Recent Reports
      </h2>

      <div className="mt-5 space-y-4">
        {latestChronicleEntries.map((entry) => (
          <article
            key={entry.title}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-yellow-600/40 bg-yellow-500/10 px-3 py-1 text-xs uppercase tracking-wide text-yellow-300">
                {entry.type}
              </span>
            </div>

            <h3 className="mt-3 font-bold text-slate-100">{entry.title}</h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {entry.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}