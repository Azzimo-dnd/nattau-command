import type { JsonRecord } from "./puzzleTypes";
import { makeVariantId } from "./puzzleVariants";

export type GeneratedRunicResonance = {
  publicConfig: JsonRecord;
  secretConfig: JsonRecord;
  solutionMoves: number;
};

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function difficultyConfig(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return { size: 4, locked: 0, presses: 5, allowance: 5 };
    case "hard":
      return { size: 5, locked: 3, presses: 10, allowance: 4 };
    case "insane":
      return { size: 6, locked: 5, presses: 14, allowance: 3 };
    default:
      return { size: 5, locked: 0, presses: 8, allowance: 5 };
  }
}

export function resonanceEffects(size: number) {
  const total = size * size;
  return Array.from({ length: total }, (_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    const affected = [index];
    if (row > 0) affected.push(index - size);
    if (col < size - 1) affected.push(index + 1);
    if (row < size - 1) affected.push(index + size);
    if (col > 0) affected.push(index - 1);
    return affected;
  });
}

export function applyResonancePress(
  state: boolean[],
  effects: number[][],
  index: number,
) {
  const next = [...state];
  for (const affected of effects[index] ?? []) {
    if (affected >= 0 && affected < next.length) {
      next[affected] = !next[affected];
    }
  }
  return next;
}

export function resonanceSolved(state: boolean[], target: boolean[]) {
  return (
    state.length === target.length &&
    state.every((value, index) => value === target[index])
  );
}

export function buildRunicResonanceConfig(
  difficulty: string,
): GeneratedRunicResonance {
  const cfg = difficultyConfig(difficulty);
  const total = cfg.size * cfg.size;
  const effects = resonanceEffects(cfg.size);
  const allIndices = Array.from({ length: total }, (_, index) => index);
  const lockedIndices = shuffle(allIndices).slice(0, cfg.locked);
  const locked = new Set(lockedIndices);
  const clickable = allIndices.filter((index) => !locked.has(index));

  const solutionPresses = shuffle(clickable).slice(
    0,
    Math.min(cfg.presses, clickable.length),
  );

  let initialLit = Array.from({ length: total }, () => false);
  for (const index of solutionPresses) {
    initialLit = applyResonancePress(initialLit, effects, index);
  }

  if (!initialLit.some(Boolean)) {
    const fallback = clickable[0];
    if (fallback != null) {
      initialLit = applyResonancePress(initialLit, effects, fallback);
      solutionPresses.splice(0, solutionPresses.length, fallback);
    }
  }

  const targetLit = Array.from({ length: total }, () => false);
  const variantId = makeVariantId("resonance", [
    difficulty,
    cfg.size,
    ...lockedIndices,
    ...solutionPresses,
    Date.now(),
    Math.random(),
  ]);

  return {
    publicConfig: {
      size: cfg.size,
      initial_lit: initialLit,
      target_lit: targetLit,
      effects,
      locked_indices: lockedIndices,
      variant_id: variantId,
      generation_rule: "verified-lights-out-by-legal-forward-scramble",
      legend:
        "Touching a rune flips it and its orthogonal neighbours. Silence every rune. Sealed runes cannot be touched but can still resonate.",
    } satisfies JsonRecord,
    secretConfig: {
      solution_presses: solutionPresses,
    } satisfies JsonRecord,
    solutionMoves: solutionPresses.length + cfg.allowance,
  };
}
