"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TarokkaAdmin } from "./TarokkaAdmin";
import { TarokkaCard } from "./TarokkaCard";
import { TarokkaGrandReading } from "./TarokkaGrandReading";
import { TarokkaHistory } from "./TarokkaHistory";
import styles from "./Tarokka.module.css";
import {
  drawToCardView,
  type TarokkaClaimResult,
  type TarokkaCycle,
  type TarokkaDraw,
  type TarokkaOffer,
  type TarokkaProgressRow,
  type TarokkaReading,
  type TarokkaReadingPosition,
  type TarokkaRole,
  type TarokkaTab,
} from "./tarokkaTypes";

type TarokkaExperienceProps = {
  campaignId: string;
  currentUserId: string;
  role: TarokkaRole;
};

const cycleSelect =
  "id,campaign_id,cycle_number,title,is_active,started_at,closed_at";
const drawSelect =
  "id,campaign_id,cycle_id,player_id,card_id,is_reversed,selected_slot,card_slug_snapshot,card_number_snapshot,card_name_snapshot,subtitle_snapshot,meaning_snapshot,sigil_snapshot,art_key_snapshot,effect_title_snapshot,effect_description_snapshot,drawn_at,revealed_at";
const readingSelect =
  "id,campaign_id,cycle_id,title,status,created_by,created_at,opened_at,completed_at";
const positionSelect =
  "id,campaign_id,reading_id,position_index,position_key,position_label,position_prompt,card_id,is_reversed,card_slug_snapshot,card_number_snapshot,card_name_snapshot,subtitle_snapshot,meaning_snapshot,sigil_snapshot,art_key_snapshot,effect_title_snapshot,effect_description_snapshot,revealed_at";

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

function claimToDraw(
  claim: TarokkaClaimResult,
  campaignId: string,
  playerId: string
): TarokkaDraw {
  return {
    id: claim.draw_id,
    campaign_id: campaignId,
    cycle_id: claim.cycle_id,
    player_id: playerId,
    card_id: claim.card_id,
    is_reversed: claim.is_reversed,
    selected_slot: claim.selected_slot,
    card_slug_snapshot: claim.card_slug,
    card_number_snapshot: claim.card_number,
    card_name_snapshot: claim.card_name,
    subtitle_snapshot: claim.subtitle,
    meaning_snapshot: claim.meaning,
    sigil_snapshot: claim.sigil,
    art_key_snapshot: claim.art_key,
    effect_title_snapshot: claim.effect_title,
    effect_description_snapshot: claim.effect_description,
    drawn_at: claim.drawn_at,
    revealed_at: claim.revealed_at,
  };
}

function friendlyError(message: string) {
  if (
    message.includes("tarokka_") ||
    message.includes("get_or_create_tarokka_offer") ||
    message.includes("schema cache")
  ) {
    return "Tarokka is not installed yet. Run supabase/barovia-tarokka-system.sql in Supabase SQL Editor.";
  }
  return message;
}

export function TarokkaExperience({
  campaignId,
  currentUserId,
  role,
}: TarokkaExperienceProps) {
  const isDm = role === "dm";
  const [tab, setTab] = useState<TarokkaTab>(isDm ? "reading" : "omen");
  const [cycle, setCycle] = useState<TarokkaCycle | null>(null);
  const [currentDraw, setCurrentDraw] = useState<TarokkaDraw | null>(null);
  const [history, setHistory] = useState<TarokkaDraw[]>([]);
  const [progress, setProgress] = useState<TarokkaProgressRow[]>([]);
  const [reading, setReading] = useState<TarokkaReading | null>(null);
  const [positions, setPositions] = useState<TarokkaReadingPosition[]>([]);
  const [offer, setOffer] = useState<TarokkaOffer | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [visualReveal, setVisualReveal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revealInProgressRef = useRef(false);

  const loadAll = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setError(null);
      }
      const supabase = createClient();

      const { data: cycleData, error: cycleError } = await supabase
        .from("tarokka_cycles")
        .select(cycleSelect)
        .eq("campaign_id", campaignId)
        .eq("is_active", true)
        .order("cycle_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cycleError) {
        setError(friendlyError(cycleError.message));
        setLoading(false);
        return;
      }

      const activeCycle = (cycleData as TarokkaCycle | null) ?? null;
      setCycle(activeCycle);

      if (!isDm && activeCycle) {
        const [{ data: drawData, error: drawError }, { data: historyData, error: historyError }] =
          await Promise.all([
            supabase
              .from("tarokka_draws")
              .select(drawSelect)
              .eq("campaign_id", campaignId)
              .eq("cycle_id", activeCycle.id)
              .eq("player_id", currentUserId)
              .maybeSingle(),
            supabase
              .from("tarokka_draws")
              .select(drawSelect)
              .eq("campaign_id", campaignId)
              .eq("player_id", currentUserId)
              .order("drawn_at", { ascending: false })
              .limit(24),
          ]);

        if (drawError || historyError) {
          setError(friendlyError((drawError ?? historyError)?.message ?? "Could not load omens."));
        } else {
          const draw = (drawData as TarokkaDraw | null) ?? null;
          setCurrentDraw(draw);
          setHistory((historyData ?? []) as TarokkaDraw[]);
          setVisualReveal(Boolean(draw?.revealed_at) || revealInProgressRef.current);
          if (draw) setOffer(null);
          else revealInProgressRef.current = false;
        }
      } else {
        setCurrentDraw(null);
        setHistory([]);
      }

      if (isDm) {
        const { data: progressData, error: progressError } = await supabase.rpc(
          "get_tarokka_cycle_progress",
          { p_campaign_id: campaignId }
        );
        if (progressError) {
          setError(friendlyError(progressError.message));
        } else {
          setProgress((progressData ?? []) as TarokkaProgressRow[]);
        }
      }

      const { data: readingData, error: readingError } = await supabase
        .from("tarokka_readings")
        .select(readingSelect)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (readingError) {
        setError(friendlyError(readingError.message));
      } else {
        const latestReading = (readingData as TarokkaReading | null) ?? null;
        setReading(latestReading);
        if (latestReading) {
          const { data: positionData, error: positionError } = await supabase
            .from("tarokka_reading_positions")
            .select(positionSelect)
            .eq("reading_id", latestReading.id)
            .order("position_index", { ascending: true });

          if (positionError) {
            setError(friendlyError(positionError.message));
          } else {
            setPositions((positionData ?? []) as TarokkaReadingPosition[]);
          }
        } else {
          setPositions([]);
        }
      }

      if (!quiet) setLoading(false);
    },
    [campaignId, currentUserId, isDm]
  );

  useEffect(() => {
    void loadAll();

    const supabase = createClient();
    const channel = supabase
      .channel(`tarokka-barovia-${campaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarokka_cycles", filter: `campaign_id=eq.${campaignId}` },
        () => void loadAll(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarokka_draws", filter: `campaign_id=eq.${campaignId}` },
        () => void loadAll(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarokka_readings", filter: `campaign_id=eq.${campaignId}` },
        () => void loadAll(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarokka_reading_positions", filter: `campaign_id=eq.${campaignId}` },
        () => void loadAll(true)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, loadAll]);

  const countedProgress = useMemo(
    () => progress.filter((row) => row.counts_toward_progress),
    [progress]
  );

  async function drawOffer() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: offerError } = await supabase.rpc(
      "get_or_create_tarokka_offer",
      { p_campaign_id: campaignId }
    );
    setBusy(false);

    if (offerError) {
      setError(friendlyError(offerError.message));
      return;
    }

    const row = firstRow(data as TarokkaOffer | TarokkaOffer[] | null);
    if (!row) {
      setError("The Mists returned no cards. Try again.");
      return;
    }

    setOffer(row);
    setSelectedSlot(null);
  }

  async function chooseCard(slot: number) {
    if (!offer || busy) return;
    setBusy(true);
    revealInProgressRef.current = true;
    setSelectedSlot(slot);
    setError(null);

    const supabase = createClient();
    const { data, error: claimError } = await supabase.rpc("claim_tarokka_offer", {
      p_offer_id: offer.offer_id,
      p_slot: slot,
    });

    if (claimError) {
      revealInProgressRef.current = false;
      setBusy(false);
      setSelectedSlot(null);
      setError(friendlyError(claimError.message));
      return;
    }

    const claim = firstRow(data as TarokkaClaimResult | TarokkaClaimResult[] | null);
    if (!claim) {
      revealInProgressRef.current = false;
      setBusy(false);
      setError("The chosen card could not be read.");
      return;
    }

    const draw = claimToDraw(claim, campaignId, currentUserId);
    setCurrentDraw(draw);
    setOffer(null);
    setVisualReveal(false);
    setBusy(false);

    window.setTimeout(() => setVisualReveal(true), 80);
    window.setTimeout(async () => {
      const revealClient = createClient();
      const { error: revealError } = await revealClient.rpc("reveal_tarokka_draw", {
        p_draw_id: draw.id,
      });
      revealInProgressRef.current = false;
      if (revealError) {
        setError(friendlyError(revealError.message));
      } else {
        setCurrentDraw((current) =>
          current?.id === draw.id
            ? { ...current, revealed_at: current.revealed_at ?? new Date().toISOString() }
            : current
        );
        void loadAll(true);
      }
    }, 1350);
  }

  async function revealExistingDraw() {
    if (!currentDraw || busy) return;
    setBusy(true);
    revealInProgressRef.current = true;
    setVisualReveal(false);
    window.setTimeout(() => setVisualReveal(true), 60);

    const supabase = createClient();
    window.setTimeout(async () => {
      const { error: revealError } = await supabase.rpc("reveal_tarokka_draw", {
        p_draw_id: currentDraw.id,
      });
      revealInProgressRef.current = false;
      setBusy(false);
      if (revealError) {
        setError(friendlyError(revealError.message));
      } else {
        setCurrentDraw((current) =>
          current ? { ...current, revealed_at: current.revealed_at ?? new Date().toISOString() } : current
        );
        void loadAll(true);
      }
    }, 1250);
  }

  async function startNextCycle() {
    if (!window.confirm("Close the current cycle and return every player to an empty draw state?")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: cycleError } = await supabase.rpc("start_next_tarokka_cycle", {
      p_campaign_id: campaignId,
      p_title: null,
    });
    setBusy(false);
    if (cycleError) setError(friendlyError(cycleError.message));
    else await loadAll();
  }

  async function resetPlayer(playerId: string) {
    if (!window.confirm("Return this player's current omen to the deck?")) return;
    setBusy(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.rpc("reset_tarokka_player_draw", {
      p_campaign_id: campaignId,
      p_player_id: playerId,
    });
    setBusy(false);
    if (resetError) setError(friendlyError(resetError.message));
    else await loadAll();
  }

  async function createReading() {
    if (reading && reading.status !== "complete") {
      const confirmed = window.confirm(
        "Preparing a new reading will close the current unfinished reading. Continue?"
      );
      if (!confirmed) return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: createError } = await supabase.rpc("create_tarokka_grand_reading", {
      p_campaign_id: campaignId,
      p_title: "The Grand Reading",
    });
    setBusy(false);
    if (createError) setError(friendlyError(createError.message));
    else await loadAll();
  }

  async function openReading(readingId: string) {
    setBusy(true);
    const supabase = createClient();
    const { error: openError } = await supabase.rpc("open_tarokka_grand_reading", {
      p_reading_id: readingId,
    });
    setBusy(false);
    if (openError) setError(friendlyError(openError.message));
    else await loadAll();
  }

  async function revealPosition(positionId: string) {
    setBusy(true);
    const supabase = createClient();
    const { error: revealError } = await supabase.rpc(
      "reveal_tarokka_reading_position",
      { p_position_id: positionId }
    );
    setBusy(false);
    if (revealError) setError(friendlyError(revealError.message));
    else await loadAll();
  }

  const tabs: Array<{ key: TarokkaTab; label: string; visible: boolean }> = [
    { key: "omen", label: "Your Omen", visible: !isDm },
    { key: "reading", label: "Grand Reading", visible: true },
    { key: "history", label: "Past Omens", visible: !isDm },
    { key: "gm", label: "GM Control", visible: isDm },
  ];

  if (loading) {
    return (
      <div className="rounded-[30px] border border-[#4c2934] bg-[#120d11]/90 p-8 text-center text-sm text-[#9d8f94]">
        The cards are gathering beneath the fog...
      </div>
    );
  }

  return (
    <div className={styles.moduleRoot}>
      {error && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-950/25 p-4 text-sm text-red-200">
          <p>{error}</p>
          <button type="button" onClick={() => setError(null)} className="font-bold text-red-300">
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#452832] bg-[#100b0f]/85 p-2">
        <div className="flex flex-wrap gap-1">
          {tabs.filter((item) => item.visible).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tab === item.key
                  ? "bg-[#682037]/55 text-[#efcbd4]"
                  : "text-[#8f7d83] hover:bg-[#28151d] hover:text-[#d8c4ca]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="px-3 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#765f68]">
            Active turning
          </p>
          <p className="mt-1 text-sm font-semibold text-[#c8abb4]">
            {cycle?.title ?? "No active cycle"}
          </p>
        </div>
      </div>

      {tab === "omen" && !isDm && (
        <section className={`${styles.mistPanel} rounded-[30px] p-4 sm:p-7`}>
          <div className="relative">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#a7566d]">
                Personal Omen
              </p>
              <h2 className="mt-3 font-serif text-3xl font-black text-[#ead8ce] sm:text-4xl">
                Let the Mists choose what follows you
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#aa9da2]">
                Choose one card without knowing its face or orientation. A reversed omen is not restyled or labelled in place—the entire physical card turns upside down when revealed.
              </p>
            </div>

            {!cycle ? (
              <p className="relative mt-8 rounded-2xl border border-[#4d2b37] bg-black/20 p-5 text-center text-sm text-[#998b90]">
                No Turning of the Mists is active. The Game Master must begin a cycle.
              </p>
            ) : currentDraw ? (
              <div className="relative mt-7">
                <div className="flex justify-center">
                  <TarokkaCard
                    card={drawToCardView(currentDraw)}
                    revealed={visualReveal}
                  />
                </div>

                {!currentDraw.revealed_at && !visualReveal && (
                  <div className="mt-5 text-center">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void revealExistingDraw()}
                      className="min-h-12 rounded-2xl border border-[#9a4860] bg-[#6b2035]/45 px-6 py-3 text-sm font-bold text-[#f0cbd5] transition hover:bg-[#7b2740]/60 disabled:opacity-60"
                    >
                      Reveal your Omen
                    </button>
                  </div>
                )}

                {visualReveal && (
                  <div className="mx-auto mt-7 max-w-3xl rounded-3xl border border-[#5c3040] bg-[#180f14]/92 p-5 sm:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a7566d]">
                          {currentDraw.is_reversed ? "The Price Demanded" : "The Gift of the Mists"}
                        </p>
                        <h3 className="mt-2 font-serif text-2xl font-black text-[#ead8ce]">
                          {currentDraw.effect_title_snapshot}
                        </h3>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                          currentDraw.is_reversed
                            ? "border-[#a23f5b]/50 bg-[#6f1e35]/25 text-[#de91a7]"
                            : "border-[#b9a88d]/35 bg-[#9f8e6b]/10 text-[#d9cbb2]"
                        }`}
                      >
                        {currentDraw.is_reversed ? "Reversed" : "Upright"}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-[#b1a4a9]">
                      {currentDraw.effect_description_snapshot}
                    </p>
                    <div className="mt-5 border-t border-[#432832] pt-4">
                      <p className="font-serif italic leading-6 text-[#9e8e94]">
                        {currentDraw.meaning_snapshot}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : offer ? (
              <div className={styles.deckStage}>
                <div className={styles.dealRow}>
                  {[1, 2, 3].map((slot) => (
                    <TarokkaCard
                      key={slot}
                      revealed={false}
                      interactive
                      selected={selectedSlot === slot}
                      disabled={busy}
                      onClick={() => void chooseCard(slot)}
                      ariaLabel={`Choose hidden Tarokka card ${slot}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative mt-9 text-center">
                <div className="mx-auto grid h-40 w-28 place-items-center rounded-2xl border border-[#814157] bg-[linear-gradient(145deg,#26131c,#0b080c)] shadow-2xl shadow-black/50">
                  <span className="font-serif text-4xl text-[#c78698]">◆</span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void drawOffer()}
                  className="mt-7 min-h-12 rounded-2xl border border-[#9a4860] bg-[#6b2035]/45 px-7 py-3 text-sm font-bold text-[#f0cbd5] transition hover:border-[#c0647e] hover:bg-[#7b2740]/60 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? "The deck is shuffling..." : "Draw three cards from the Mists"}
                </button>
                <p className="mt-3 text-xs text-[#796a70]">One of them will remain with you until the cycle turns.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "reading" && (
        <TarokkaGrandReading
          reading={reading}
          positions={positions}
          isDm={isDm}
          busy={busy}
          onCreate={createReading}
          onOpen={openReading}
          onReveal={revealPosition}
        />
      )}

      {tab === "history" && !isDm && <TarokkaHistory draws={history} />}

      {tab === "gm" && isDm && (
        <TarokkaAdmin
          cycle={cycle}
          progress={progress}
          busy={busy}
          onStartNextCycle={startNextCycle}
          onResetPlayer={resetPlayer}
        />
      )}

      {isDm && countedProgress.length === 0 && tab !== "gm" && (
        <p className="mt-5 text-center text-xs text-[#75666b]">
          No campaign-progress player accounts are currently assigned to Barovia. Test accounts can still use the module.
        </p>
      )}

      <p className="mt-6 text-center text-[11px] leading-5 text-[#665960]">
        Tarokka of the Mists is an original Campaign Companion module for your Barovia campaign. Card effects are tracked as table prompts and are not automatically applied to a character sheet.
      </p>
    </div>
  );
}
