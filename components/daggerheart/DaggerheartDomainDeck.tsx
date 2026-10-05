"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { compendiumEffectiveMetadata, compendiumHasErrata, type DaggerheartCompendiumEntry } from "@/lib/daggerheart/compendium";
import { cardHolders, entryIdentity, holderLabel, sameDomainCard, type DomainCardIdentity, type DomainCardUsage } from "@/lib/daggerheart/domain-deck";
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
  mode?: "selection" | "browser";
};

function sourceLabel(entry: DaggerheartCompendiumEntry) {
  return `${entry.source_key === "hope-fear" ? "Hope & Fear" : "Core"}${compendiumHasErrata(entry) ? " · Errata" : ""}`;
}

function domainCardDetails(entry: DaggerheartCompendiumEntry) {
  const original = entry.rules_text && entry.rules_text !== "—" ? entry.rules_text : entry.summary;
  if (!compendiumHasErrata(entry)) return original;
  const current = [entry.errata.summary, entry.errata.rules_text].filter(Boolean).join(" · ");
  const revision = entry.errata.revision ? ` (${entry.errata.revision})` : "";
  return [
    `Original source: ${original || "See source entry."}`,
    `Official errata/current${revision}: ${current || original || "See current compendium entry."}`,
  ].join("\n\n");
}

function domainKey(domain?: string | null) {
  return (domain ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function DaggerheartDomainDeck({ entries, usage, characterId, domains, selected, limit, loading, error, refreshUsage, onRetry, onSelect, onRemove, mode = "selection" }: Props) {
  const [domain, setDomain] = useState("");
  const [search, setSearch] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [agreement, setAgreement] = useState("");
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const browserMode = mode === "browser";

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
  const selectedCard = !browserMode && focused
    ? selected.find((card) => sameDomainCard(card, entryIdentity(focused)))
    : undefined;
  const holders = focused ? cardHolders(entryIdentity(focused), usage ?? [], characterId) : [];
  const holderKey = holders.map((holder) => holder.character_id).sort().join("|");
  const full = !browserMode && selected.length >= limit;
  const focusedMetadata = focused ? compendiumEffectiveMetadata(focused) : null;
  const focusedType = String(focusedMetadata?.card_type ?? "Domain card");
  const focusedRecall = String(focusedMetadata?.recall_cost ?? "—");

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
    if (!focused || (!browserMode && (full || selectedCard)) || busy.current) return;
    if (browserMode) {
      onSelect(focused);
      return;
    }
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
    const cardType = String(metadata.card_type ?? "Domain card");
    const recall = String(metadata.recall_cost ?? "—");
    return (
      <button
        type="button"
        className={`${styles.sideCard} ${position === "previous" ? styles.sidePrevious : styles.sideNext}`}
        data-domain={domainKey(entry.domain)}
        onClick={() => focus(entry)}
        aria-label={`${position === "previous" ? "Previous" : "Next"} card: ${entry.name}`}
      >
        <span className={styles.sideBanner} aria-hidden="true">
          <strong>{entry.level}</strong>
          <DaggerheartDomainIcon domain={entry.domain ?? ""} />
        </span>
        <span className={styles.sideRecall}><strong>{recall}</strong><small>recall</small></span>
        <span className={styles.sideWatermark} aria-hidden="true"><DaggerheartDomainIcon domain={entry.domain ?? ""} /></span>
        <span className={styles.sideType}>{cardType}</span>
        <strong className={styles.sideTitle}>{entry.name}</strong>
        <small className={styles.sideDomain}>{entry.domain} domain</small>
        <span className={styles.sideHint}>{position === "previous" ? "← View" : "View →"}</span>
      </button>
    );
  }

  const availabilityClass = selectedCard
    ? styles.stateOwned
    : usage === null
      ? styles.stateUnknown
      : holders.length
        ? styles.stateOccupied
        : styles.stateAvailable;

  return (
    <section className={styles.table} aria-label={browserMode ? "Domain card library" : "Domain card deck"}>
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>{browserMode ? "Domain library" : "The domain deck"}</p>
          <h4>{browserMode ? "Browse available Domain Cards" : "Choose your abilities"}</h4>
          <p>{browserMode ? "Browse the cards as a physical Daggerheart deck, then add the chosen card to this character." : "Browse the deck like a physical hand of Daggerheart cards laid out on a Barovian table."}</p>
        </div>
        <span className={styles.counter} aria-live="polite">
          {browserMode ? `${shown.length} ${shown.length === 1 ? "card" : "cards"}` : `${selected.length} / ${limit} chosen`}
        </span>
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

      {!browserMode && usage === null && <p className={styles.warning} role="status">Card availability is not verified yet. You can browse; choosing requires a successful check. <button type="button" onClick={onRetry}>Retry</button></p>}
      {error ? <p role="alert" className={styles.warning}>{error} <button type="button" onClick={onRetry}>Retry</button></p> : loading ? <p role="status" className={styles.loading}>Dealing the cards…</p> : !shown.length ? <p role="status" className={styles.loading}>{entries.length ? "No cards match these filters." : "No cards are available for these domains and this level."}</p> : focused && <>
        <div className={styles.deckMeta}>
          <span>{shown.length} {shown.length === 1 ? "card" : "cards"}</span>
          <strong>{activeIndex + 1} / {shown.length}</strong>
          <span>Use arrows, click a side card, or swipe on mobile</span>
        </div>

        <div
          className={styles.deckStage}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") browse(-1);
            if (event.key === "ArrowRight") browse(1);
          }}
          onTouchStart={(event) => {
            touchStartX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            const end = event.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (start === null || end === undefined) return;
            const distance = end - start;
            if (Math.abs(distance) >= 48) browse(distance > 0 ? -1 : 1);
          }}
        >
          <button type="button" className={`${styles.stageArrow} ${styles.stageArrowLeft}`} disabled={shown.length < 2 || checking} onClick={() => browse(-1)} aria-label="Previous card">←</button>
          {previous && previewCard(previous, "previous")}

          <article className={styles.activeCard} data-domain={domainKey(focused.domain)} tabIndex={0} aria-label={`${focused.name}, ${focused.domain} level ${focused.level}`}>
            <div className={styles.domainBanner} aria-hidden="true">
              <strong>{focused.level}</strong>
              <DaggerheartDomainIcon domain={focused.domain ?? ""} />
              <span>{focused.domain}</span>
            </div>
            <div className={styles.recallBadge} aria-label={`Recall cost ${focusedRecall}`}>
              <strong>{focusedRecall}</strong>
              <span>recall</span>
            </div>
            <div className={styles.watermark} aria-hidden="true"><DaggerheartDomainIcon domain={focused.domain ?? ""} /></div>

            <div className={styles.cardLead}>
              <div className={styles.typeBand}><span>{focusedType}</span></div>
              <h3 className={styles.cardTitle}>{focused.name}</h3>
            </div>

            <div className={styles.rules}>{domainCardDetails(focused) || focused.summary}</div>

            <div className={styles.cardFooter}>
              <span>{sourceLabel(focused)}</span>
              <span>{focused.domain} · Level {focused.level}</span>
            </div>
          </article>

          {next && previewCard(next, "next")}
          <button type="button" className={`${styles.stageArrow} ${styles.stageArrowRight}`} disabled={shown.length < 2 || checking} onClick={() => browse(1)} aria-label="Next card">→</button>
        </div>

        <div className={styles.cardActions}>
          {browserMode && (
            <div className={styles.availabilityRow}>
              <strong className={`${styles.availabilityBadge} ${availabilityClass}`} aria-live="polite">
                {usage === null ? "Availability unknown" : holders.length ? `Chosen by ${holders.map(holderLabel).join(", ")}` : "Available"}
              </strong>
              <span>
                {usage === null
                  ? "Could not verify who currently holds this card."
                  : holders.length
                    ? "This card is already held by another active character in this campaign; the GM can still add a shared copy."
                    : "No active character in this campaign currently holds this card."}
              </span>
              {usage === null && <button type="button" className={styles.secondaryAction} onClick={onRetry}>Retry</button>}
            </div>
          )}
          {!browserMode && <>
            <div className={styles.availabilityRow}>
              <strong className={`${styles.availabilityBadge} ${availabilityClass}`} aria-live="polite">
                {selectedCard ? "✓ In your hand" : usage === null ? "Availability unknown" : holders.length ? `Chosen by ${holders.map(holderLabel).join(", ")}` : "Available"}
              </strong>
              <span>Card status is kept outside the printed face so the deck still reads like a real tabletop prop.</span>
            </div>

            {!!holders.length && <div className={styles.occupiedPanel}>
              <div>
                <strong>Already chosen by {holders.map(holderLabel).join(", ")}</strong>
                <p>This card is already in another character&apos;s hand. You can still choose a shared copy after agreeing it with that player or the GM.</p>
              </div>
              {!selectedCard && <label className={styles.agreement}><input type="checkbox" disabled={checking} checked={agreement === holderKey} onChange={(event) => setAgreement(event.target.checked ? holderKey : "")} />I have agreed this shared card with the player or GM.</label>}
            </div>}
            {notice && <p role="alert" className={styles.warning}>{notice}</p>}
          </>}
          <div className={styles.primaryRow}>
            <button type="button" className={styles.secondaryAction} disabled={shown.length < 2 || checking} onClick={() => browse(-1)}>← Previous</button>
            {browserMode ? (
              <button type="button" className={styles.primaryAction} onClick={() => void takeCard()}>Add to character</button>
            ) : selectedCard ? (
              <button type="button" className={styles.primaryAction} onClick={() => onRemove(selectedCard)}>Return to deck</button>
            ) : (
              <button type="button" className={styles.primaryAction} disabled={checking || full || (!!holders.length && agreement !== holderKey)} onClick={() => void takeCard()}>{checking ? "Checking availability…" : full ? "Your hand is full" : holders.length && agreement !== holderKey ? "Confirm agreement to choose" : "Add to your hand"}</button>
            )}
            <button type="button" className={styles.secondaryAction} disabled={shown.length < 2 || checking} onClick={() => browse(1)}>Next →</button>
          </div>
        </div>
      </>}

      {!browserMode && <div className={styles.hand}>
        <div className={styles.toolbar}><h4>Your starting hand</h4><span>{full ? "Hand complete" : `Choose ${limit - selected.length} more`}</span></div>
        <p>Your chosen cards stay visible here while you browse the deck.</p>
        <div className={styles.handCards}>
          {selected.map((card, index) => (
            <div className={styles.handCard} data-domain={domainKey(card.domain)} key={card.compendium_id ?? `${card.name}-${index}`}>
              <span className={styles.handIcon}><DaggerheartDomainIcon domain={card.domain ?? ""} /></span>
              <div><strong>{card.name}</strong><small>{card.domain}</small></div>
              <button type="button" onClick={() => onRemove(card)} aria-label={`Return ${card.name} to the deck`}>×</button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, limit - selected.length) }, (_, index) => <div key={index} className={styles.emptySlot}>Choose a card</div>)}
        </div>
      </div>}
    </section>
  );
}
