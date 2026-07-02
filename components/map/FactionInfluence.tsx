import type { FactionId } from "./provinceData";

type Faction = {
  id: FactionId;
  name: string;
  shortName: string;
  provinces: number;
  armies: number;
  status: string;
  relations: string[];
};

type Props = {
  selectedFactionId: FactionId | null;
  onSelectFaction: (factionId: FactionId | null) => void;
};

const factions: Faction[] = [
  {
    id: "kainites",
    name: "Kainites & Allies",
    shortName: "Kainites",
    provinces: 3,
    armies: 7,
    status: "Expedition command",
    relations: [
      "Controls provinces 1, 3 and shares 7",
      "Trade with Merrydock",
      "Non-aggression with Cult of Lord Mazamundi",
    ],
  },
  {
    id: "empire",
    name: "Jin Yan Chao",
    shortName: "Empire",
    provinces: 2,
    armies: 1,
    status: "Imperial power",
    relations: [
      "Controls provinces 2 and 8",
      "Enemy of Wild Lizardfolk",
      "Enemy of Cult of Lord Mazamundi",
    ],
  },
  {
    id: "mazamundi-cult",
    name: "Cult of Lord Mazamundi",
    shortName: "Mazamundi",
    provinces: 4,
    armies: 2,
    status: "Religious power",
    relations: [
      "Controls provinces 9, 10, 11 and shares 7",
      "Non-aggression with Kainites",
      "Enemy of Jin Yan Chao",
    ],
  },
  {
    id: "wild-lizardfolk",
    name: "Wild Lizardfolk",
    shortName: "Lizardfolk",
    provinces: 1,
    armies: 2,
    status: "Hostile tribes",
    relations: ["Controls province 12", "Enemy of everyone"],
  },
  {
    id: "merrydock",
    name: "Merrydock",
    shortName: "Merrydock",
    provinces: 1,
    armies: 0,
    status: "Trade settlement",
    relations: [
      "Controls province 6",
      "Trade with Kainites",
      "Neutral with Jin Yan Chao",
    ],
  },
];

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

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Provinces
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-100">
                    {faction.provinces}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Armies
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-100">
                    {faction.armies}
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