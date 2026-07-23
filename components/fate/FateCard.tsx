import styles from "./Fate.module.css";

type FateCardProps = {
  romanNumeral?: string;
  name?: string;
  meaning?: string;
  symbol?: string;
  theme?: string;
  isReversed?: boolean;
  flipped?: boolean;
  compact?: boolean;
};

const themeClasses: Record<string, string> = {
  tide: styles.themeTide,
  arcane: styles.themeArcane,
  moon: styles.themeMoon,
  rose: styles.themeRose,
  storm: styles.themeStorm,
  ember: styles.themeEmber,
  lantern: styles.themeLantern,
  gold: styles.themeGold,
  jungle: styles.themeJungle,
  ash: styles.themeAsh,
  lightning: styles.themeLightning,
  lagoon: styles.themeLagoon,
  neutral: styles.themeNeutral,
};

export function FateCard({
  romanNumeral = "?",
  name = "Unrevealed Arcana",
  meaning = "The threads of fate remain hidden.",
  symbol = "✦",
  theme = "neutral",
  isReversed = false,
  flipped = false,
  compact = false,
}: FateCardProps) {
  const themeClass = themeClasses[theme] ?? styles.themeNeutral;

  return (
    <div className={`${styles.cardShell} ${compact ? styles.compactCard : ""}`}>
      <div
        className={`${styles.cardInner} ${flipped ? styles.cardFlipped : ""}`}
      >
        <div className={`${styles.cardFace} ${styles.cardBack}`}>
          <div className={styles.backSigil}>✦</div>
        </div>

        <div className={`${styles.cardFace} ${styles.cardFront} ${themeClass}`}>
          <div
            className={`${styles.frontContent} ${
              isReversed ? styles.frontContentReversed : ""
            }`}
          >
            <div className={styles.cardOrnament} />
            <p className={styles.cardNumber}>{romanNumeral}</p>

            <div className={styles.cardArt}>
              <div className={styles.cardSymbol}>{symbol}</div>
            </div>

            <h3 className={styles.cardTitle}>{name}</h3>
            <p className={styles.cardMeaning}>{meaning}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
