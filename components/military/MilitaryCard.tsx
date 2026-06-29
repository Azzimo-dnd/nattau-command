import { DurabilityBar } from "./DurabilityBar";
import type { MilitaryUnit } from "./militaryData";

type Props = {
  unit: MilitaryUnit;
};

function getStatusClass(status: MilitaryUnit["status"]) {
  switch (status) {
    case "Ready":
    case "Operational":
    case "Expanded":
      return "border-green-600/30 text-green-400";
    case "Inactive":
    case "Wounded":
      return "border-red-600/30 text-red-400";
    case "Garrisoned":
    case "Supporting":
      return "border-blue-600/30 text-blue-400";
    default:
      return "border-yellow-600/30 text-yellow-400";
  }
}

function renderHeadquarters(unit: MilitaryUnit) {
  if (unit.headquarters.state === "built") {
    return (
      <p className="text-sm text-green-400">
        Built: {unit.headquarters.name}
      </p>
    );
  }

  if (unit.headquarters.state === "available") {
    return (
      <p className="text-sm text-yellow-400">
        Available — Cost: {unit.headquarters.constructionCost}
      </p>
    );
  }

  return <p className="text-sm text-red-400">{unit.headquarters.reason}</p>;
}

export function MilitaryCard({ unit }: Props) {
  return (
    <details className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition open:border-yellow-600/40">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">{unit.name}</h3>
            <p className="mt-1 text-sm text-yellow-500">{unit.commander}</p>
            <p className="mt-2 text-sm text-slate-400">{unit.detail}</p>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-xs ${getStatusClass(
              unit.status
            )}`}
          >
            {unit.status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-wide">
          <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-400">
            {unit.size}
          </span>

          <span className="rounded-full border border-yellow-600/30 bg-yellow-500/10 px-3 py-1 text-yellow-400">
            Cost: {unit.cost}
          </span>
        </div>

        <div className="mt-4">
          <DurabilityBar current={unit.durability} max={unit.maxDurability} />
        </div>
      </summary>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <div className="mb-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
            Headquarters
          </p>
          {renderHeadquarters(unit)}
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            Named Members
          </p>

          <ul className="space-y-2 text-sm text-slate-300">
            {unit.members.map((member) => (
              <li key={member}>• {member}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}