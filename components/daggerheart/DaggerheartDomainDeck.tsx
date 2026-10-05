"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function sourceLabel(entry: DaggerheartCompendiumEntry) {
  return `${entry.source_key === "hope-fear" ? "Hope & Fear" : "Core"}${compendiumHasErrata(entry) ? " · Errata" : ""}`;
}

export function DaggerheartDomainDeck({ entries, usage, characterId, domains, selected, limit, loading, error, refreshUsage, onRetry, onSelect, onRemove }: Props) {
  const [domain, setDomain] = useState("");
  const [search, setSearch] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [agreement, setAgreement] = useState("");
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => (!domain || entry.domain === domain) &&
      (!query || `${entry.name} ${entry.summary} ${entry.rules_text}`.toLowerCase().includes(query)));
  }, [domain, entries, search]);

  useEffect(() => {
    if (!shown.length) {
      setFocusedId(null);
      return;
    }
    if (!focusedId || !shown.some((entry) => entry.id === focusedId)) {
      setFocusedId(shown[0].id);
      setAgreement("");
      setNotice("");
    }
  }, [focusedId, shown]);

  const activeIndex = Math.max(0, shown.findIndex((entry) => entry.id === focusedId));
  const focused = shown[activeIndex] ?? null;
  const previous = shown.length > 1 ? shown[(activeIndex - 1 + shown.length) % shown.length] : null;
  const next = shown.length > 1 ? shown[(activeIndex + 1) % shown.length] : null;
  const selectedCard = focused && selected.find((card) => sameDomainCard(card, entryIdentity(focused)));
  const holders = focused ? cardHolders(entryIdentity(focused), usage ?? [], characterId) : [];
  const holderKey = holders.map((holder) => holder.character_id).sort().join("|");
  const full = selected.length >= limit;

  function focus(entry: DaggerheartCompendiumEntry) {
    if (busy.current) return;
    setFocusedId(entry.id);
    setAgreement("");
    setNotice("");
  }

  function browse(offset: number) {
    if (!focused || shown.length < 2 || busy.current) return;
    const index = shown.findIndex((entry) => entry.id === focused.id);
    focus(shown[(index + offset + shown.length) % shown.length]);
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
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }

  function previewCard(entry: DaggerheartCompendiumEntry, position: "previous" | "next") {
    const metadata = compendiumEffectiveMetadata(entry);
    return (
      <button type="button" className={`${styles.sideCard} ${position === "previous" ? styles.sidePrevious : styles.sideNext}`} onClick={() => focus(entry)} aria-label={`${position === "previous" ? "Previous" : "Next"} card: ${entry.name}`}>
        <span className={styles.sideTop}>{entry.domain} · Level {entry.level}</span>
        <span className={styles.sideEmblem}><DaggerheartDomainIcon domain={entry.domain ?? ""} /></span>
        <strong>{entry.name}</strong>
        <small>{String(metadata.card_type ?? "Domain card")} · Recall {String(metadata.recall_cost ?? "—")}</small>
        <span className={styles.sideHint}>{position === "previous" ? "← View" : "View →"}</span>
      </button>
    );
  }

  return (
    <section className={styles.table} aria-label="Domain card deck">
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>The domain deck</p>
          <h4>Choose your abilities</h4>
          <p>Browse the deck one card at a time, just like you would at the table.</p>
        </div>
        <span className={styles.counter} aria-live="polite">{selected.length} / {limit} chosen</span>
      </div>

      <div className={styles.filters}>
        <div className={styles.tabs} role="group" aria-label="Filter by domain">
          {["", ...domains].map((value) => (
            <button key={value} type="button" aria-pressed={domain === value} onClick={() => setDomain(value)}>{value || "All domains"}</button>
          ))}
        </div>
        <label className={styles.search}>
          <span className="sr-only">Search domain cards</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a card or rule…" />
        </label>
      </div>

      {usage === null && <p className={styles.warning} role="status">Card availability is not verified yet. You can browse; choosing requires a successful check. <button type="button" onClick={onRetry}>Retry</button></p>}
      {error ? <p role="alert" className={styles.warning}>{error} <button type="button" onClick={onRetry}>Retry</button></p> : loading ? <p role="status" className={styles.loading}>Dealing the cards…</p> : !shown.length ? <p role="status" className={styles.loading}>{entries.length ? "No cards match these filters." : "No level 1 cards are available for these domains."}</p> : focused && <>
        <div className={styles.deckMeta}>
          <span>{shown.length} {shown.length === 1 ? "card" : "cards"}</span>
          <strong>{activeIndex + 1} / {shown.length}</strong>
          <span>Use the arrows or click a side card</span>
        </div>

        <div className={styles.deckStage} onKeyDown={(event) => {
          if (event.key === "ArrowLeft") browse(-1);
          if (event.key === "ArrowRight") browse(1);
        }}>
          <button type="button" className={`${styles.stageArrow} ${styles.stageArrowLeft}`} disabled={shown.length < 2 || checking} onClick={() => browse(-1)} aria-label="Previous card">←</button>
          {previous && previewCard(previous, "previous")}

          <article className={styles.activeCard} tabIndex={0} aria-label={`${focused.name}, ${focused.domain} level ${focused.level}`}>
            <div className={styles.cardTop}><span>{focused.domain}</span><span>Level {focused.level}</span></div>
            <div className={styles.emblem}><DaggerheartDomainIcon domain={focused.domain ?? ""} className="size-16" /></div>
            <h3 className={styles.cardTitle}>{focused.name}</h3>
            <p className={styles.cardType}>{String(compendiumEffectiveMetadata(focused).card_type ?? "Domain card")} · Recall {String(compendiumEffectiveMetadata(focused).recall_cost ?? "—")}</p>
            <div className={styles.rules}>{compendiumEntryDetails(focused) || focused.summary}</div>
            <div className={styles.cardFooter}>
              <span>{sourceLabel(focused)}</span>
              {selectedCard ? <strong className={styles.inHand}>✓ In your hand</strong> : usage === null ? <strong>Availability unknown</strong> : holders.length ? <strong className={styles.occupiedText}>Chosen by {holders.map(holderLabel).join(", ")}</strong> : <strong>Available</strong>}
            </div>
          </article>

          {next && previewCard(next, "next")}
          <button type="button" className={`${styles.stageArrow} ${styles.stageArrowRight}`} disabled={shown.length < 2 || checking} onClick={() => browse(1)} aria-label="Next card">→</button>
        </div>

        <div className={styles.cardActions}>
          {!!holders.length && <div className={styles.occupiedPanel}>
            <div>
              <strong>Already chosen by {holders.map(holderLabel).join(", ")}</strong>
              <p>This card is already in another character's hand. You can still choose a shared copy after agreeing it with that player or the GM.</p>
            </div>
            {!selectedCard && <label className={styles.agreement}><input type="checkbox" disabled={checking} checked={agreement === holderKey} onChange={(event) => setAgreement(event.target.checked ? holderKey : "")} />I have agreed this shared card with the player or GM.</label>}
          </div>}
          {notice && <p role="alert" className={styles.warning}>{notice}</p>}
          <div className={styles.primaryRow}>
            <button type="button" className={styles.secondaryAction} disabled={shown.length < 2 || checking} onClick={() => browse(-1)}>← Previous</button>
            {selectedCard ? (
              <button type="button" className={styles.primaryAction} onClick={() => onRemove(selectedCard)}>Return to deck</button>
            ) : (
              <button type="button" className={styles.primaryAction} disabled={checking || full || (!!holders.length && agreement !== holderKey)} onClick={() => void takeCard()}>{checking ? "Checking availability…" : full ? "Your hand is full" : holders.length && agreement !== holderKey ? "Confirm agreement to choose" : "Add to your hand"}</button>
            )}
            <button type="button" className={styles.secondaryAction} disabled={shown.length < 2 || checking} onClick={() => browse(1)}>Next →</button>
          </div>
        </div>
      </>}

      <div className={styles.hand}>
        <div className={styles.toolbar}><h4>Your starting hand</h4><span>{full ? "Hand complete" : `Choose ${limit - selected.length} more`}</span></div>
        <p>Your chosen cards stay visible here while you browse the deck.</p>
        <div className={styles.handCards}>
          {selected.map((card, index) => (
            <div className={styles.handCard} key={card.compendium_id ?? `${card.name}-${index}`}>
              <DaggerheartDomainIcon domain={card.domain ?? ""} />
              <div><strong>{card.name}</strong><small>{card.domain}</small></div>
              <button type="button" onClick={() => onRemove(card)} aria-label={`Return ${card.name} to the deck`}>×</button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, limit - selected.length) }, (_, index) => <div key={index} className={styles.emptySlot}>Choose a card</div>)}
        </div>
      </div>
    </section>
  );
}
