"use client";

import { TarokkaCard } from "./TarokkaCard";
import styles from "./Tarokka.module.css";
import {
  positionToCardView,
  type TarokkaReading,
  type TarokkaReadingPosition,
} from "./tarokkaTypes";

const readingSlots = [
  {
    index: 1,
    label: "Echo of the Past",
    prompt: "What still follows the party from before the Mists?",
  },
  {
    index: 2,
    label: "Path Through the Fog",
    prompt: "Which road will shape the next chapter?",
  },
  {
    index: 3,
    label: "Hand in the Dark",
    prompt: "Who or what may offer aid?",
  },
  {
    index: 4,
    label: "Shadow at Your Back",
    prompt: "What danger moves unseen behind them?",
  },
  {
    index: 5,
    label: "Fate Beyond the Mists",
    prompt: "What possible end waits beyond the fog?",
  },
];

type TarokkaGrandReadingProps = {
  reading: TarokkaReading | null;
  positions: TarokkaReadingPosition[];
  isDm: boolean;
  busy: boolean;
  onCreate: () => Promise<void>;
  onOpen: (readingId: string) => Promise<void>;
  onReveal: (positionId: string) => Promise<void>;
};

export function TarokkaGrandReading({
  reading,
  positions,
  isDm,
  busy,
  onCreate,
  onOpen,
  onReveal,
}: TarokkaGrandReadingProps) {
  if (!reading) {
    return (
      <section className={`${styles.mistPanel} rounded-[30px] p-6 sm:p-8`}>
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#a7566d]">
            Five cards for the road ahead
          </p>
          <h2 className="mt-3 font-serif text-3xl font-black text-[#ead8ce] sm:text-4xl">
            The Grand Reading waits in silence
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#aa9da2]">
            The reading binds the party&apos;s past, path, ally, shadow and fate
            into a single prophecy. Cards are prepared privately and revealed
            one by one by the Game Master.
          </p>
          {isDm ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCreate()}
              className="mt-7 min-h-12 rounded-2xl border border-[#9a4860] bg-[#6b2035]/45 px-6 py-3 text-sm font-bold text-[#f0cbd5] transition hover:border-[#c0647e] hover:bg-[#7b2740]/55 disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "The deck is turning..." : "Prepare the Grand Reading"}
            </button>
          ) : (
            <p className="mt-7 text-sm italic text-[#806f76]">
              The Game Master has not yet opened a reading to the party.
            </p>
          )}
        </div>
      </section>
    );
  }

  const byIndex = new Map(positions.map((position) => [position.position_index, position]));

  return (
    <section className={`${styles.mistPanel} rounded-[30px] p-4 sm:p-7`}>
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#a7566d]">
              The Grand Reading
            </p>
            <h2 className="mt-2 font-serif text-3xl font-black text-[#ead8ce]">
              {reading.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#aa9da2]">
              Each position is a question asked of the Mists. A reversed card is
              physically turned upside down, exactly as it would lie on the table.
            </p>
          </div>
          <span className="rounded-full border border-[#613342] bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b98c99]">
            {reading.status === "draft"
              ? "Private draft"
              : reading.status === "revealing"
                ? "Reading in progress"
                : "Reading complete"}
          </span>
        </div>

        {isDm && reading.status === "draft" && (
          <div className="mt-5 rounded-2xl border border-[#684052] bg-[#25131b]/75 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="font-semibold text-[#e3ccd3]">Private GM preview</p>
              <p className="mt-1 text-sm text-[#9c8c92]">
                Review all five cards below. Players cannot see this reading until you open it.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onOpen(reading.id)}
              className="mt-4 min-h-11 rounded-xl border border-[#9a4860] bg-[#6b2035]/45 px-5 py-2 text-sm font-bold text-[#efc7d1] transition hover:bg-[#7d2b42]/60 disabled:opacity-60 sm:mt-0"
            >
              Open the Reading
            </button>
          </div>
        )}

        <div className={`${styles.readingGrid} mt-7`}>
          {readingSlots.map((slot) => {
            const position = byIndex.get(slot.index);
            const isRevealed = Boolean(position?.revealed_at);
            const gmPreview = Boolean(isDm && position);
            const showFace = isRevealed || gmPreview;

            return (
              <article
                key={slot.index}
                className={`${styles.readingPosition} rounded-3xl border border-[#452832] bg-black/18 p-3`}
              >
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a7566d]">
                    Position {slot.index}
                  </p>
                  <h3 className="mt-2 font-serif text-lg font-black text-[#e3d1c8]">
                    {slot.label}
                  </h3>
                  <p className="mt-2 min-h-12 text-xs leading-5 text-[#8e7e84]">
                    {slot.prompt}
                  </p>
                </div>

                <div className={styles.readingCardWrap}>
                  <TarokkaCard
                    card={position ? positionToCardView(position) : null}
                    revealed={showFace}
                    compact
                  />
                </div>

                {position && showFace ? (
                  <div className="mt-2">
                    <div className="flex flex-wrap justify-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${
                          position.is_reversed
                            ? "border-[#9b3d59]/45 bg-[#6f1e35]/20 text-[#d88ca2]"
                            : "border-[#b9a88d]/30 bg-[#9f8e6b]/10 text-[#d7c8ad]"
                        }`}
                      >
                        {position.is_reversed ? "Reversed" : "Upright"}
                      </span>
                      {!isRevealed && isDm && (
                        <span className="rounded-full border border-[#66545a] bg-black/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[#8f7d83]">
                          Hidden from players
                        </span>
                      )}
                    </div>
                    {(isRevealed || isDm) && (
                      <div className="mt-3 rounded-2xl border border-[#4f2b37] bg-[#1e1117]/80 p-3">
                        <p className="text-xs font-bold text-[#d8bec6]">
                          {position.effect_title_snapshot}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#94868b]">
                          {position.effect_description_snapshot}
                        </p>
                      </div>
                    )}
                    {isDm && reading.status !== "draft" && !isRevealed && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onReveal(position.id)}
                        className="mt-3 min-h-10 w-full rounded-xl border border-[#824055] bg-[#572033]/40 px-3 py-2 text-xs font-bold text-[#dfb6c1] transition hover:border-[#a6536d] disabled:opacity-60"
                      >
                        Reveal this card
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-center text-xs italic text-[#716269]">
                    The Mists conceal this position.
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {isDm && reading.status === "complete" && (
          <div className="mt-6 text-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCreate()}
              className="min-h-11 rounded-xl border border-[#684052] bg-black/20 px-5 py-2 text-sm font-semibold text-[#c7a9b2] transition hover:border-[#925168] hover:text-[#e4c4cd] disabled:opacity-60"
            >
              Prepare a new Grand Reading
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
