import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { councilMembers } from "@/components/council/councilData";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CouncilMemberPage({ params }: Props) {
  const { id } = await params;

  const member = councilMembers.find((item) => item.id === id);

  if (!member) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <section className="mx-auto max-w-5xl space-y-6">
        {/* Header */}

        <header className="rounded-2xl border border-yellow-600/30 bg-slate-900/70 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="relative mx-auto h-48 w-48 overflow-hidden rounded-2xl border-2 border-yellow-600/40 bg-slate-950 md:mx-0">
              <Image
                src={member.portrait}
                alt={member.name}
                fill
                priority
                className="object-cover"
              />
            </div>

            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.45em] text-yellow-500">
                Kainite High Command
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
                {member.name}
              </h1>

              <p className="mt-2 text-lg text-slate-300">
                {member.title}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {member.race}
                </span>

                <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {member.characterClass}
                </span>

                <span className="rounded-full border border-yellow-600/30 bg-yellow-500/10 px-3 py-1 text-sm font-semibold text-yellow-300">
                  Level {member.level}
                </span>
              </div>

              <Link
                href="/council"
                className="mt-6 inline-block rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/50 hover:text-yellow-400"
              >
                ← Back to High Command
              </Link>
            </div>
          </div>
        </header>

        {/* Main Stats */}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Hit Points"
            value={`${member.hp.current}/${member.hp.max}`}
          />

          <StatCard
            label="Armor Class"
            value={member.armorClass.toString()}
          />

          <StatCard
            label="Initiative"
            value={member.initiative}
          />

          <StatCard
            label="Speed"
            value={member.speed}
          />
        </section>

        {/* Abilities */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-2xl font-bold text-yellow-500">
            Ability Scores
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-6">
            {member.abilities.map((ability) => (
              <div
                key={ability.name}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {ability.name}
                </p>

                <p className="mt-2 text-3xl font-bold text-yellow-500">
                  {ability.score}
                </p>

                <p className="text-sm text-slate-400">
                  {ability.modifier}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Saving Throws + Passives */}

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-2xl font-bold text-yellow-500">
              Saving Throws
            </h2>

            <div className="mt-5 space-y-2">
              {member.savingThrows.map((save) => (
                <div
                  key={save.name}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                >
                  <span>{save.name}</span>

                  <span className="font-bold text-yellow-500">
                    {save.modifier}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-2xl font-bold text-yellow-500">
              Passive Skills
            </h2>

            <div className="mt-5 space-y-2">
              <Passive
                label="Perception"
                value={member.passives.perception}
              />

              <Passive
                label="Investigation"
                value={member.passives.investigation}
              />

              <Passive
                label="Insight"
                value={member.passives.insight}
              />
            </div>

            <h2 className="mt-8 text-2xl font-bold text-yellow-500">
              Defenses
            </h2>

            <div className="mt-4 flex flex-wrap gap-2">
              {member.defenses.length ? (
                member.defenses.map((defense) => (
                  <span
                    key={defense}
                    className="rounded-full border border-green-600/30 bg-green-500/10 px-3 py-1 text-sm text-green-400"
                  >
                    {defense}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">
                  No special defenses recorded.
                </span>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-center">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-yellow-500">
        {value}
      </p>
    </div>
  );
}

function Passive({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
      <span>{label}</span>

      <span className="font-bold text-yellow-500">
        {value}
      </span>
    </div>
  );
}