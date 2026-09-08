"use client";

import { useRef, useState } from "react";
import { TarokkaCard } from "./TarokkaCard";
import { deckToCardView, type TarokkaDeckCard, type TarokkaCardPatch } from "./tarokkaTypes";
import styles from "./Tarokka.module.css";

const fields: { key: keyof TarokkaCardPatch; label: string; short?: boolean }[] = [
  { key: "subtitle", label: "Inscription", short: true }, { key: "meaning", label: "Meaning" },
  { key: "upright_title", label: "Gift title", short: true }, { key: "upright_description", label: "Upright · mechanical effect" },
  { key: "reversed_title", label: "Price title", short: true }, { key: "reversed_description", label: "Reversed · mechanical effect" },
  { key: "prophecy_upright", label: "Upright · narrative prophecy" }, { key: "prophecy_reversed", label: "Reversed · narrative prophecy" },
];

type Props = {
  cards: TarokkaDeckCard[]; isDm: boolean; busy: boolean;
  onSave: (card: TarokkaDeckCard, patch: TarokkaCardPatch) => Promise<boolean>;
  onToggle: (card: TarokkaDeckCard) => Promise<boolean>;
};

function CardEditor({ card, busy, onSave, onClose }: { card: TarokkaDeckCard; busy: boolean; onSave: Props["onSave"]; onClose: () => void }) {
  // Preserve the revision we started editing, so another GM's edit cannot be overwritten.
  const [original] = useState(card);
  const [patch, setPatch] = useState<TarokkaCardPatch>(() => Object.fromEntries(fields.map(({ key }) => [key, card[key]])) as TarokkaCardPatch);
  return <form className={styles.editor} onSubmit={async (event) => {
    event.preventDefault(); if (await onSave(original, patch)) onClose();
  }}>
    <p className={styles.muted}>Changes apply to future draws. Existing omens keep their original effect.</p>
    <div className={styles.formGrid}>{fields.map(({ key, label, short }) => <label key={key} className={styles.label}>
      {label}<textarea className={styles.field} rows={short ? 2 : 5} required maxLength={short ? 100 : 2000}
        value={patch[key]} onChange={(event) => setPatch({ ...patch, [key]: event.target.value })} disabled={busy} />
    </label>)}</div>
    <div className={styles.actions}><button className={styles.button} disabled={busy}>Save card</button><button className={styles.secondary} type="button" disabled={busy} onClick={onClose}>Cancel editing</button></div>
  </form>;
}

export function TarokkaDeck({ cards, isDm, busy, onSave, onToggle }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const detailsRef = useRef<HTMLElement>(null);
  const selected = cards.find((card) => card.id === selectedId) ?? cards[0];
  const activeCount = cards.filter((card) => card.is_active).length;
  return <div className={styles.stack}>
    <section className={styles.panel}>
      <p className={styles.eyebrow}>The High Deck · 14 traditional archetypes</p>
      <h2 className={styles.heading}>Gifts with a shadow</h2>
      <p className={styles.muted}>One omen per player, one use before the next Turning. Upright offers a gift; reversed offers power with a cost or a condition. These are Barovia homebrew effects for Daggerheart.</p>
      <div className={styles.actions}><span className={styles.badge}>{activeCount} cards in the drawing pool</span>{isDm && <span className={styles.muted}>Keep at least 5 active. Legacy omens remain in history.</span>}</div>
      <div className={styles.gallery}>{cards.map((card) => <article key={card.id} className={selected?.id === card.id ? styles.gallerySelected : styles.galleryItem}>
        <TarokkaCard card={deckToCardView(card)} revealed compact interactive disabled={editing || busy}
          selected={selected?.id === card.id} onClick={() => { setSelectedId(card.id); detailsRef.current?.scrollIntoView({ block: "start" }); }} ariaLabel={`Read ${card.name}`} />
        <p>{card.name}</p><small>{card.is_active ? card.card_number : "Outside the pool"}</small>
      </article>)}</div>
    </section>
    {selected && <section ref={detailsRef} className={styles.panel} aria-live="polite">
      <div className={styles.split}><div><p className={styles.eyebrow}>{selected.card_number} · {selected.is_active ? "Active" : "Inactive"}</p>
        <h3 className={styles.heading}>{selected.name}</h3><p className={styles.muted}>{selected.meaning}</p></div>
        {isDm && !editing && <div className={styles.actions}>
          <button className={styles.button} disabled={busy} onClick={() => setEditing(true)}>Edit card</button>
          <button className={styles.secondary} disabled={busy || (selected.is_active && activeCount <= 5)} onClick={() => void onToggle(selected)}>{selected.is_active ? "Remove from pool" : "Add to pool"}</button>
        </div>}
      </div>
      {editing ? <CardEditor key={selected.id} card={selected} busy={busy} onSave={onSave} onClose={() => setEditing(false)} /> : <>
        <div className={styles.formGrid}><div className={styles.effect}><p className={styles.eyebrow}>Upright · the gift</p><h4>{selected.upright_title}</h4><p>{selected.upright_description}</p></div>
          <div className={`${styles.effect} ${styles.price}`}><p className={styles.eyebrow}>Reversed · the price</p><h4>{selected.reversed_title}</h4><p>{selected.reversed_description}</p></div></div>
        {isDm && <details className={styles.details}><summary>Narrative interpretation for the Grand Reading</summary><div className={styles.formGrid}><p><strong>Upright:</strong> {selected.prophecy_upright}</p><p><strong>Reversed:</strong> {selected.prophecy_reversed}</p></div></details>}
      </>}
    </section>}
  </div>;
}
