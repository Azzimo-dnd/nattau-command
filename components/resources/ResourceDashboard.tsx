import {
  foodProduction,
  getMonthlyPotentialResourcePoints,
  getMonthlyResourcePoints,
  resourceSources,
} from "./resourceData";

function getTypeClass(type: string) {
  switch (type) {
    case "resource":
      return "border-yellow-600/40 bg-yellow-500/10 text-yellow-300";
    case "potential-resource":
      return "border-purple-600/40 bg-purple-500/10 text-purple-300";
    case "food":
      return "border-green-600/40 bg-green-500/10 text-green-300";
    default:
      return "border-slate-700 bg-slate-950/70 text-slate-300";
  }
}

export function ResourceDashboard() {
  const monthlyResourcePoints = getMonthlyResourcePoints();
  const monthlyPotentialResourcePoints = getMonthlyPotentialResourcePoints();

  return (
    <section className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Monthly Income
          </p>

          <h2 className="mt-3 text-4xl font-black text-yellow-300">
            +{monthlyResourcePoints} RP
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Confirmed resource points available for settlement use.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-purple-500">
            Potential Income
          </p>

          <h2 className="mt-3 text-4xl font-black text-purple-300">
            +{monthlyPotentialResourcePoints} PRP
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Potential resource points that require trade conversion.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-green-500">
            Food Status
          </p>

          <h2 className="mt-3 text-3xl font-black text-green-300">
            Stable Surplus
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Food production slightly exceeds current settlement demand.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
          Production Sources
        </p>

        <h2 className="mt-3 text-2xl font-bold">Monthly Breakdown</h2>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {resourceSources.map((source) => (
            <article
              key={source.id}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${getTypeClass(
                    source.type
                  )}`}
                >
                  {source.status}
                </span>

                <span className="text-2xl font-black text-yellow-300">
                  +{source.monthlyGain} {source.unit}
                </span>
              </div>

              <h3 className="mt-4 text-xl font-bold text-slate-100">
                {source.name}
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                {source.description}
              </p>

              {source.notes && (
                <div className="mt-4 space-y-2">
                  {source.notes.map((note) => (
                    <p key={note} className="text-sm text-slate-500">
                      • {note}
                    </p>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-green-700/30 bg-green-950/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-green-400">
              Food Production
            </p>

            <h2 className="mt-3 text-2xl font-bold text-slate-100">
              {foodProduction.name}
            </h2>
          </div>

          <span className="rounded-full border border-green-600/40 bg-green-500/10 px-3 py-1 text-xs uppercase tracking-wide text-green-300">
            {foodProduction.status}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Monthly Production
            </p>

            <p className="mt-2 text-xl font-bold text-green-300">
              {foodProduction.monthlyProduction}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Supported Population
            </p>

            <p className="mt-2 text-xl font-bold text-green-300">
              {foodProduction.supportedPopulation}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-400">
          {foodProduction.description}
        </p>

        <div className="mt-4 space-y-2">
          {foodProduction.notes.map((note) => (
            <p key={note} className="text-sm text-slate-500">
              • {note}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}