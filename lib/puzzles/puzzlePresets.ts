import {
  circuitReachesTargets,
  findCircuitRotation,
  rotateCircuitMask,
} from "./arcaneCircuit";
import type { JsonRecord, PuzzlePreset, PuzzleType } from "./puzzleTypes";
import { NATTAU_RUNE_IDS } from "./nattauRunes";

export const DEFAULT_RUNES = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ"];

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomRuneSequence(pool: string[], length: number) {
  return Array.from({ length }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function buildSlidingConfig(difficulty: string) {
  const normalized = difficulty.toLowerCase();
  const hard = normalized === "hard" || normalized === "insane";
  const medium = normalized === "medium";

  const blocks = hard
    ? [
        { id: "A", x: 0, y: 2, w: 2, h: 1, axis: "h", target: true, label: "Koru Seal" },
        { id: "B", x: 2, y: 1, w: 1, h: 3, axis: "v", label: "Awa Ward" },
        { id: "C", x: 0, y: 4, w: 3, h: 1, axis: "h", label: "Matau Ward" },
        { id: "D", x: 4, y: 0, w: 1, h: 2, axis: "v", label: "Tara Ward" },
        { id: "E", x: 3, y: 5, w: 2, h: 1, axis: "h", label: "Whetu Ward" },
      ]
    : medium
      ? [
          { id: "A", x: 0, y: 2, w: 2, h: 1, axis: "h", target: true, label: "Koru Seal" },
          { id: "B", x: 2, y: 1, w: 1, h: 3, axis: "v", label: "Awa Ward" },
          { id: "C", x: 1, y: 4, w: 2, h: 1, axis: "h", label: "Matau Ward" },
          { id: "D", x: 4, y: 0, w: 1, h: 2, axis: "v", label: "Tara Ward" },
        ]
      : [
          { id: "A", x: 0, y: 2, w: 2, h: 1, axis: "h", target: true, label: "Koru Seal" },
          { id: "B", x: 2, y: 1, w: 1, h: 2, axis: "v", label: "Awa Ward" },
          { id: "C", x: 4, y: 3, w: 1, h: 2, axis: "v", label: "Matau Ward" },
        ];

  return {
    width: 6,
    height: 6,
    exit_side: "right",
    exit_row: 2,
    target_block_id: "A",
    blocks,
  } satisfies JsonRecord;
}

function buildSigilConfig(difficulty: string) {
  const normalized = difficulty.toLowerCase();
  const size = normalized === "hard" || normalized === "insane" ? 4 : 3;
  const scrambleSteps =
    normalized === "easy" ? 8 : normalized === "medium" ? 14 : normalized === "hard" ? 22 : 30;
  const symbols = [
    "☉", "☽", "✦", "ᚦ", "ᛉ", "ᚱ", "ᚲ", "ᚷ",
    "ᚹ", "ᛏ", "ᛒ", "ᛗ", "ᛟ", "ᛞ", "ᛇ", "ᚾ",
  ].slice(0, size * size);
  const targetOrder = symbols.map((_, index) => String(index));
  const initialOrder = [...targetOrder];
  let previousPair = "";

  for (let step = 0; step < scrambleSteps; step += 1) {
    const from = Math.floor(Math.random() * initialOrder.length);
    const row = Math.floor(from / size);
    const col = from % size;
    const neighbors: number[] = [];
    if (row > 0) neighbors.push(from - size);
    if (row < size - 1) neighbors.push(from + size);
    if (col > 0) neighbors.push(from - 1);
    if (col < size - 1) neighbors.push(from + 1);
    const candidates = neighbors.filter((to) => `${to}-${from}` !== previousPair);
    const pool = candidates.length > 0 ? candidates : neighbors;
    const to = pool[Math.floor(Math.random() * pool.length)];
    [initialOrder[from], initialOrder[to]] = [initialOrder[to], initialOrder[from]];
    previousPair = `${from}-${to}`;
  }

  if (initialOrder.every((value, index) => value === targetOrder[index])) {
    [initialOrder[0], initialOrder[1]] = [initialOrder[1], initialOrder[0]];
  }

  return {
    publicConfig: {
      size,
      symbols,
      initial_order: initialOrder,
      target_hint: "Restore the sigil to its canonical reading order.",
      scramble_steps: scrambleSteps,
    } satisfies JsonRecord,
    secretConfig: {
      target_order: targetOrder,
    } satisfies JsonRecord,
    scrambleSteps,
  };
}

function buildCircuitConfig(difficulty: string) {
  const hard = ["hard", "insane"].includes(difficulty.toLowerCase());
  const size = hard ? 5 : 4;
  const path: number[] = [];
  for (let row = 0; row < size; row += 1) {
    const cols = Array.from({ length: size }, (_, index) => index);
    if (row % 2 === 1) cols.reverse();
    cols.forEach((col) => path.push(row * size + col));
  }

  const masks = Array.from({ length: size * size }, () => 0);
  const directionMask = (from: number, to: number) => {
    const fromRow = Math.floor(from / size);
    const fromCol = from % size;
    const toRow = Math.floor(to / size);
    const toCol = to % size;
    if (toRow < fromRow) return 1;
    if (toCol > fromCol) return 2;
    if (toRow > fromRow) return 4;
    return 8;
  };

  for (let index = 0; index < path.length; index += 1) {
    const current = path[index];
    if (index > 0) masks[current] |= directionMask(current, path[index - 1]);
    if (index < path.length - 1) masks[current] |= directionMask(current, path[index + 1]);
  }

  // Each tile gets a random base orientation before it is sent to the client.
  // That means inspecting public_config does not reveal that “rotation 0” is the solution.
  const baseRotations = masks.map(() => Math.floor(Math.random() * 4));
  const publicMasks = masks.map((mask, index) => rotateCircuitMask(mask, baseRotations[index]));
  const sourceIndex = path[0];
  const targetIndices = [path[path.length - 1]];
  const lockedIndices = [sourceIndex, ...targetIndices];
  const lockedSet = new Set(lockedIndices);
  const solutionRotations = publicMasks.map((mask, index) =>
    findCircuitRotation(mask, masks[index]),
  );

  let initialRotations = publicMasks.map((_, index) =>
    lockedSet.has(index)
      ? solutionRotations[index]
      : Math.floor(Math.random() * 4),
  );

  // The anchors always begin in their correct orientation. Re-roll only the
  // free tiles if a random scramble accidentally creates a complete circuit.
  for (
    let attempt = 0;
    attempt < 24 &&
    circuitReachesTargets(
      publicMasks,
      initialRotations,
      size,
      sourceIndex,
      targetIndices,
    );
    attempt += 1
  ) {
    initialRotations = initialRotations.map((rotation, index) =>
      lockedSet.has(index) ? rotation : Math.floor(Math.random() * 4),
    );
  }

  // Extremely defensive fallback for a pathological random sequence.
  if (
    circuitReachesTargets(
      publicMasks,
      initialRotations,
      size,
      sourceIndex,
      targetIndices,
    )
  ) {
    const adjustableIndex = publicMasks.findIndex(
      (mask, index) =>
        !lockedSet.has(index) &&
        rotateCircuitMask(mask, initialRotations[index] + 1) !==
          rotateCircuitMask(mask, initialRotations[index]),
    );
    if (adjustableIndex >= 0) {
      initialRotations[adjustableIndex] =
        (initialRotations[adjustableIndex] + 1) % 4;
    }
  }

  const clockwiseDistance = publicMasks.reduce((sum, mask, index) => {
    if (lockedSet.has(index)) {
      return sum;
    }

    for (let steps = 0; steps < 4; steps += 1) {
      if (
        rotateCircuitMask(mask, initialRotations[index] + steps) === masks[index]
      ) {
        return sum + steps;
      }
    }

    return sum + 3;
  }, 0);

  return {
    publicConfig: {
      width: size,
      height: size,
      masks: publicMasks,
      initial_rotations: initialRotations,
      source_index: sourceIndex,
      target_indices: targetIndices,
      locked_indices: lockedIndices,
      legend:
        "Rotate the free conduits until the live current reaches every anchored destination.",
    } satisfies JsonRecord,
    secretConfig: {
      target_masks: masks,
    } satisfies JsonRecord,
    scrambleMoves: clockwiseDistance,
  };
}

export function buildPuzzlePreset(
  type: PuzzleType,
  difficulty = "Medium"
): PuzzlePreset {
  const normalized = difficulty.toLowerCase();
  const insane = normalized === "insane";
  const hard = normalized === "hard" || insane;
  const easy = normalized === "easy";

  if (type === "rune_cipher") {
    const codeLength = easy ? 3 : insane ? 6 : hard ? 5 : 4;
    const pool = NATTAU_RUNE_IDS.slice(0, hard ? 8 : easy ? 5 : 6);
    return {
      title: "Seal of the Forgotten Tongue",
      description: "An old Nattau seal answers only to the lost island glyphs spoken in the proper order.",
      difficultyLabel: difficulty,
      moveLimit: null,
      attemptLimit: easy ? 8 : insane ? 4 : hard ? 5 : 6,
      timeLimitSeconds: null,
      failureMessage: "The runes flare crimson and the seal becomes deathly still.",
      publicConfig: {
        runes: pool,
        code_length: codeLength,
        allow_repeats: true,
      },
      secretConfig: {
        solution: randomRuneSequence(pool, codeLength),
      },
    };
  }

  if (type === "sliding_lock") {
    return {
      title: "The Koru Gate",
      description: "Carved Nattau wards bind an old ceremonial gate. Slide the greenstone Koru Seal through the interlocking carvings and carry it to the open edge.",
      difficultyLabel: difficulty,
      moveLimit: easy ? 5 : insane ? 4 : hard ? 5 : 6,
      attemptLimit: null,
      timeLimitSeconds: null,
      failureMessage: "The carved wards slam into place and the Koru Gate falls silent.",
      publicConfig: buildSlidingConfig(difficulty),
      secretConfig: {},
    };
  }

  if (type === "shattered_sigil") {
    const config = buildSigilConfig(difficulty);
    return {
      title: "Shattered Sigil",
      description: "The ward has been broken into drifting fragments. Reassemble the ancient pattern.",
      difficultyLabel: difficulty,
      moveLimit: config.scrambleSteps + (easy ? 6 : insane ? 4 : hard ? 6 : 8),
      attemptLimit: null,
      timeLimitSeconds: null,
      failureMessage: "The fragments sink into the stone before the sigil can be restored.",
      publicConfig: config.publicConfig,
      secretConfig: config.secretConfig,
    };
  }

  if (type === "arcane_circuit") {
    const config = buildCircuitConfig(difficulty);
    return {
      title: "Arcane Circuit",
      description: "A dead lattice of conduits covers the device. Rotate the channels until the current reaches its destination.",
      difficultyLabel: difficulty,
      moveLimit: config.scrambleMoves + (easy ? 12 : insane ? 4 : hard ? 7 : 10),
      attemptLimit: null,
      timeLimitSeconds: null,
      failureMessage: "The lattice overloads and the light dies from every conduit at once.",
      publicConfig: config.publicConfig,
      secretConfig: config.secretConfig,
    };
  }

  const pool = DEFAULT_RUNES.slice(0, hard ? 8 : easy ? 5 : 6);
  const baseLength = easy ? 2 : 3;
  const maxLevel = easy ? 4 : insane ? 7 : hard ? 6 : 5;
  const totalLength = baseLength + maxLevel - 1;
  return {
    title: "Echoes of the First Rune",
    description: "The glyphs burn in a sequence, then vanish. Remember what the stone showed you.",
    difficultyLabel: difficulty,
    moveLimit: null,
    attemptLimit: insane ? 1 : hard ? 2 : 3,
    timeLimitSeconds: null,
    failureMessage: "The final echo fades. The pattern refuses to reveal itself again.",
    publicConfig: {
      runes: pool,
      base_length: baseLength,
      max_level: maxLevel,
      flash_ms: insane ? 440 : hard ? 520 : 650,
      reveal_limit: maxLevel + (easy ? 3 : insane ? 0 : hard ? 1 : 2),
      reset_on_miss: hard,
    },
    secretConfig: {
      sequence: randomRuneSequence(pool, totalLength),
    },
  };
}
