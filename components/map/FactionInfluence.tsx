import type { StrategicFaction } from "@/lib/strategic-map/types";
import type { FactionId } from "./provinceData";

type Props = {
  factions: StrategicFaction[];
  provinceControl: Record<number, FactionId[]>;
  selectedFactionId: FactionId | null;
  onSelectFaction: (factionId: FactionId | null) => void;
};

function getFactionCardClass(factionId: FactionId, isSelected: boolean) {
  if (!isSelected) {
    return "border-slate-800 bg-slate-950/50 hover:border-yellow-600/40";
  }

  switch (factionId) {
    case "kainites":
      return "border-yellow-500 bg-yellow-500/10";
    case "empire":
      return "border-orange-500 bg-orange-500/10";
    case "mazamundi-cult":
      return "border-purple-500 bg-purple-500/10";
    case "wild-lizardfolk":
      return "border-red-500 bg-red-500/10";
    case "merrydock":
      return "border-green-500 bg-green-500/10";
    default:
      return "border-slate-500 bg-slate-500/10";
  }
}

function getFactionTextClass(factionId: FactionId) {
  switch (factionId) {
    case "kainites":
      return "text-yellow-400";
    case "empire":
      return "text-orange-400";
    case "mazamundi-cult":
      return "text-purple-400";
    case "wild-lizardfolk":
      return "text-red-400";
    case "merrydock":
      return "text-green-400";
    default:
      return "text-slate-400";
  }
}

export function FactionInfluence({
  factions,
  provinceControl,
  selectedFactionId,
  onSelectFaction,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Faction Influence
          </p>

          <h2 className="mt-3 text-2xl font-bold">Regional Control</h2>

          <p className="mt-2 text-sm text-slate-500">
            Select a faction to highlight controlled provinces on the map.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSelectFaction(null)}
          className={`rounded-xl border px-4 py-2 text-sm transition ${
            selectedFactionId === null
              ? "border-yellow-500 bg-yellow-500/15 text-yellow-300"
              : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-yellow-600/40 hover:text-yellow-300"
          }`}
        >
          Clear
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {factions.map((faction) => {
          const isSelected = selectedFactionId === faction.id;
          const controlledProvinceCount = Object.values(provinceControl).filter(
            (controlledBy) => controlledBy.includes(faction.id)
          ).length;

          return (
            <button
              key={faction.id}
              type="button"
              onClick={() =>
                onSelectFaction(isSelected ? null : faction.id)
              }
              className={`w-full rounded-xl border p-4 text-left transition ${getFactionCardClass(
                faction.id,
                isSelected
              )}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3
                    className={`font-bold ${getFactionTextClass(
                      faction.id
                    )}`}
                  >
                    {faction.name}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {faction.status}
                  </p>
                </div>

                <span
                  className={`rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs ${getFactionTextClass(
                    faction.id
                  )}`}
                >
                  {faction.shortName}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                {faction.description}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Provinces
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-100">
                    {controlledProvinceCount}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Armies
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-100">
                    {faction.armyCount}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                {faction.relations.map((relation) => (
                  <p key={relation} className="text-sm text-slate-400">
                    • {relation}
                  </p>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
