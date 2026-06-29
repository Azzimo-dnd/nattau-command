const military = [
  {
    name: "Defensive Detachment",
    commander: "Captain Varron Holt",
    size: "6 combatants",
    status: "Ready",
    detail: "Fighters, battle mages and line support.",
  },
  {
    name: "Artillery Corps",
    commander: "Master Tink Reval",
    size: "4 specialists",
    status: "Operational",
    detail: "Artificers, heavy weapons, traps and prototypes.",
  },
  {
    name: "Hunters of Ared",
    commander: "Ared Helmsong",
    size: "12 hunters",
    status: "Expanded",
    detail:
      "Scouts and trackers. The unit has doubled in size and established a new headquarters.",
  },
  {
    name: "Daughters of Kain",
    commander: "Mother Tyllen",
    size: "Elite priesthood",
    status: "Ready",
    detail: "Faith, battlefield support and morale control.",
  },
  {
    name: "Pavise Brothers of Kain",
    commander: "Brother Ruven",
    size: "6 shieldbearers",
    status: "Ready",
    detail: "Heavy shield infantry and defensive formation troops.",
  },
  {
    name: "Triboar Guard",
    commander: "Captain Elira Dox",
    size: "12 guards",
    status: "Garrisoned",
    detail: "Line guards, officers and limited magical support.",
  },
  {
    name: "Pit Stop Crew",
    commander: "Goran Smelt",
    size: "4 craftsmen",
    status: "Supporting",
    detail: "Repairs, logistics, field maintenance and emergency fixes.",
  },
];

export function WarRoom() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-yellow-500">⚔ War Room</h2>
        <span className="text-sm text-slate-500">Military Forces</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {military.map((unit) => (
          <div
            key={unit.name}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{unit.name}</h3>
                <p className="mt-1 text-sm text-yellow-500">{unit.commander}</p>
                <p className="mt-2 text-sm text-slate-400">{unit.detail}</p>
                <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                  {unit.size}
                </p>
              </div>

              <span className="rounded-full border border-yellow-600/30 px-3 py-1 text-xs text-yellow-400">
                {unit.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}