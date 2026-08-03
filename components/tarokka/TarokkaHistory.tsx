import { TarokkaCard } from "./TarokkaCard";
import { drawToCardView, type TarokkaDraw } from "./tarokkaTypes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TarokkaHistory({ draws }: { draws: TarokkaDraw[] }) {
  const revealedDraws = draws.filter((draw) => draw.revealed_at);

  if (revealedDraws.length === 0) {
    return (
      <div className="rounded-3xl border border-[#4c2934] bg-[#120d11]/88 p-6 text-sm leading-6 text-[#a79ba0]">
        No revealed omens have followed you through the Mists yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {revealedDraws.map((draw) => {
        const card = drawToCardView(draw);
        return (
          <article
            key={draw.id}
            className="flex flex-col gap-5 rounded-3xl border border-[#4c2934] bg-[#120d11]/90 p-5 sm:flex-row"
          >
            <div className="flex shrink-0 justify-center">
              <TarokkaCard card={card} revealed compact />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                    draw.is_reversed
                      ? "border-[#9b3d59]/45 bg-[#6f1e35]/20 text-[#d88ca2]"
                      : "border-[#b9a88d]/30 bg-[#9f8e6b]/10 text-[#d7c8ad]"
                  }`}
                >
                  {draw.is_reversed ? "Reversed" : "Upright"}
                </span>
                <span className="text-xs text-[#776a70]">{formatDate(draw.drawn_at)}</span>
              </div>
              <h3 className="mt-3 font-serif text-2xl font-black text-[#ead8ce]">
                {draw.card_name_snapshot}
              </h3>
              <p className="mt-1 font-serif text-sm italic text-[#9f8e95]">
                {draw.subtitle_snapshot}
              </p>
              <p className="mt-4 text-sm leading-6 text-[#afa2a7]">
                {draw.meaning_snapshot}
              </p>
              <div className="mt-5 rounded-2xl border border-[#5a2c3b] bg-[#23131a]/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b6657c]">
                  {draw.is_reversed ? "The Price Demanded" : "The Gift of the Mists"}
                </p>
                <p className="mt-2 font-semibold text-[#ead8ce]">
                  {draw.effect_title_snapshot}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#aa9da2]">
                  {draw.effect_description_snapshot}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
