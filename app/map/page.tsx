import Image from "next/image";
import Link from "next/link";

const factions = [
  {
    name: "Kainites & Allies",
    provinces: 3,
    status: "Expanding",
    color: "text-yellow-400",
  },
  {
    name: "Jin Yan Chao",
    provinces: 2,
    status: "Imperial Presence",
    color: "text-red-500",
  },
  {
    name: "Wild Lizardfolk",
    provinces: 2,
    status: "Hostile",
    color: "text-red-400",
  },
  {
    name: "Cult of Lord Mazamundi",
    provinces: 3,
    status: "Dangerouse Allies",
    color: "text-amber-500",
  },
  {
    name: "Merrydock",
    provinces: 1,
    status: "Neutral / Trade Partner",
    color: "text-green-400",
  },
];

export default function MapPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-yellow-600/30 bg-slate-900/70 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-yellow-500">
              Nattau Command
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
              Hinewai Map
            </h1>
            <p className="mt-3 text-slate-400">
              Strategic overview of known provinces and faction influence.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-300 hover:border-yellow-600/50 hover:text-yellow-400"
          >
            Back to Command Center
          </Link>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <Image
              src="/images/hinewai-map.jpg"
              alt="Map of Hinewai"
              width={1408}
              height={1024}
              className="h-auto w-full rounded-xl"
              priority
            />
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-2xl font-bold text-yellow-500">
                Faction Legend
              </h2>

              <div className="mt-5 space-y-4">
                {factions.map((faction) => (
                  <div
                    key={faction.name}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold">{faction.name}</h3>
                        <p className={`mt-1 text-sm ${faction.color}`}>
                          {faction.status}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-yellow-500">
                          {faction.provinces}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Provinces
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-2xl font-bold text-yellow-500">
                Island Control
              </h2>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Known provinces</span>
                  <span className="font-bold text-slate-100">9</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Kainite influence</span>
                  <span className="font-bold text-yellow-500">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hostile provinces</span>
                  <span className="font-bold text-red-400">4</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Neutral provinces</span>
                  <span className="font-bold text-green-400">1</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}