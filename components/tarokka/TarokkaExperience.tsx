"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TarokkaAdmin } from "./TarokkaAdmin";
import { TarokkaCard } from "./TarokkaCard";
import { TarokkaDeck } from "./TarokkaDeck";
import { TarokkaGrandReading } from "./TarokkaGrandReading";
import { TarokkaHistory } from "./TarokkaHistory";
import styles from "./Tarokka.module.css";
import { drawToCardView, type TarokkaClaimResult, type TarokkaCycle, type TarokkaDraw, type TarokkaOffer,
  type TarokkaProgressRow, type TarokkaReading, type TarokkaReadingPosition, type TarokkaRole,
  type TarokkaTab, type TarokkaDeckCard, type TarokkaEvent } from "./tarokkaTypes";

function firstRow<T>(data: T | T[] | null): T | null { return Array.isArray(data) ? data[0] ?? null : data; }
function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : "The Mists interrupted the connection. Please refresh and try again.";
  if (/schema cache|does not exist|permission denied/i.test(message)) return "The deck is temporarily unavailable. Refresh the table or ask your GM to check access.";
  return message;
}

export function TarokkaExperience({ campaignId, currentUserId, role }: { campaignId: string; currentUserId: string; role: TarokkaRole }) {
  const isDm = role === "dm";
  const [tab, setTab] = useState<TarokkaTab>(isDm ? "gm" : "omen");
  const [cycles, setCycles] = useState<TarokkaCycle[]>([]);
  const [draws, setDraws] = useState<TarokkaDraw[]>([]);
  const [cards, setCards] = useState<TarokkaDeckCard[]>([]);
  const [progress, setProgress] = useState<TarokkaProgressRow[]>([]);
  const [events, setEvents] = useState<TarokkaEvent[]>([]);
  const [reading, setReading] = useState<TarokkaReading | null>(null);
  const [positions, setPositions] = useState<TarokkaReadingPosition[]>([]);
  const [offer, setOffer] = useState<TarokkaOffer | null>(null);
  const [turned, setTurned] = useState<boolean[]>([false, false, false]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const mutation = useRef(false);
  const cycle = cycles.find((item) => item.is_active) ?? null;
  const currentDraw = draws.find((draw) => draw.cycle_id === cycle?.id && draw.player_id === currentUserId && !draw.voided_at) ?? null;

  const loadAll = useCallback(async () => {
    const version = ++generation.current;
    const client = createClient();
    try {
      const results = await Promise.all([
        client.from("tarokka_cycles").select("*").eq("campaign_id", campaignId).order("cycle_number", { ascending: false }).limit(250),
        client.from("tarokka_draws").select("*").eq("campaign_id", campaignId).order("drawn_at", { ascending: false }).limit(250),
        client.rpc("list_tarokka_deck", { p_campaign_id: campaignId }),
        client.from("tarokka_readings").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        isDm ? client.rpc("get_tarokka_cycle_progress", { p_campaign_id: campaignId }) : Promise.resolve({ data: [], error: null }),
        isDm ? client.from("tarokka_events").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw new Error(failed.error.message);
      const latestReading = results[3].data as TarokkaReading | null;
      let nextPositions: TarokkaReadingPosition[] = [];
      if (latestReading) {
        const result = await client.from("tarokka_reading_positions").select("*").eq("reading_id", latestReading.id).order("position_index");
        if (result.error) throw new Error(result.error.message);
        nextPositions = (result.data ?? []) as TarokkaReadingPosition[];
      }
      if (!mounted.current || generation.current !== version) return;
      const nextCycles = (results[0].data ?? []) as TarokkaCycle[];
      const nextDraws = (results[1].data ?? []) as TarokkaDraw[];
      const nextCycle = nextCycles.find((item) => item.is_active);
      setCycles(nextCycles); setDraws(nextDraws); setCards((results[2].data ?? []) as TarokkaDeckCard[]);
      setReading(latestReading); setPositions(nextPositions);
      setProgress((results[4].data ?? []) as TarokkaProgressRow[]); setEvents((results[5].data ?? []) as TarokkaEvent[]);
      setOffer((held) => held && held.cycle_id === nextCycle?.id && !nextDraws.some((draw) => draw.cycle_id === nextCycle?.id && draw.player_id === currentUserId && !draw.voided_at) ? held : null);
    } catch (failure) {
      if (mounted.current && generation.current === version) setError(readableError(failure));
    } finally {
      if (mounted.current && generation.current === version) setLoading(false);
    }
  }, [campaignId, currentUserId, isDm]);

  const invalidateRequests = useCallback(() => { generation.current++; }, []);
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => { if (mounted.current) void loadAll(); });
    const client = createClient();
    const refresh = () => { if (!mutation.current && document.visibilityState === "visible") void loadAll(); };
    let channel = client.channel(`tarokka-${campaignId}-${currentUserId}`);
    for (const table of ["tarokka_cycles", "tarokka_draws", "tarokka_readings", "tarokka_reading_positions", ...(isDm ? ["tarokka_events"] : [])]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `campaign_id=eq.${campaignId}` }, refresh);
    }
    channel.subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    window.addEventListener("online", refresh); document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted.current = false; invalidateRequests();
      window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh);
      void client.removeChannel(channel);
    };
  }, [campaignId, currentUserId, isDm, loadAll, invalidateRequests]);

  async function act(action: () => Promise<void>): Promise<boolean> {
    if (mutation.current) return false;
    mutation.current = true; generation.current++; setBusy(true); setError(null);
    try {
      await action();
      if (mounted.current) await loadAll();
      return true;
    } catch (failure) {
      if (mounted.current) setError(readableError(failure));
      return false;
    } finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }
  async function rpc(name: string, args: Record<string, unknown>) {
    const result = await createClient().rpc(name, args);
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  const mutate = (name: string, args: Record<string, unknown>) => act(async () => { await rpc(name, args); });
  async function drawOffer() {
    await act(async () => {
      const held = firstRow(await rpc("get_or_create_tarokka_offer", { p_campaign_id: campaignId }) as TarokkaOffer | TarokkaOffer[]);
      if (!held) throw new Error("The Mists returned no cards. Try again.");
      if (mounted.current) { setOffer(held); setTurned([false, false, false]); }
    });
  }
  async function chooseCard(slot: number) {
    if (!offer) return;
    await act(async () => {
      const claim = firstRow(await rpc("claim_tarokka_offer", { p_offer_id: offer.offer_id, p_slot: slot, p_turn: turned[slot - 1] }) as TarokkaClaimResult | TarokkaClaimResult[]);
      if (!claim) throw new Error("The chosen card could not be read.");
      if (mounted.current) setOffer(null);
      // The claim is durable even if revealing fails; refresh recovers the face-down omen.
      try { await rpc("reveal_tarokka_draw", { p_draw_id: claim.draw_id }); }
      finally { if (mounted.current) await loadAll(); }
    });
  }
  const setUsed = (drawId: string, used: boolean, useNote: string) => mutate("set_tarokka_effect_used", { p_draw_id: drawId, p_used: used, p_note: useNote });
  const tabs: { key: TarokkaTab; label: string; show: boolean }[] = [
    { key: "gm", label: "Session desk", show: isDm }, { key: "omen", label: "Your omen", show: !isDm },
    { key: "deck", label: "The High Deck", show: true }, { key: "reading", label: "Grand Reading", show: true }, { key: "history", label: "History", show: true },
  ];

  return <div className={styles.moduleRoot} aria-busy={busy || loading}>
    {error && <div role="alert" className={styles.error}><p>{error}</p><button type="button" onClick={() => setError(null)}>Dismiss</button></div>}
    <nav className={styles.toolbar} aria-label="Tarokka sections"><div className={styles.actions}>{tabs.filter((item) => item.show).map((item) => <button key={item.key} type="button" className={tab === item.key ? styles.button : styles.secondary} aria-current={tab === item.key ? "page" : undefined} onClick={() => { setTab(item.key); if (!mutation.current && item.key === "deck") void loadAll(); }}>{item.label}</button>)}</div>
      <button type="button" className={styles.secondary} disabled={busy || loading} onClick={() => { setError(null); void loadAll(); }}>Refresh table</button>
    </nav>
    {loading ? <p className={styles.panel} role="status">The cards are gathering beneath the fog…</p> : <>
      {tab === "omen" && !isDm && <section className={`${styles.panel} ${styles.mistPanel}`}><div className={styles.relative}>
        <header className={styles.omenHeader}><p className={styles.eyebrow}>Personal omen · {cycle?.title ?? "Between Turnings"}</p><h2 className={styles.heading}>What follows you into the fog?</h2><p className={styles.muted}>Three cards. One choice. You may turn a hidden card before choosing it; its original orientation is secret. Your final choice cannot be changed after its face is known.</p></header>
        {!cycle ? <p className={styles.empty}>Your GM will open the next Turning of the Mists.</p> : currentDraw ? <>
          <div className={styles.heldCard}><TarokkaCard card={drawToCardView(currentDraw)} revealed={Boolean(currentDraw.revealed_at)} /></div>
          {!currentDraw.revealed_at ? <div className={styles.center}><button className={styles.button} disabled={busy} onClick={() => void mutate("reveal_tarokka_draw", { p_draw_id: currentDraw.id })}>Reveal your omen</button></div> : <div className={styles.heldEffect}>
            <div className={styles.split}><p className={styles.eyebrow}>{currentDraw.is_reversed ? "Reversed · the price demanded" : "Upright · the gift of the Mists"}</p><span className={styles.badge}>{currentDraw.used_at ? "Used" : "One use available"}</span></div>
            <h3 className={styles.heading}>{currentDraw.effect_title_snapshot}</h3><p>{currentDraw.effect_description_snapshot}</p><p className={styles.meaning}>{currentDraw.meaning_snapshot}</p>
            {currentDraw.used_at ? <p className={styles.muted}>Used {new Date(currentDraw.used_at).toLocaleString("en-GB")}{currentDraw.use_note && ` · ${currentDraw.use_note}`}. Your GM can correct a mistaken use.</p> : <form onSubmit={async (event) => { event.preventDefault(); if (await setUsed(currentDraw.id, true, note)) setNote(""); }}>
              <label className={styles.label}>Table note (optional)<input className={styles.field} maxLength={500} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="When did the omen answer?" /></label>
              <div className={styles.actions}><button className={styles.button} disabled={busy}>Mark omen used</button><span className={styles.muted}>Pay its costs at the table. Unused power expires at the next Turning.</span></div>
            </form>}
          </div>}
        </> : !cycle.draws_open ? <p className={styles.empty}>The GM has paused drawing. The deck will return when the table is ready.</p> : offer ? <>
          <div className={styles.dealRow}>{[1, 2, 3].map((slot) => <div key={slot} className={styles.handSlot}>
            <TarokkaCard revealed={false} interactive turned={turned[slot - 1]} disabled={busy} onClick={() => void chooseCard(slot)} ariaLabel={`Choose hidden Tarokka card ${slot}`} />
            <button type="button" className={styles.turnButton} aria-pressed={turned[slot - 1]} disabled={busy} onClick={() => setTurned((values) => values.map((value, index) => index === slot - 1 ? !value : value))}>{turned[slot - 1] ? "Turned ↻" : "Turn ↻"}</button>
          </div>)}</div><p className={styles.center}>Choose a card to reveal it.</p><div className={styles.center}><button className={styles.secondary} disabled={busy} onClick={() => void drawOffer()}>Recover an expired hand</button></div>
        </> : <div className={styles.empty}><TarokkaCard revealed={false} compact /><button className={styles.button} disabled={busy} onClick={() => void drawOffer()}>Draw three cards from the Mists</button></div>}
      </div></section>}
      {tab === "deck" && <TarokkaDeck cards={cards} isDm={isDm} busy={busy}
        onSave={(card, patch) => mutate("save_tarokka_card", { p_campaign_id: campaignId, p_card_id: card.id, p_patch: patch, p_expected_revision: card.revision })}
        onToggle={(card) => mutate("set_tarokka_card_active", { p_campaign_id: campaignId, p_card_id: card.id, p_active: !card.is_active, p_expected_revision: card.revision })} />}
      {tab === "gm" && isDm && <TarokkaAdmin cycle={cycle} draws={draws} progress={progress} events={events} busy={busy}
        onStartNextCycle={(title) => mutate("start_next_tarokka_cycle", { p_campaign_id: campaignId, p_title: title, p_expected_cycle_id: cycle?.id ?? null })}
        onResetPlayer={(playerId, reason, drawId) => mutate("reset_tarokka_player_draw", { p_campaign_id: campaignId, p_player_id: playerId, p_reason: reason, p_expected_draw_id: drawId })}
        onSetUsed={setUsed} onSetOpen={(open) => mutate("set_tarokka_draws_open", { p_campaign_id: campaignId, p_cycle_id: cycle?.id, p_open: open })} />}
      {tab === "history" && <TarokkaHistory draws={draws} cycles={cycles} progress={progress} isDm={isDm} />}
      {tab === "reading" && <TarokkaGrandReading reading={reading} positions={positions} isDm={isDm} busy={busy}
        onCreate={async () => { await mutate("create_tarokka_grand_reading", { p_campaign_id: campaignId, p_title: "The Grand Reading" }); }}
        onOpen={async (id) => { await mutate("open_tarokka_grand_reading", { p_reading_id: id }); }}
        onReveal={async (id) => { await mutate("reveal_tarokka_reading_position", { p_position_id: id }); }} />}
    </>}
    <footer className={styles.footer}>Tarokka of the Mists · Personal omens are bound to their owner. Resolve costs and character changes at the table. Grand Readings are narrative prophecies and grant no additional mechanical effects.</footer>
  </div>;
}
