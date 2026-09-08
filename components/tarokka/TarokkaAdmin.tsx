"use client";

import { useState } from "react";
import { omenStatus, type TarokkaCycle, type TarokkaDraw, type TarokkaProgressRow, type TarokkaEvent } from "./tarokkaTypes";
import styles from "./Tarokka.module.css";

type Props = {
  cycle: TarokkaCycle | null; progress: TarokkaProgressRow[]; draws: TarokkaDraw[]; events: TarokkaEvent[]; busy: boolean;
  onStartNextCycle: (title: string) => Promise<boolean>;
  onResetPlayer: (playerId: string, reason: string, drawId: string) => Promise<boolean>;
  onSetUsed: (drawId: string, used: boolean, note: string) => Promise<boolean>;
  onSetOpen: (open: boolean) => Promise<boolean>;
};

export function TarokkaAdmin({ cycle, progress, draws, events, busy, onStartNextCycle, onResetPlayer, onSetUsed, onSetOpen }: Props) {
  const [title, setTitle] = useState("");
  const [nextCycle, setNextCycle] = useState(false);
  const [correction, setCorrection] = useState<{ playerId: string; drawId: string; kind: "return" | "restore" } | null>(null);
  const [reason, setReason] = useState("");
  const counted = progress.filter((row) => row.counts_toward_progress);
  const liveDraws = draws.filter((draw) => draw.cycle_id === cycle?.id && !draw.voided_at);
  const spent = counted.filter((row) => liveDraws.some((draw) => draw.id === row.draw_id && draw.used_at));
  const beginCorrection = (playerId: string, drawId: string, kind: "return" | "restore") => { setCorrection({ playerId, drawId, kind }); setReason(""); };
  return <div className={styles.stack}>
    <section className={`${styles.panel} ${styles.mistPanel}`}>
      <div className={styles.relative}><p className={styles.eyebrow}>Game Master · session desk</p><h2 className={styles.heading}>The Turning of the Mists</h2>
        <p className={styles.muted}>Give each player a moment with the deck between sessions. A new Turning expires unused omens and grants everyone a fresh draw.</p>
        <div className={styles.stats}>
          <div><span>Current Turning</span><strong>{cycle?.title ?? "The deck is waiting"}</strong></div>
          <div><span>Omens chosen</span><strong>{counted.filter((row) => row.draw_id).length} / {counted.length}</strong></div>
          <div><span>Omens used</span><strong>{spent.length} / {counted.length}</strong></div>
        </div>
        <div className={styles.actions}>
          {cycle && <button className={styles.secondary} disabled={busy} onClick={() => void onSetOpen(!cycle.draws_open)}>{cycle.draws_open ? "Pause drawing" : "Reopen drawing"}</button>}
          <button className={styles.button} disabled={busy} onClick={() => setNextCycle(true)}>{cycle ? "Prepare next Turning" : "Begin first Turning"}</button>
          <span className={styles.badge}>{!cycle ? "No active Turning" : cycle.draws_open ? "Drawing open" : "Drawing paused · held omens still work"}</span>
        </div>
        {nextCycle && <form className={styles.confirmBox} onSubmit={async (event) => { event.preventDefault(); if (await onStartNextCycle(title)) { setNextCycle(false); setTitle(""); } }}>
          <label className={styles.label}>Name the next Turning<input className={styles.field} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. The road to Vallaki" disabled={busy} /></label>
          <p className={styles.muted}>Opening it will expire every unused omen from the current Turning. All cards and notes remain in history.</p>
          <div className={styles.actions}><button className={styles.button} disabled={busy}>Confirm new Turning</button><button className={styles.secondary} type="button" disabled={busy} onClick={() => setNextCycle(false)}>Cancel</button></div>
        </form>}
      </div>
    </section>
    <section className={styles.panel}><p className={styles.eyebrow}>Souls at the table</p><h3 className={styles.heading}>Held omens</h3>
      {!progress.length && <p className={styles.muted}>No active player profiles are assigned to this campaign.</p>}
      <div className={styles.stack}>{progress.map((row) => {
        const draw = liveDraws.find((item) => item.id === row.draw_id);
        return <article key={row.player_id} className={styles.playerRow}>
          <div className={styles.split}><div><h4>{row.display_name} {!row.counts_toward_progress && <span className={styles.badge}>Test profile</span>}</h4>
            <p className={styles.muted}>{draw ? `${draw.card_name_snapshot} · ${draw.is_reversed ? "Reversed" : "Upright"}` : "Waiting for a card"}</p></div>
            <span className={styles.badge}>{draw ? omenStatus(draw, cycle?.id) : "Waiting"}</span></div>
          {draw && <>
            <details className={styles.details}><summary>{draw.effect_title_snapshot}</summary><p>{draw.effect_description_snapshot}</p>{draw.use_note && <p>Table note: {draw.use_note}</p>}</details>
            <div className={styles.actions}>
              {draw.revealed_at && <button className={styles.secondary} disabled={busy} onClick={() => draw.used_at ? beginCorrection(row.player_id, draw.id, "restore") : void onSetUsed(draw.id, true, "Marked by the GM")}>{draw.used_at ? "Restore use…" : "Mark used"}</button>}
              <button className={styles.secondary} disabled={busy} onClick={() => beginCorrection(row.player_id, draw.id, "return")}>Return card…</button>
            </div>
          </>}
          {correction?.playerId === row.player_id && <form className={styles.confirmBox} onSubmit={async (event) => {
            event.preventDefault(); const ok = correction.kind === "return" ? await onResetPlayer(correction.playerId, reason, correction.drawId) : await onSetUsed(correction.drawId, false, reason); if (ok) setCorrection(null);
          }}><label className={styles.label}>{correction.kind === "return" ? "Reason for returning the card" : "Reason for restoring its use"}<input className={styles.field} required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} /></label>
            <p className={styles.muted}>{correction.kind === "return" ? "The player can draw again. This card and the reason stay in their history." : "The same omen becomes available again. The correction is recorded."}</p>
            <div className={styles.actions}><button className={styles.button} disabled={busy || !reason.trim()}>Confirm {correction.kind}</button><button className={styles.secondary} type="button" disabled={busy} onClick={() => setCorrection(null)}>Cancel</button></div>
          </form>}
        </article>;
      })}</div>
    </section>
    <section className={styles.panel}><p className={styles.eyebrow}>GM log · latest 50 changes</p>
      {!events.length ? <p className={styles.muted}>Deck edits, uses and corrections will appear here.</p> : <ol className={styles.eventList}>{events.map((event) => <li key={event.id}>
        <span>{event.kind.replaceAll("_", " ")}{event.note && ` · ${event.note}`}</span><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("en-GB")}</time>
      </li>)}</ol>}
    </section>
  </div>;
}
