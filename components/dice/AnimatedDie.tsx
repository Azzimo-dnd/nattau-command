"use client";

import type { CSSProperties } from "react";
import type { AnimatedDieSpec } from "./diceAnimation";
import { Real3DDieCanvas } from "./Real3DDieCanvas";
import styles from "./DiceAnimation.module.css";

type AnimatedDieProps = {
  die: AnimatedDieSpec;
  rolling: boolean;
  animationKey: number;
  size?: "small" | "medium" | "large";
};

export function AnimatedDie({
  die,
  rolling,
  animationKey,
  size = "medium",
}: AnimatedDieProps) {
  const style = {
    "--die-delay": `${die.delayMs ?? 0}ms`,
  } as CSSProperties;

  return (
    <div
      className={`${styles.dieWrap} ${styles[size]} ${
        rolling ? styles.rolling : styles.settled
      } ${die.discarded ? styles.discarded : ""}`}
      style={style}
    >
      <Real3DDieCanvas
        die={die}
        rolling={rolling}
        animationKey={animationKey}
      />
      <span className={styles.shadow} aria-hidden="true" />
      {!die.label && (
        <span className={styles.dieCaption} aria-hidden="true">
          d{die.sides}
        </span>
      )}
    </div>
  );
}
