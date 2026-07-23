"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FateCard } from "./FateCard";
import { FateHistory } from "./FateHistory";
import styles from "./Fate.module.css";
import type {
  FateClaimResult,
  FateCycle,
  FateDrawView,
  FateOffer,
} from "./fateTypes";

type RitualPhase =
  | "idle"
  | "shuffling"
  | "dealing"
  | "choosing"
  | "claiming"
  | "revealing"
  | "revealed";

type FateExperienceProps = {
  currentCycle: FateCycle | null;
  initialCurrentDraw: FateDrawView | null;
  initialHistory: FateDrawView[];
  activeCardCount: number;
};

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function claimToDraw(
  result: FateClaimResult,
  cycle: FateCycle
): FateDrawView {
  return {
    id: result.draw_id,
    cycle_id: result.cycle_id,
    player_id: "current-user",
    card_id: result.card_id,
    is_reversed: result.is_reversed,
    selected_slot: result.selected_slot,
    card_slug_snapshot: result.card_slug,
    card_name_snapshot: result.card_name,
    arcana_number_snapshot: result.arcana_number,
    roman_numeral_snapshot: result.roman_numeral,
    short_meaning_snapshot: result.short_meaning,
    mock_symbol_snapshot: result.mock_symbol,
    mock_theme_snapshot: result.mock_theme,
    reward_title_snapshot: result.reward_title,
    reward_description_snapshot: result.reward_description,
    drawn_at: result.drawn_at,
    cycle_number: cycle.cycle_number,
    cycle_title: cycle.title,
  };
}

export function FateExperience({
  currentCycle,
  initialCurrentDraw,
  initialHistory,
  activeCardCount,
}: FateExperienceProps) {
  const [phase, setPhase] = useState<RitualPhase>(
    initialCurrentDraw ? "revealed" : "idle"
  );
  const [offerId, setOfferId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(
    initialCurrentDraw?.selected_slot ?? null
  );
  const [currentDraw, setCurrentDraw] = useState<FateDrawView | null>(
    initialCurrentDraw
  );
  const [history, setHistory] = useState<FateDrawView[]>(initialHistory);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = ["shuffling", "dealing", "claiming", "revealing"].includes(phase);
  const isChoosing = phase === "choosing";
  const isRevealed = phase === "revealed";

  const visibleHistory = useMemo(() => {
    if (!currentDraw) return history;

    const withoutDuplicate = history.filter((draw) => draw.id !== currentDraw.id);
    return [currentDraw, ...withoutDuplicate];
  }, [currentDraw, history]);

  async function beginRitual() {
    if (!currentCycle || isBusy || phase !== "idle") return;

    setErrorMessage(null);
    setPhase("shuffling");

    const supabase = createClient();
    const rpcPromise = supabase.rpc("get_or_create_fate_offer");

    const [{ data, error }] = await Promise.all([rpcPromise, wait(1750)]);

    if (error) {
      setErrorMessage(error.message);
      setPhase("idle");
      return;
    }

    const offer = (data?.[0] ?? null) as FateOffer | null;

    if (!offer) {
      setErrorMessage("The deck did not answer. Please try again.");
      setPhase("idle");
      return;
    }

    setOfferId(offer.offer_id);
    setPhase("dealing");
    await wait(80);
    setPhase("choosing");
  }

  async function chooseCard(slot: number) {
    if (!currentCycle || !offerId || !isChoosing) return;

    setSelectedSlot(slot);
    setErrorMessage(null);
    setPhase("claiming");

    const supabase = createClient();
    const rpcPromise = supabase.rpc("claim_fate_offer", {
      p_offer_id: offerId,
      p_slot: slot,
    });

    const [{ data, error }] = await Promise.all([rpcPromise, wait(720)]);

    if (error) {
      setErrorMessage(error.message);
      setSelectedSlot(null);
      setPhase("choosing");
      return;
    }

    const result = (data?.[0] ?? null) as FateClaimResult | null;

    if (!result) {
      setErrorMessage("The chosen arcana could not be revealed.");
      setSelectedSlot(null);
      setPhase("choosing");
      return;
    }

    const draw = claimToDraw(result, currentCycle);
    setCurrentDraw(draw);
    setHistory((currentHistory) => [
      draw,
      ...currentHistory.filter((item) => item.id !== draw.id),
    ]);
    setPhase("revealing");

    await wait(1250);
    setPhase("revealed");
  }

  const displayDraw = currentDraw;

  return (
    <div className="space-y-6">
      <section
        className={`${styles.ritualSurface} border border-yellow-600/20 px-4 py-7 md:px-8 md:py-10`}
      >
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.42em] text-yellow-500">
            The Great Arcana of Nattau
          </p>
          <h2 className="mt-4 text-3xl font-black text-slate-100 md:text-5xl">
            {currentCycle ? currentCycle.title : "The deck is silent"}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
            {currentCycle
              ? "One card may be drawn during this Fate Cycle. Choose carefully: the position of the arcana determines which blessing follows you into the next session."
              : "The Game Master has not opened a Fate Cycle yet."}
          </p>

          {currentCycle && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs uppercase tracking-wider">
              <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-slate-400">
                Cycle {currentCycle.cycle_number}
              </span>
              <span className="rounded-full border border-yellow-600/30 bg-yellow-500/10 px-3 py-1.5 text-yellow-300">
                {activeCardCount} active arcana
              </span>
              <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-purple-300">
                Upright or reversed
              </span>
            </div>
          )}
        </div>

        {currentCycle && (
          <div className={styles.deckStage}>
            <div
              className={`${styles.revealGlow} ${
                phase === "revealing" || phase === "revealed"
                  ? styles.revealGlowActive
                  : ""
              }`}
            />

            {(phase === "idle" || phase === "shuffling") && (
              <div
                className={`${styles.deckStack} ${
                  phase === "shuffling"
                    ? styles.deckShuffling
                    : styles.deckIdle
                }`}
                aria-hidden="true"
              >
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className={styles.deckLayer} />
                ))}
              </div>
            )}

            {(["dealing", "choosing", "claiming", "revealing", "revealed"] as RitualPhase[]).includes(
              phase
            ) &&
              [0, 1, 2].map((slot) => {
                const isSelected = selectedSlot === slot;
                const shouldDismiss = selectedSlot !== null && !isSelected;
                const shouldFlip =
                  isSelected && (phase === "revealing" || phase === "revealed");

                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => chooseCard(slot)}
                    disabled={!isChoosing}
                    aria-label={`Choose fate card ${slot + 1}`}
                    className={`${styles.choiceCard} ${
                      phase !== "dealing" ? styles.choiceDealt : ""
                    } ${
                      isSelected ? styles.choiceSelected : ""
                    } ${shouldDismiss ? styles.choiceDismissed : ""}`}
                  >
                    <FateCard
                      romanNumeral={displayDraw?.roman_numeral_snapshot}
                      name={displayDraw?.card_name_snapshot}
                      meaning={displayDraw?.short_meaning_snapshot}
                      symbol={displayDraw?.mock_symbol_snapshot}
                      theme={displayDraw?.mock_theme_snapshot}
                      isReversed={displayDraw?.is_reversed}
                      flipped={shouldFlip}
                    />
                  </button>
                );
              })}
          </div>
        )}

        <div className="relative z-10 mx-auto max-w-2xl text-center">
          {phase === "idle" && currentCycle && (
            <button
              type="button"
              onClick={beginRitual}
              className="rounded-xl bg-yellow-500 px-7 py-3.5 font-black text-slate-950 shadow-lg shadow-yellow-500/10 transition hover:-translate-y-0.5 hover:bg-yellow-400"
            >
              Reveal your destiny
            </button>
          )}

          {phase === "shuffling" && (
            <p className="text-sm uppercase tracking-[0.32em] text-yellow-300">
              The deck is listening...
            </p>
          )}

          {phase === "dealing" && (
            <p className="text-sm uppercase tracking-[0.32em] text-yellow-300">
              Three paths emerge...
            </p>
          )}

          {phase === "choosing" && (
            <p className="text-sm uppercase tracking-[0.32em] text-yellow-300">
              Choose one card
            </p>
          )}

          {phase === "claiming" && (
            <p className="text-sm uppercase tracking-[0.32em] text-yellow-300">
              The thread has been chosen...
            </p>
          )}

          {phase === "revealing" && (
            <p className="text-sm uppercase tracking-[0.32em] text-yellow-300">
              Your arcana is revealed
            </p>
          )}

          {isRevealed && displayDraw && (
            <div
              className={`${styles.rewardReveal} rounded-2xl border border-yellow-600/25 bg-slate-950/72 p-5 text-left backdrop-blur md:p-6`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-yellow-500">
                    {displayDraw.roman_numeral_snapshot} · Arcana Revealed
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-yellow-200">
                    {displayDraw.card_name_snapshot}
                  </h3>
                </div>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-wider ${
                    displayDraw.is_reversed
                      ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                  }`}
                >
                  {displayDraw.is_reversed ? "Reversed" : "Upright"}
                </span>
              </div>

              <div className="mt-5 border-t border-slate-800 pt-5">
                <p className="font-bold text-slate-100">
                  {displayDraw.reward_title_snapshot}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {displayDraw.reward_description_snapshot}
                </p>
              </div>

              <p className="mt-4 text-xs text-slate-600">
                This blessing belongs to the current Fate Cycle and is recorded
                in your personal chronicle.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {errorMessage}
            </div>
          )}
        </div>
      </section>

      <FateHistory draws={visibleHistory} />
    </div>
  );
}
