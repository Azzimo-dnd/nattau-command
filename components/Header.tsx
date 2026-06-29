import Link from "next/link";

export function Header() {
  return (
    <header className="rounded-2xl border border-yellow-600/30 bg-slate-900/70 p-6 shadow-2xl">
      <p className="text-xs uppercase tracking-[0.45em] text-yellow-500">
        Nattau Command
      </p>

      <div className="mt-4">
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">
          Kainite Expedition
        </h1>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-slate-300">
            Headquarters: ÓĆ
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-slate-300">
            Faction: Kainites
          </span>
          <span className="rounded-full border border-yellow-600/30 bg-yellow-500/10 px-3 py-1 text-yellow-300">
            Status: Expedition Active
          </span>
        </div>

        <nav className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/"
            className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-slate-300 hover:border-yellow-600/50 hover:text-yellow-400"
          >
            Command Center
          </Link>

          <Link
            href="/map"
            className="rounded-xl border border-yellow-600/30 bg-yellow-500/10 px-4 py-2 text-yellow-300 hover:bg-yellow-500/20"
          >
            Map
          </Link>
        </nav>
      </div>
    </header>
  );
}