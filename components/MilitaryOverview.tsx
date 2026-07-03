import Link from "next/link";
import { militaryUnits } from "./military/militaryData";

const availableStatuses = ["Ready", "Operational", "Supporting"];
const missionStatuses = ["On Mission", "Garrisoned"];
const unavailableStatuses = ["Inactive", "Wounded"];

function countUnitsByStatuses(statuses: string[]) {
  return militaryUnits.filter((unit) => statuses.includes(unit.status)).length;
}

function getDeploymentCapacityCost() {
  return militaryUnits
    .filter((unit) => availableStatuses.includes(unit.status))
    .reduce((sum, unit) => {
      const match = unit.cost.match(/\d+/);
      return sum + (match ? Number(match[0]) : 0);
    }, 0);
}

export function MilitaryOverview() {
  const totalUnits = militaryUnits.length;
  const availableUnits = countUnitsByStatuses(availableStatuses);
  const missionUnits = countUnitsByStatuses(missionStatuses);
  const unavailableUnits = countUnitsByStatuses(unavailableStatuses);
  const deploymentCapacityCost = getDeploymentCapacityCost();

  const overviewItems = [
    {
      title: "Total Units",
      value: totalUnits,
      label: "Registered forces",
      className: "text-yellow-400",
    },
    {
      title: "Available Units",
      value: availableUnits,
      label: "Ready / operational / support",
      className: "text-green-400",
    },
    {
      title: "On Mission",
      value: missionUnits,
      label: "Mission / garrison",
      className: "text-blue-400",
    },
    {
      title: "Unavailable",
      value: unavailableUnits,
      label: "Inactive / wounded",
      className: "text-red-400",
    },
    {
      title: "Deployment Cost",
      value: `${deploymentCapacityCost} RP`,
      label: "All available units",
      className: "text-yellow-300",
      highlighted: true,
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-yellow-500">
            Military Overview
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Compact summary of unit availability and current deployment status.
          </p>
        </div>

        <Link
          href="#war-room"
          className="text-sm font-medium text-yellow-400 transition hover:text-yellow-300"
        >
          Open War Room →
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {overviewItems.map((item) => (
          <div
            key={item.title}
            className={`rounded-xl border p-4 ${
              item.highlighted
                ? "border-yellow-600/30 bg-yellow-500/10"
                : "border-slate-800 bg-slate-950/60"
            }`}
          >
            <p className="text-sm text-slate-400">{item.title}</p>

            <p className={`mt-2 text-3xl font-black ${item.className}`}>
              {item.value}
            </p>

            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
