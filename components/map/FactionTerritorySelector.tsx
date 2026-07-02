import type { FactionId } from "./provinceData";

type FactionOption = {
  id: FactionId;
  name: string;
  shortName: string;
};

const factionOptions: FactionOption[] = [
  {
    id: "kainites",
    name: "Kainites",
    shortName: "Kainites",
  },
  {
    id: "empire",
    name: "Jin Yan Chao Empire",
    shortName: "Empire",
  },
  {
    id: "mazamundi-cult",
    name: "Cult of Lord Mazamundi",
    shortName: "Mazamundi",
  },
  {
    id: "wild-lizardfolk",
    name: "Wild Lizardfolk",
    shortName: "Lizardfolk",
  },
  {
    id: "merrydock",
    name: "Merrydock",
    shortName: "Merrydock",
  },
];

type Props = {
  selectedFactionId: FactionId | null;
  onSelectFaction: (factionId: FactionId | null) => void;
};

function getFactionButtonClass(
  factionId: FactionId,
  selectedFactionId: FactionId | null
) {
  const isSelected = factionId === selectedFactionId;

  if (isSelected) {
    return "border-yellow-500 bg-yellow-500/15 text-yellow-300";
  }

  return "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-yellow-600/40 hover:text-yellow-300";
}

export function FactionTerritorySelector({
  selectedFactionId,
  onSelectFaction,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Territory View
          </p>
          <h2 className="mt-2 text-2xl font-bold">Faction Control</h2>
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

      <div className="mt-4 flex flex-wrap gap-2">
        {factionOptions.map((faction) => (
          <button
            key={faction.id}
            type="button"
            onClick={() => onSelectFaction(faction.id)}
            title={faction.name}
            className={`rounded-xl border px-4 py-2 text-sm transition ${getFactionButtonClass(
              faction.id,
              selectedFactionId
            )}`}
          >
            {faction.shortName}
          </button>
        ))}
      </div>
    </div>
  );
}