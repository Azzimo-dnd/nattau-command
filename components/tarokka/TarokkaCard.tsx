import { TarokkaArtwork } from "./TarokkaArtwork";
import type { TarokkaCardView } from "./tarokkaTypes";
import styles from "./Tarokka.module.css";

type TarokkaCardProps = {
  card?: TarokkaCardView | null;
  revealed: boolean;
  compact?: boolean;
  interactive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
};

export function TarokkaCard({
  card,
  revealed,
  compact = false,
  interactive = false,
  selected = false,
  disabled = false,
  onClick,
  ariaLabel,
}: TarokkaCardProps) {
  const reversed = Boolean(card?.isReversed);

  return (
    <button
      type="button"
      disabled={disabled || !interactive}
      onClick={onClick}
      aria-label={ariaLabel ?? (revealed && card ? card.name : "Face-down Tarokka card")}
      className={`${styles.cardButton} ${compact ? styles.cardCompact : ""} ${
        interactive ? styles.cardInteractive : styles.cardStatic
      } ${selected ? styles.cardSelected : ""}`}
    >
      <span className={styles.cardPerspective}>
        <span
          className={`${styles.cardInner} ${revealed ? styles.cardRevealed : ""} ${
            revealed && reversed ? styles.cardReversed : ""
          }`}
        >
          <span className={`${styles.cardFace} ${styles.cardBack}`}>
            <span className={styles.backOuterFrame} />
            <span className={styles.backInnerFrame} />
            <span className={styles.backMoon}>
              <span className={styles.backRaven}>◆</span>
            </span>
            <span className={styles.backMist} />
            <span className={styles.backTitle}>TAROKKA</span>
          </span>

          <span className={`${styles.cardFace} ${styles.cardFront}`}>
            {card ? (
              <>
                <span className={styles.frontTexture} />
                <span className={styles.frontOuterFrame} />
                <span className={styles.frontInnerFrame} />
                <span className={styles.cornerTopLeft}>{card.sigil}</span>
                <span className={styles.cornerTopRight}>{card.sigil}</span>
                <span className={styles.cornerBottomLeft}>{card.sigil}</span>
                <span className={styles.cornerBottomRight}>{card.sigil}</span>

                <span className={styles.cardNumber}>{card.number}</span>
                <TarokkaArtwork
                  artKey={card.artKey}
                  sigil={card.sigil}
                  className={styles.cardArtwork}
                />
                <span className={styles.cardName}>{card.name}</span>
                <span className={styles.cardSubtitle}>{card.subtitle}</span>
                <span className={styles.cardFooterSigil}>{card.sigil}</span>
              </>
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
}
