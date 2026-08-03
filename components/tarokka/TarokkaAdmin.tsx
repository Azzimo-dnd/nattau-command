"use client";

import type { TarokkaCycle, TarokkaProgressRow } from "./tarokkaTypes";

type TarokkaAdminProps = {
  cycle: TarokkaCycle | null;
  progress: TarokkaProgressRow[];
  busy: boolean;
  onStartNextCycle: () => Promise<void>;
  onResetPlayer: (playerId: string) => Promise<void>;
};

export function TarokkaAdmin({
  cycle,
  progress,
  busy,
  onStartNextCycle,
  onResetPlayer,
}: TarokkaAdminProps) {
  const counted = progress.filter((row) => row.counts_toward_progress);
  const drawn = counted.filter((row) => row.draw_id);
  const revealed = counted.filter((row) => row.revealed_at);

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-[#5a3040] bg-[#130d11]/92 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#a7566d]">
              Game Master controls
            </p>
            <h2 className="mt-2 font-serif text-3xl font-black text-[#ead8ce]">
              The Turning of the Mists
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a99ba1]">
              A Personal Omen can be drawn once by every player during the active cycle.
              Test accounts remain visible here but do not change campaign progress.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onStartNextCycle()}
            className="min-h-11 rounded-xl border border-[#9a4860] bg-[#6b2035]/45 px-5 py-2 text-sm font-bold text-[#efc7d1] transition hover:bg-[#7d2b42]/60 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Turning the deck..." : "Begin the next cycle"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#492934] bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#826e75]">Active cycle</p>
            <p className="mt-2 font-serif text-xl font-black text-[#e2cfd5]">
              {cycle?.title ?? "No active cycle"}
            </p>
          </div>
          <div className="rounded-2xl border border-[#492934] bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#826e75]">Omens drawn</p>
            <p className="mt-2 text-3xl font-black text-[#d98ba1]">
              {drawn.length}<span className="text-base text-[#75666b]">/{counted.length}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[#492934] bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#826e75]">Omens revealed</p>
            <p className="mt-2 text-3xl font-black text-[#d8c5ad]">
              {revealed.length}<span className="text-base text-[#75666b]">/{counted.length}</span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#4c2934] bg-[#120d11]/90 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#a7566d]">
              Souls in the cycle
            </p>
            <h3 className="mt-2 font-serif text-2xl font-black text-[#e7d4ca]">
              Player progress
            </h3>
          </div>
          <span className="rounded-full border border-[#53303b] bg-black/20 px-3 py-1 text-xs text-[#9d8a91]">
            {progress.length} profiles
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {progress.length === 0 ? (
            <p className="rounded-2xl border border-[#432832] bg-black/20 p-4 text-sm text-[#8f8187]">
              No player members are assigned to Barovia yet.
            </p>
          ) : (
            progress.map((row) => (
              <article
                key={row.player_id}
                className="flex flex-col gap-3 rounded-2xl border border-[#432832] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-[#e1d1d6]">{row.display_name}</p>
                    {!row.counts_toward_progress && (
                      <span className="rounded-full border border-[#675661] bg-black/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#918087]">
                        Test account
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[#8f8187]">
                    {!row.draw_id
                      ? "No omen drawn"
                      : row.revealed_at
                        ? `${row.card_name ?? "Card revealed"}${row.is_reversed ? " · Reversed" : " · Upright"}`
                        : "Card drawn, still face-down"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                      row.revealed_at
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                        : row.draw_id
                          ? "border-[#9c6e40]/35 bg-[#7d5227]/15 text-[#d5ad7b]"
                          : "border-[#5d454e] bg-black/20 text-[#8c7b82]"
                    }`}
                  >
                    {row.revealed_at ? "Revealed" : row.draw_id ? "Drawn" : "Waiting"}
                  </span>
                  {row.draw_id && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onResetPlayer(row.player_id)}
                      className="min-h-10 rounded-xl border border-[#623444] bg-[#2b151e] px-3 py-2 text-xs font-semibold text-[#c99aa7] transition hover:border-[#8c465c] hover:text-[#e4b9c5] disabled:opacity-60"
                    >
                      Return card
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
