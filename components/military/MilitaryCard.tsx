import { DurabilityBar } from "./DurabilityBar";
import {
  formatDeploymentCost,
  type MilitaryUnit,
} from "./militaryData";

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
      <p className="text-sm text-green-400">Built: {unit.headquarters.name}</p>
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
  const isAzzimo = unit.theme === "azzimo";
  const isDebuffCost = unit.cost.type === "session-debuff";

  return (
    <details
      className={
        isAzzimo
          ? "group rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-purple-950/70 via-slate-950/80 to-rose-950/50 p-4 shadow-[0_0_28px_rgba(168,85,247,0.08)] transition open:border-rose-500/50"
          : "rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition open:border-yellow-600/40"
      }
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            {isAzzimo ? (
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-fuchsia-300/80">
                Servants of Azzimo
              </p>
            ) : null}
            <h3 className={isAzzimo ? "font-bold text-rose-100" : "font-bold"}>
              {unit.name}
            </h3>
            <p
              className={
                isAzzimo
                  ? "mt-1 text-sm text-fuchsia-300"
                  : "mt-1 text-sm text-yellow-500"
              }
            >
              {unit.commander}
            </p>
            <p
              className={
                isAzzimo
                  ? "mt-2 text-sm text-slate-300"
                  : "mt-2 text-sm text-slate-400"
              }
            >
              {unit.detail}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${getStatusClass(unit.status)}`}
          >
            {unit.status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-wide">
          <span
            className={
              isAzzimo
                ? "rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200"
                : "rounded-full border border-slate-700 px-3 py-1 text-slate-400"
            }
          >
            {unit.size}
          </span>
          <span
            className={
              isDebuffCost
                ? "rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 font-semibold text-rose-200"
                : "rounded-full border border-yellow-600/30 bg-yellow-500/10 px-3 py-1 text-yellow-400"
            }
          >
            Cost: {formatDeploymentCost(unit.cost)}
          </span>
        </div>

        {isDebuffCost ? (
          <p className="mt-2 text-xs italic text-rose-200/75">
            Azzimo collects his payment during the next session.
          </p>
        ) : null}

        <div className="mt-4">
          <DurabilityBar current={unit.durability} max={unit.maxDurability} />
        </div>
      </summary>

      <div
        className={
          isAzzimo
            ? "mt-5 border-t border-fuchsia-500/20 pt-4"
            : "mt-5 border-t border-slate-800 pt-4"
        }
      >
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
            {unit.members.map((member, index) => (
              <li key={`${index}-${member}`}>• {member}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
