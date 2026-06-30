import Link from "next/link";
import { councilMembers } from "@/app/council/councilData";
import Image from "next/image";

export default function CouncilPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-yellow-600/30 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-[0.45em] text-yellow-500">
            Nattau Command
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
            Kainite High Command
          </h1>
          <p className="mt-3 text-slate-400">
            Leading figures of the expedition and their known battlefield
            capabilities.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-300 hover:border-yellow-600/50 hover:text-yellow-400"
          >
            Back to Command Center
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {councilMembers.map((member) => (
            <Link
              key={member.id}
              href={`/council/${member.id}`}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-yellow-600/40 hover:bg-yellow-500/5"
            >
                <div className="relative h-40 overflow-hidden rounded-xl border border-yellow-600/30 bg-slate-950">
                 <Image
                    src={member.portrait}
                    alt={member.name}
                    fill
                    className="object-cover"
                />
                </div>
              <p className="text-xs uppercase tracking-[0.3em] text-yellow-500">
                Level {member.level}
              </p>

              <h2 className="mt-3 text-2xl font-bold">{member.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{member.title}</p>

              <p className="mt-4 text-sm text-slate-300">
                {member.race} · {member.characterClass}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">HP</p>
                  <p className="font-bold text-yellow-500">
                    {member.hp.current}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">AC</p>
                  <p className="font-bold text-yellow-500">
                    {member.armorClass}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Init</p>
                  <p className="font-bold text-yellow-500">
                    {member.initiative}
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm text-yellow-400">View Details →</p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}