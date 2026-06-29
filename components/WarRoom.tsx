"use client";

import { useState } from "react";

const military = [
  {
    name: "Defensive Detachment",
    commander: "Captain Varron Holt",
    size: "6 combatants",
    cost: "1 RP",
    status: "Ready",
    detail: "Fighters, battle mages and line support.",
    members: [
      "Captain Varron Holt",
      "Mirael Flamehand",
      "Dorek “Iron Hound”",
      "Sileth",
      "Karos Fen",
    ],
  },
  {
    name: "Artillery Corps",
    commander: "Master Tink Reval",
    size: "4 specialists",
    cost: "1 RP",
    status: "Operational",
    detail: "Artificers, heavy weapons, traps and prototypes.",
    members: ["Master Tink Reval", "Bratt Copperbelly", "Velka Marr", "Pykko"],
  },
  {
    name: "Hunters of Ared",
    commander: "Ared Helmsong",
    size: "12 hunters",
    cost: "2 RP",
    status: "Expanded",
    detail:
      "Scouts and trackers. The unit has doubled in size and established a new headquarters.",
    members: [
      "Ared Helmsong",
      "Lera Quickstep",
      "Gholz",
      "Elin Marr",
    ],
  },
  {
    name: "Daughters of Kain",
    commander: "Mother Tyllen",
    size: "Elite priesthood",
    cost: "3 RP / 6 RP",
    status: "Inactive",
    detail:
      "Faith, battlefield support and morale control. Currently inactive due to Mother Tyllen's poor health.",
    members: ["Mother Tyllen"],
  },
  {
    name: "Pavise Brothers of Kain",
    commander: "Brother Ruven",
    size: "6 shieldbearers",
    cost: "2 RP",
    status: "Ready",
    detail: "Heavy shield infantry and defensive formation troops.",
    members: [
      "Brother Ruven",
      "Brother Vosk",
      "Brother Elgor",
      "Brother Silen",
      "Brother Jarn",
      "Brother Mern",
    ],
  },
  {
    name: "Triboar Guard",
    commander: "Captain Elira Dox",
    size: "12 guards",
    cost: "1 RP",
    status: "Garrisoned",
    detail: "Line guards, officers and limited magical support.",
    members: [
      "Captain Elira Dox",
      "Lieutenant Kral Vint",
      "Renn",
      "Jaro",
      "Fellek",
      "Tramm",
      "Siles",
      "Morrin",
      "Debra",
      "Keth",
      "Sira Menn",
      "Orr Valin",
    ],
  },
  {
    name: "Pit Stop Crew",
    commander: "Goran Smelt",
    size: "4 craftsmen",
    cost: "1 RP",
    status: "Supporting",
    detail: "Repairs, logistics, field maintenance and emergency fixes.",
    members: ["Goran Smelt", "Nisra Coilhand", "Tullen Barrow", "Hoppik"],
  },
];

export function WarRoom() {
  const [openedUnit, setOpenedUnit] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-yellow-500">⚔ War Room</h2>
        <span className="text-sm text-slate-500">Click unit to inspect</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {military.map((unit) => {
          const isOpen = openedUnit === unit.name;

          return (
            <button
              key={unit.name}
              type="button"
              onClick={() => setOpenedUnit(isOpen ? null : unit.name)}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left transition hover:border-yellow-600/40 hover:bg-yellow-500/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{unit.name}</h3>

                  <p className="mt-1 text-sm text-yellow-500">
                    {unit.commander}
                  </p>

                  <p className="mt-2 text-sm text-slate-400">{unit.detail}</p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-wide">
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-400">
                      {unit.size}
                    </span>

                    <span className="rounded-full border border-yellow-600/30 bg-yellow-500/10 px-3 py-1 text-yellow-400">
                      Cost: {unit.cost}
                    </span>
                  </div>
                </div>

                <span className="rounded-full border border-yellow-600/30 px-3 py-1 text-xs text-yellow-400">
                  {unit.status}
                </span>
              </div>

              {isOpen && (
                <div className="mt-5 border-t border-slate-800 pt-4">
                  <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                    Named Members
                  </p>

                  <ul className="space-y-2 text-sm text-slate-300">
                    {unit.members.map((member) => (
                      <li key={member}>• {member}</li>
                    ))}
                  </ul>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}