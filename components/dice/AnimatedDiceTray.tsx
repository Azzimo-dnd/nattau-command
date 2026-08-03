"use client";

import { AnimatedDie } from "./AnimatedDie";
import type { AnimatedDieSpec } from "./diceAnimation";
import styles from "./DiceAnimation.module.css";

type AnimatedDiceTrayProps = {
  variant: "nattau" | "barovia";
  dice: AnimatedDieSpec[];
  rolling: boolean;
  animationKey: number;
  omittedCount?: number;
  label?: string;
  emptyMessage?: string;
  critical?: boolean;
};

export function AnimatedDiceTray({
  variant,
  dice,
  rolling,
  animationKey,
  omittedCount = 0,
  label,
  emptyMessage = "The dice are waiting.",
  critical = false,
}: AnimatedDiceTrayProps) {
  return (
    <div
      className={`${styles.tray} ${
        variant === "nattau" ? styles.trayNattau : styles.trayBarovia
      } ${critical ? styles.criticalTray : ""}`}
    >
      <div className={styles.trayTopLine}>
        <span>{label ?? (rolling ? "Dice in motion" : "Dice tray")}</span>
        {rolling && <span className={styles.motionIndicator}>Rolling</span>}
      </div>

      <div className={styles.trayStage}>
        <span className={styles.trayMark} aria-hidden="true" />
        <span className={styles.trayGlow} aria-hidden="true" />

        {dice.length > 0 ? (
          <div className={styles.diceCloud}>
            {dice.map((die) => (
              <AnimatedDie
                key={`${animationKey}-${die.id}`}
                die={die}
                rolling={rolling}
                animationKey={animationKey}
              />
            ))}
          </div>
        ) : (
          <p className={styles.emptyMessage}>{emptyMessage}</p>
        )}

        {omittedCount > 0 && (
          <span className={styles.omitted}>+{omittedCount} more dice</span>
        )}
      </div>
    </div>
  );
}
