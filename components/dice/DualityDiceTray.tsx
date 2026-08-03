"use client";

import { AnimatedDie } from "./AnimatedDie";
import type { AnimatedDieSpec } from "./diceAnimation";
import type { SupportedDie } from "./diceUtils";
import styles from "./DiceAnimation.module.css";

type DualityDiceTrayProps = {
  hope: number | null;
  fear: number | null;
  advantage?: number | null;
  advantageMode?: "normal" | "advantage" | "disadvantage";
  rolling: boolean;
  animationKey: number;
  outcome?: string | null;
  critical?: boolean;
  reaction?: boolean;
};

export function DualityDiceTray({
  hope,
  fear,
  advantage,
  advantageMode = "normal",
  rolling,
  animationKey,
  outcome,
  critical = false,
  reaction = false,
}: DualityDiceTrayProps) {
  const hopeDie: AnimatedDieSpec = {
    id: "hope-d12",
    sides: 12,
    value: hope,
    tone: "hope",
    label: "Hope",
    motion: "duality-left",
  };

  const fearDie: AnimatedDieSpec = {
    id: "fear-d12",
    sides: 12,
    value: fear,
    tone: "fear",
    label: "Fear",
    motion: "duality-right",
    delayMs: 60,
  };

  const advantageDie: AnimatedDieSpec | null =
    advantageMode === "normal"
      ? null
      : {
          id: "duality-d6",
          sides: 6 as SupportedDie,
          value: advantage ?? null,
          tone: "advantage",
          label: advantageMode === "advantage" ? "Advantage" : "Disadvantage",
          motion: "drop-center",
          delayMs: 180,
        };

  return (
    <div
      className={`${styles.tray} ${styles.trayBarovia} ${styles.dualityTray} ${
        critical ? styles.criticalTray : ""
      }`}
    >
      <div className={styles.trayTopLine}>
        <span>{reaction ? "Reaction Roll" : "The Duality"}</span>
        {rolling && <span className={styles.motionIndicator}>The dice turn</span>}
      </div>

      <div className={styles.dualityStage}>
        <span className={styles.mistOne} aria-hidden="true" />
        <span className={styles.mistTwo} aria-hidden="true" />
        {critical && !rolling && (
          <span className={styles.criticalRing} aria-hidden="true" />
        )}

        <div className={`${styles.dualitySlot} ${styles.hopeSlot}`}>
          <span className={styles.dualityLabel}>Hope</span>
          <AnimatedDie
            die={hopeDie}
            rolling={rolling}
            animationKey={animationKey}
            size="large"
          />
        </div>

        <div className={styles.dualitySigil} aria-hidden="true">
          ✦
        </div>

        <div className={`${styles.dualitySlot} ${styles.fearSlot}`}>
          <span className={styles.dualityLabel}>Fear</span>
          <AnimatedDie
            die={fearDie}
            rolling={rolling}
            animationKey={animationKey}
            size="large"
          />
        </div>

        {advantageDie && (
          <div className={styles.advantageSlot}>
            <span>
              {advantageMode === "advantage" ? "+ Advantage" : "− Disadvantage"}
            </span>
            <AnimatedDie
              die={advantageDie}
              rolling={rolling}
              animationKey={animationKey}
              size="small"
            />
          </div>
        )}
      </div>

      <div className={styles.dualityOutcome}>
        {rolling
          ? "Hope and Fear cross within the Mists..."
          : outcome ?? "Two d12s await the call."}
      </div>
    </div>
  );
}
