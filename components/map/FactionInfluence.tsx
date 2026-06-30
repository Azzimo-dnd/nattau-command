"use client";

import { useState } from "react";
import { factions } from "./factionData";

function getRelationClass(type: string) {
  switch (type) {
    case "trade":
    case "ally":
      return "border-green-600/30 text-green-400";
    case "non-aggression":
      return "border-yellow-600/30 text-yellow-400";
    case "enemy":
      return "border-red-600/30 text-red-400";
    case "unknown":
      return "border-purple-600/30 text-purple-400";
    default:
      return "border-slate-700 text-slate-400";
  }
}

export function FactionInfluence() {
  const [selectedFactionId, setSelectedFactionId] = useState(factions[0].id);

  const selectedFaction =
    factions.find((faction) => faction.id === selectedFactionId) ?? factions[0];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-2xl font-bold text-yellow-500">Faction Influence</h2>
      <p className="mt-2 text-sm text-slate-500">
        Political control, known armies and diplomatic relations on Hinewai.
      </p>

      <div className="mt-5 space-y-3">
        {factions.map((faction) => {
          const isSelected = selectedFactionId === faction.id;

          return (
            <button
              key={faction.id}
              type="button"
              onClick={() => setSelectedFactionId(faction.id)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                isSelected
                  ? "border-yellow-600/50 bg-yellow-500/10"
                  : "border-slate-800 bg-slate-950/60 hover:border-yellow-600/30"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-100">{faction.name}</h3>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                    {faction.controlledProvinces} provinces ·{" "}
                    {faction.controlledArmies} armies
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
          Selected Faction
        </p>

        <h3 className="mt-3 text-2xl font-bold">{selectedFaction.name}</h3>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          {selectedFaction.description}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Provinces
            </p>
            <p className="mt-1 text-2xl font-bold text-yellow-500">
              {selectedFaction.controlledProvinces}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Armies
            </p>
            <p className="mt-1 text-2xl font-bold text-yellow-500">
              {selectedFaction.controlledArmies}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
            Relations
          </p>

          <div className="flex flex-wrap gap-2">
            {selectedFaction.relations.map((relation) => (
              <span
                key={`${relation.type}-${relation.faction}`}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${getRelationClass(
                  relation.type
                )}`}
              >
                {relation.type}: {relation.faction}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}