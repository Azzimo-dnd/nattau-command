"use client";

import { useState } from "react";
import { TarokkaCard } from "./TarokkaCard";
import { drawToCardView, omenStatus, type TarokkaDraw, type TarokkaCycle, type TarokkaProgressRow } from "./tarokkaTypes";
import styles from "./Tarokka.module.css";

export function TarokkaHistory({ draws, cycles, progress = [], isDm = false }: { draws: TarokkaDraw[]; cycles: TarokkaCycle[]; progress?: TarokkaProgressRow[]; isDm?: boolean }) {
  const [cycleId, setCycleId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [status, setStatus] = useState("");
  const activeId = cycles.find((cycle) => cycle.is_active)?.id;
  const filtered = draws.filter((draw) => (!cycleId || draw.cycle_id === cycleId) && (!playerId || draw.player_id === playerId) && (!status || omenStatus(draw, activeId) === status));
  return <div className={styles.stack}>
    <section className={styles.panel}><p className={styles.eyebrow}>The deck remembers · latest 250 draws</p><h2 className={styles.heading}>Past omens</h2>
      <div className={styles.filters}><label className={styles.label}>Turning<select className={styles.field} value={cycleId} onChange={(event) => setCycleId(event.target.value)}><option value="">All Turnings</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.title}</option>)}</select></label>
        {isDm && <label className={styles.label}>Player<select className={styles.field} value={playerId} onChange={(event) => setPlayerId(event.target.value)}><option value="">All players</option>{progress.map((row) => <option key={row.player_id} value={row.player_id}>{row.display_name}</option>)}</select></label>}
        <label className={styles.label}>State<select className={styles.field} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All states</option>{["Available", "Used", "Expired", "Returned", "Face-down"].map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
    </section>
    {!filtered.length && <p className={styles.panel}>No omens match these filters.</p>}
    {filtered.map((draw) => <article key={draw.id} className={`${styles.panel} ${styles.historyRow}`}>
      <TarokkaCard card={draw.revealed_at || isDm ? drawToCardView(draw) : null} revealed={Boolean(draw.revealed_at) || isDm} compact />
      <div className={styles.historyCopy}><p className={styles.eyebrow}>{omenStatus(draw, activeId)} · {cycles.find((cycle) => cycle.id === draw.cycle_id)?.title ?? "Earlier Turning"}</p>
        <h3 className={styles.heading}>{draw.revealed_at || isDm ? draw.card_name_snapshot : "An unopened omen"}</h3>
        <p className={styles.muted}>{isDm && `${progress.find((row) => row.player_id === draw.player_id)?.display_name ?? "Former player"} · `}<time dateTime={draw.drawn_at}>{new Date(draw.drawn_at).toLocaleString("en-GB")}</time></p>
        {(draw.revealed_at || isDm) && <div className={styles.effect}><p className={styles.eyebrow}>{draw.is_reversed ? "Reversed" : "Upright"}</p><h4>{draw.effect_title_snapshot}</h4><p>{draw.effect_description_snapshot}</p></div>}
        {draw.used_at && <p className={styles.muted}>Used: {new Date(draw.used_at).toLocaleString("en-GB")}</p>}{draw.use_note && <p className={styles.muted}>Table note: {draw.use_note}</p>}
        {draw.voided_at && <p className={styles.muted}>Returned: {draw.void_reason}</p>}
      </div>
    </article>)}
  </div>;
}
