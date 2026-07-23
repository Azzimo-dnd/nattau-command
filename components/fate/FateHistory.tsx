import { FateCard } from "./FateCard";
import type { FateDrawView } from "./fateTypes";

type FateHistoryProps = {
  draws: FateDrawView[];
  title?: string;
  emptyMessage?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FateHistory({
  draws,
  title = "Your Fate Chronicle",
  emptyMessage = "No arcana have been drawn yet.",
}: FateHistoryProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
          Hall of Fate
        </p>
        <h2 className="mt-3 text-2xl font-bold text-slate-100">{title}</h2>
      </div>

      {draws.length === 0 ? (
        <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {draws.map((draw) => (
            <article
              key={draw.id}
              className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="shrink-0">
                <FateCard
                  romanNumeral={draw.roman_numeral_snapshot}
                  name={draw.card_name_snapshot}
                  meaning={draw.short_meaning_snapshot}
                  symbol={draw.mock_symbol_snapshot}
                  theme={draw.mock_theme_snapshot}
                  isReversed={draw.is_reversed}
                  flipped
                  compact
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                      Cycle {draw.cycle_number}
                    </p>
                    <h3 className="mt-1 font-bold text-yellow-300">
                      {draw.card_name_snapshot}
                    </h3>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                      draw.is_reversed
                        ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                        : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                    }`}
                  >
                    {draw.is_reversed ? "Reversed" : "Upright"}
                  </span>
                </div>

                <p className="mt-3 text-sm font-semibold text-slate-200">
                  {draw.reward_title_snapshot}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {draw.reward_description_snapshot}
                </p>

                <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-600">
                  <p>{draw.cycle_title}</p>
                  <p className="mt-1">Drawn {formatDate(draw.drawn_at)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
