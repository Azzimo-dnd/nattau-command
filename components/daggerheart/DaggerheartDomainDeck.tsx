"use client";

import { useRef, useState } from "react";
import { compendiumEffectiveMetadata, compendiumHasErrata, type DaggerheartCompendiumEntry } from "@/lib/daggerheart/compendium";
import { cardHolders, entryIdentity, holderLabel, sameDomainCard, type DomainCardIdentity, type DomainCardUsage } from "@/lib/daggerheart/domain-deck";
import { compendiumEntryDetails } from "./DaggerheartCompendiumPicker";
import { DaggerheartDomainIcon } from "./DaggerheartCompendiumIcons";
import styles from "./DaggerheartDomainDeck.module.css";

type Props = {
  entries: DaggerheartCompendiumEntry[];
  usage: DomainCardUsage[] | null;
  characterId?: string;
  domains: string[];
  selected: DomainCardIdentity[];
  limit: number;
  loading: boolean;
  error: string | null;
  refreshUsage: () => Promise<DomainCardUsage[] | null>;
  onRetry: () => void;
  onSelect: (entry: DaggerheartCompendiumEntry) => void;
  onRemove: (card: DomainCardIdentity) => void;
};

export function DaggerheartDomainDeck({ entries, usage, characterId, domains, selected, limit, loading, error, refreshUsage, onRetry, onSelect, onRemove }: Props) {
  const [domain, setDomain] = useState("");
  const [search, setSearch] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [agreement, setAgreement] = useState("");
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const shown = entries.filter((entry) => (!domain || entry.domain === domain) &&
    `${entry.name} ${entry.summary} ${entry.rules_text}`.toLowerCase().includes(search.trim().toLowerCase()));
  const focused = entries.find((entry) => entry.id === focusedId);
  const selectedCard = focused && selected.find((card) => sameDomainCard(card, entryIdentity(focused)));
  const holders = focused ? cardHolders(entryIdentity(focused), usage ?? [], characterId) : [];
  const holderKey = holders.map((holder) => holder.character_id).sort().join("|");
  const full = selected.length >= limit;

  function inspect(entry: DaggerheartCompendiumEntry) {
    if (busy.current) return;
    setFocusedId(entry.id);
    setAgreement("");
    setNotice("");
    dialog.current?.showModal();
  }
  function browse(offset: number) {
    if (!focused || shown.length < 2) return;
    const index = shown.findIndex((entry) => entry.id === focused.id);
    inspect(shown[(index + offset + shown.length) % shown.length]);
  }
  async function takeCard() {
    if (!focused || full || selectedCard || busy.current) return;
    busy.current = true;
    setChecking(true);
    setNotice("");
    try {
      const freshUsage = await refreshUsage();
      if (!freshUsage) {
        setNotice("Availability could not be checked. Please retry before choosing this card.");
        return;
      }
      const freshHolders = cardHolders(entryIdentity(focused), freshUsage, characterId);
      const freshKey = freshHolders.map((holder) => holder.character_id).sort().join("|");
      if (freshHolders.length && agreement !== freshKey) {
        setAgreement("");
        setNotice(`Already chosen by ${freshHolders.map(holderLabel).join(", ")}. Talk to them or the GM before choosing a shared copy.`);
        return;
      }
      onSelect(focused);
      dialog.current?.close();
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }

  return (
    <section className={styles.table} aria-label="Domain card deck">
      <div className={styles.toolbar}>
        <div><p className={styles.eyebrow}>The domain deck</p><h4>Choose your abilities</h4><p>Spread the cards, read their rules, and build your hand.</p></div>
        <span className={styles.counter} aria-live="polite">{selected.length} / {limit} chosen</span>
      </div>
      <div className={styles.filters}>
        <div className={styles.tabs} role="group" aria-label="Filter by domain">
          {["", ...domains].map((value) => <button key={value} type="button" aria-pressed={domain === value} onClick={() => setDomain(value)}>{value || "All domains"}</button>)}
        </div>
        <label className={styles.search}><span className="sr-only">Search domain cards</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a card or rule…" /></label>
      </div>
      {usage === null && <p className={styles.warning} role="status">Card availability is not verified yet. You can browse; choosing requires a successful check. <button type="button" onClick={onRetry}>Retry</button></p>}
      {error ? <p role="alert" className={styles.warning}>{error} <button type="button" onClick={onRetry}>Retry</button></p> : loading ? <p role="status">Dealing the cards…</p> : !shown.length ? <p role="status">{entries.length ? "No cards match these filters." : "No level 1 cards are available for these domains."}</p> : <>
        <div className={styles.railControls}><span>{shown.length} cards · Select a card to read it</span><div><button type="button" aria-label="Scroll cards left" onClick={() => rail.current?.scrollBy({ left: -300, behavior: "auto" })}>←</button><button type="button" aria-label="Scroll cards right" onClick={() => rail.current?.scrollBy({ left: 300, behavior: "auto" })}>→</button></div></div>
        <div ref={rail} className={styles.rail} aria-label="Available cards">
          {shown.map((entry) => {
            const identity = entryIdentity(entry);
            const chosen = selected.some((card) => sameDomainCard(card, identity));
            const taken = cardHolders(identity, usage ?? [], characterId);
            const metadata = compendiumEffectiveMetadata(entry);
            return <button type="button" key={entry.id} className={`${styles.card} ${chosen ? styles.chosen : ""}`} onClick={() => inspect(entry)} aria-label={`Read ${entry.name}${chosen ? ", in your hand" : taken.length ? `, chosen by ${taken.map(holderLabel).join(", ")}` : ""}`}>
              <span className={styles.cardTop}><span>{entry.domain}</span><span>Level {entry.level}</span></span>
              <span className={styles.emblem}><DaggerheartDomainIcon domain={entry.domain ?? ""} className="size-16" /></span>
              <span className={styles.cardTitle}>{entry.name}</span>
              <span className={styles.cardType}>{String(metadata.card_type ?? "Domain card")} · Recall {String(metadata.recall_cost ?? "—")}</span>
              <span className={styles.summary}>{entry.errata?.summary || entry.summary || entry.rules_text}</span>
              <span className={styles.source}>{entry.source_key === "hope-fear" ? "Hope & Fear" : "Core"}{compendiumHasErrata(entry) ? " · Errata" : ""}</span>
              <span className={`${styles.status} ${taken.length ? styles.occupied : ""}`}>{chosen ? "✓ In your hand" : usage === null ? "Availability unknown" : taken.length ? `Chosen by ${taken.map(holderLabel).join(", ")}` : "Available"}</span>
              {chosen && taken.length > 0 && <span className={`${styles.status} ${styles.occupied}`}>Also chosen by {taken.map(holderLabel).join(", ")}</span>}
              <span className={styles.read}>Read card ↗</span>
            </button>;
          })}
        </div>
      </>}
      <div className={styles.hand}>
        <div className={styles.toolbar}><h4>Your starting hand</h4><span>{full ? "Hand complete" : `Choose ${limit - selected.length} more`}</span></div>
        <p>Cards are shared with the party after you save your character. Browsing does not reserve them.</p>
        <div className={styles.handCards}>
          {selected.map((card, index) => <div className={styles.handCard} key={card.compendium_id ?? `${card.name}-${index}`}><DaggerheartDomainIcon domain={card.domain ?? ""} /><div><strong>{card.name}</strong><small>{card.domain}</small></div><button type="button" onClick={() => onRemove(card)} aria-label={`Return ${card.name} to the deck`}>×</button></div>)}
          {Array.from({ length: Math.max(0, limit - selected.length) }, (_, index) => <div key={index} className={styles.emptySlot}>Choose a card</div>)}
        </div>
      </div>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby="domain-card-title" onCancel={(event) => { if (busy.current) event.preventDefault(); }}>
        {focused && <>
          <div className={styles.toolbar}><span className={styles.eyebrow}>{focused.domain} · Level {focused.level}</span><button type="button" disabled={checking} onClick={() => dialog.current?.close()} aria-label="Close card">×</button></div>
          <div className={styles.detailEmblem}><DaggerheartDomainIcon domain={focused.domain ?? ""} className="size-12" /></div>
          <h3 id="domain-card-title">{focused.name}</h3>
          <p className={styles.cardType}>{String(compendiumEffectiveMetadata(focused).card_type ?? "Domain card")} · Recall {String(compendiumEffectiveMetadata(focused).recall_cost ?? "—")} · {focused.source_key === "hope-fear" ? "Hope & Fear" : "Core"}</p>
          <p className={styles.rules}>{compendiumEntryDetails(focused) || focused.summary}</p>
          {!!holders.length && <div className={styles.warning}><strong>Chosen by {holders.map(holderLabel).join(", ")}</strong><p>Talk to this player or the GM before choosing a shared copy.</p>{!selectedCard && <label className={styles.agreement}><input type="checkbox" disabled={checking} checked={agreement === holderKey} onChange={(event) => setAgreement(event.target.checked ? holderKey : "")} />I have agreed this choice with the player or GM.</label>}</div>}
          {notice && <p role="alert" className={styles.warning}>{notice}</p>}
          <div className={styles.detailActions}>
            <button type="button" disabled={checking || shown.length < 2} onClick={() => browse(-1)} aria-label="Previous card">←</button>
            {selectedCard ? <button type="button" className={styles.primary} onClick={() => { onRemove(selectedCard); dialog.current?.close(); }}>Return to deck</button> : <button type="button" className={styles.primary} disabled={checking || full || (!!holders.length && agreement !== holderKey)} onClick={() => void takeCard()}>{checking ? "Checking…" : full ? "Your hand is full" : "Add to your hand"}</button>}
            <button type="button" disabled={checking || shown.length < 2} onClick={() => browse(1)} aria-label="Next card">→</button>
          </div>
        </>}
      </dialog>
    </section>
  );
}
