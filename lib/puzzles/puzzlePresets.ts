import {
  circuitReachesTargets,
  findCircuitRotation,
  rotateCircuitMask,
} from "./arcaneCircuit";
import { applyPuzzleAtmosphere } from "./puzzleAtmosphere";
import { BAROVIA_RUNE_IDS } from "./campaignRunes";
import type { JsonRecord, PuzzlePreset, PuzzleType, PuzzleTheme } from "./puzzleTypes";
import { NATTAU_RUNE_IDS } from "./nattauRunes";
import {
  buildVerifiedSlidingVariant,
  makeVariantId,
} from "./puzzleVariants";
import {
  selectSigilMaterial,
  selectSigilVariant,
  type SigilMaterialMode,
} from "./shatteredSigil";

export const DEFAULT_RUNES = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ"];

export type PuzzlePresetOptions = {
  sigilMaterial?: SigilMaterialMode;
  theme?: PuzzleTheme;
};

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomRuneSequence(pool: string[], length: number, allowRepeats = true) {
  if (!allowRepeats) return shuffle(pool).slice(0, length);
  return Array.from({ length }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function freshPublicVariantId(prefix: string, difficulty: string, publicParts: Array<string | number | boolean>) {
  return makeVariantId(prefix, [
    difficulty,
    ...publicParts,
    Date.now(),
    Math.random(),
  ]);
}

function buildSigilConfig(
  difficulty: string,
  materialMode: SigilMaterialMode = "auto",
) {
  const normalized = difficulty.toLowerCase();
  const size = normalized === "hard" || normalized === "insane" ? 4 : 3;
  const scrambleSteps =
    normalized === "easy" ? 8 : normalized === "medium" ? 14 : normalized === "hard" ? 22 : 30;
  const targetOrder = Array.from({ length: size * size }, (_, index) => String(index));
  const initialOrder = [...targetOrder];
  let previousPair = "";

  // The board is scrambled exclusively through legal adjacent swaps starting
  // from the solved image. Reversing those swaps is therefore always a valid
  // solution, regardless of the ritual artwork or material that was selected.
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

  const material = selectSigilMaterial(materialMode);
  const motif = selectSigilVariant(material);
  const artRotation = Math.floor(Math.random() * 8) * 45;
  const artMirror = Math.random() < 0.5;
  const variantId = makeVariantId("sigil", [
    size,
    material,
    motif,
    artRotation,
    artMirror,
    ...initialOrder,
    Date.now(),
    Math.random(),
  ]);

  const referenceMode =
    normalized === "easy" ? "open" : normalized === "insane" ? "none" : "hold";

  return {
    publicConfig: {
      size,
      initial_order: initialOrder,
      target_hint: "Restore the fragments until they form one continuous ritual image.",
      scramble_steps: scrambleSteps,
      variant_id: variantId,
      material,
      material_mode: materialMode,
      art_variant: motif,
      art_rotation: artRotation,
      art_mirror: artMirror,
      tear_seed: variantId,
      reference_mode: referenceMode,
      assist_correct: normalized === "easy",
      generation_rule: "verified-ritual-image-by-reversible-adjacent-scramble",
    } satisfies JsonRecord,
    secretConfig: {
      target_order: targetOrder,
    } satisfies JsonRecord,
    scrambleSteps,
  };
}

function buildCircuitConfig(difficulty: string) {
  const normalized = difficulty.toLowerCase();
  const hard = normalized === "hard" || normalized === "insane";
  const size = hard ? 5 : 4;
  const total = size * size;
  const indexOf = (row: number, col: number) => row * size + col;
  const coords = (index: number) => [Math.floor(index / size), index % size] as const;
  const neighbors = (index: number) => {
    const [row, col] = coords(index);
    const result: number[] = [];
    if (row > 0) result.push(indexOf(row - 1, col));
    if (col < size - 1) result.push(indexOf(row, col + 1));
    if (row < size - 1) result.push(indexOf(row + 1, col));
    if (col > 0) result.push(indexOf(row, col - 1));
    return result;
  };
  const directionMask = (from: number, to: number) => {
    const [fromRow, fromCol] = coords(from);
    const [toRow, toCol] = coords(to);
    if (toRow < fromRow) return 1;
    if (toCol > fromCol) return 2;
    if (toRow > fromRow) return 4;
    return 8;
  };
  const connect = (a: number, b: number, solvedMasks: number[]) => {
    solvedMasks[a] |= directionMask(a, b);
    solvedMasks[b] |= directionMask(b, a);
  };

  // Build a connected *subset* of the board rather than a Hamiltonian path.
  // The solution always contains a four-way hub and at least one T junction;
  // unused cells become believable decoys and are allowed to remain dark.
  const interior = Array.from({ length: total }, (_, index) => index).filter((index) => {
    const [row, col] = coords(index);
    return row > 0 && col > 0 && row < size - 1 && col < size - 1;
  });
  const hub = interior[Math.floor(Math.random() * interior.length)];
  const [hubRow, hubCol] = coords(hub);
  const north = indexOf(hubRow - 1, hubCol);
  const east = indexOf(hubRow, hubCol + 1);
  const south = indexOf(hubRow + 1, hubCol);
  const west = indexOf(hubRow, hubCol - 1);
  const tLeft = indexOf(hubRow - 1, hubCol - 1);
  const tRight = indexOf(hubRow - 1, hubCol + 1);

  const solvedMasks = Array.from({ length: total }, () => 0);
  const required = new Set<number>([hub, north, east, south, west, tLeft, tRight]);
  connect(hub, north, solvedMasks);
  connect(hub, east, solvedMasks);
  connect(hub, south, solvedMasks);
  connect(hub, west, solvedMasks);
  connect(north, tLeft, solvedMasks);
  connect(north, tRight, solvedMasks);

  const desiredRequired =
    normalized === "easy"
      ? Math.max(9, Math.round(total * 0.58))
      : normalized === "medium"
        ? Math.max(10, Math.round(total * 0.65))
        : normalized === "hard"
          ? Math.round(total * 0.68)
          : Math.round(total * 0.72);

  while (required.size < Math.min(total - 3, desiredRequired)) {
    const frontier = [...required].flatMap((from) =>
      neighbors(from)
        .filter((to) => !required.has(to))
        .map((to) => ({ from, to })),
    );
    if (frontier.length === 0) break;
    const edge = frontier[Math.floor(Math.random() * frontier.length)];
    required.add(edge.to);
    connect(edge.from, edge.to, solvedMasks);
  }

  const degree = (mask: number) =>
    [1, 2, 4, 8].reduce((count, bit) => count + (mask & bit ? 1 : 0), 0);
  const leaves = [...required].filter((index) => degree(solvedMasks[index]) === 1);
  const sourceIndex = leaves[Math.floor(Math.random() * leaves.length)] ?? hub;
  const targetCount =
    normalized === "easy" ? 1 : normalized === "medium" ? 2 : normalized === "hard" ? 3 : 4;
  const targetIndices = shuffle(leaves.filter((index) => index !== sourceIndex))
    .slice(0, Math.min(targetCount, Math.max(1, leaves.length - 1)));

  // Spare tiles intentionally look useful. Some are crosses/Ts, some are bends
  // and straights. They are not part of the canonical solution and do not need
  // to be powered for the puzzle to succeed.
  const decoyShapes = [1, 3, 5, 7, 9, 11, 13, 14, 15];
  const canonicalMasks = solvedMasks.map((mask, index) =>
    required.has(index)
      ? mask
      : decoyShapes[Math.floor(Math.random() * decoyShapes.length)],
  );

  const baseRotations = canonicalMasks.map(() => Math.floor(Math.random() * 4));
  const publicMasks = canonicalMasks.map((mask, index) =>
    rotateCircuitMask(mask, baseRotations[index]),
  );
  const solutionRotations = publicMasks.map((mask, index) =>
    findCircuitRotation(mask, canonicalMasks[index]),
  );

  // Crosses are rotationally symmetric, so making the central cross clickable
  // would only burn moves without changing the board.
  const lockedIndices = [...new Set([sourceIndex, ...targetIndices, hub])];
  const lockedSet = new Set(lockedIndices);
  let initialRotations = publicMasks.map((_, index) =>
    lockedSet.has(index)
      ? solutionRotations[index]
      : Math.floor(Math.random() * 4),
  );

  for (
    let attempt = 0;
    attempt < 40 &&
    circuitReachesTargets(publicMasks, initialRotations, size, sourceIndex, targetIndices);
    attempt += 1
  ) {
    initialRotations = initialRotations.map((rotation, index) =>
      lockedSet.has(index) ? rotation : Math.floor(Math.random() * 4),
    );
  }

  // Extremely unlikely fallback: deliberately misorient a required,
  // non-symmetric conduit if the random board accidentally starts solved.
  if (circuitReachesTargets(publicMasks, initialRotations, size, sourceIndex, targetIndices)) {
    const adjustableRequired = [...required].find(
      (index) =>
        !lockedSet.has(index) &&
        rotateCircuitMask(publicMasks[index], initialRotations[index] + 1) !==
          rotateCircuitMask(publicMasks[index], initialRotations[index]),
    );
    if (adjustableRequired != null) {
      initialRotations[adjustableRequired] = (initialRotations[adjustableRequired] + 1) % 4;
    }
  }

  const canonicalClockwiseDistance = [...required].reduce((sum, index) => {
    if (lockedSet.has(index)) return sum;
    const mask = publicMasks[index];
    for (let steps = 0; steps < 4; steps += 1) {
      if (
        rotateCircuitMask(mask, initialRotations[index] + steps) === canonicalMasks[index]
      ) {
        return sum + steps;
      }
    }
    return sum;
  }, 0);

  const variantId = freshPublicVariantId("circuit-tree", difficulty, [
    size,
    hub,
    sourceIndex,
    ...targetIndices,
    ...canonicalMasks,
  ]);

  return {
    publicConfig: {
      width: size,
      height: size,
      masks: publicMasks,
      initial_rotations: initialRotations,
      source_index: sourceIndex,
      target_indices: targetIndices,
      locked_indices: lockedIndices,
      variant_id: variantId,
      required_tile_count: required.size,
      decoy_tile_count: total - required.size,
      generation_rule: "branched-required-network-with-optional-decoys",
      legend:
        "Power every anchored destination. Dark spare conduits may be decoys; the whole board does not need to light up.",
    } satisfies JsonRecord,
    secretConfig: {
      target_masks: canonicalMasks,
      solution_rotations: solutionRotations,
      required_indices: [...required],
      hub_index: hub,
    } satisfies JsonRecord,
    scrambleMoves: canonicalClockwiseDistance,
  };
}

function buildMechanicalPreset(
  type: PuzzleType,
  difficulty = "Medium",
  options: PuzzlePresetOptions = {},
): PuzzlePreset {
  const normalized = difficulty.toLowerCase();
  const insane = normalized === "insane";
  const hard = normalized === "hard" || insane;
  const easy = normalized === "easy";

  if (type === "rune_cipher") {
    const codeLength = easy ? 3 : insane ? 6 : hard ? 5 : 4;
    const poolSize = hard ? 8 : easy ? 5 : 6;
    const pool = shuffle(options.theme === "barovia" ? BAROVIA_RUNE_IDS : NATTAU_RUNE_IDS).slice(0, poolSize);
    const allowRepeats = hard ? true : Math.random() < 0.5;
    const solution = randomRuneSequence(pool, codeLength, allowRepeats);
    return {
      title: "Seal of the Forgotten Tongue",
      description: "An old Nattau seal answers only to the lost island glyphs spoken in the proper order.",
      difficultyLabel: difficulty,
      moveLimit: null,
      attemptLimit: easy ? 8 : insane ? 5 : hard ? 6 : 7,
      timeLimitSeconds: null,
      failureMessage: "The runes flare crimson and the seal becomes deathly still.",
      publicConfig: {
        runes: pool,
        code_length: codeLength,
        allow_repeats: allowRepeats,
        variant_id: freshPublicVariantId("tongue", difficulty, [...pool, allowRepeats, codeLength]),
        generation_rule: "direct-secret-code",
      },
      secretConfig: {
        solution,
      },
    };
  }

  if (type === "sliding_lock") {
    const config = buildVerifiedSlidingVariant(difficulty);
    const allowance = easy ? 3 : insane ? 0 : hard ? 1 : 2;
    return {
      title: "The Koru Gate",
      description: "Carved Nattau wards bind an old ceremonial gate. Slide the greenstone Koru Seal through the interlocking carvings and carry it to the open edge.",
      difficultyLabel: difficulty,
      moveLimit: config.minimumMoves + allowance,
      attemptLimit: null,
      timeLimitSeconds: null,
      failureMessage: "The carved wards slam into place and the Koru Gate falls silent.",
      publicConfig: config.publicConfig,
      secretConfig: {
        solution_moves: config.solutionMoves,
      },
    };
  }

  if (type === "shattered_sigil") {
    const config = buildSigilConfig(difficulty, options.sigilMaterial ?? "auto");
    return {
      title: "Shattered Sigil",
      description: "A ritual image has been broken into misplaced fragments. Restore the artifact until every carved or inked line becomes whole again.",
      difficultyLabel: difficulty,
      moveLimit: config.scrambleSteps + (easy ? 6 : insane ? 4 : hard ? 6 : 8),
      attemptLimit: null,
      timeLimitSeconds: null,
      failureMessage: "The fragments settle into a false pattern and the ritual goes silent.",
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

  const poolSize = hard ? 8 : easy ? 5 : 6;
  const pool = shuffle(options.theme === "barovia" ? BAROVIA_RUNE_IDS : NATTAU_RUNE_IDS).slice(0, poolSize);
  const baseLength = easy ? 2 : 3;
  const maxLevel = easy ? 4 : insane ? 7 : hard ? 6 : 5;
  const totalLength = baseLength + maxLevel - 1;
  const sequence = randomRuneSequence(pool, totalLength, true);
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
      variant_id: freshPublicVariantId("echo", difficulty, [...pool, baseLength, maxLevel]),
      generation_rule: "direct-memory-sequence",
    },
    secretConfig: {
      sequence,
    },
  };
}

export function buildPuzzlePreset(type: PuzzleType, difficulty = "Medium", options: PuzzlePresetOptions = {}): PuzzlePreset {
  return applyPuzzleAtmosphere(buildMechanicalPreset(type, difficulty, options), type, options.theme ?? "nattau");
}
