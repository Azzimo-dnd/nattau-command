import { MilitaryCard } from "@/components/military/MilitaryCard";
import { militaryUnits } from "@/components/military/militaryData";

export function WarRoom() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-yellow-500">⚔ War Room</h2>
          <span className="text-sm text-slate-500">Click unit to inspect</span>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          Durability represents how many major defeats a unit can survive. At 0
          durability, the unit becomes wounded. If defeated again, it is lost.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {militaryUnits.map((unit) => (
          <MilitaryCard key={unit.name} unit={unit} />
        ))}
      </div>
    </section>
  );
}