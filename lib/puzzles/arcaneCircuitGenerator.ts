import {
  circuitIsSolved,
  findCircuitRotation,
  rotateCircuitMask,
} from "./arcaneCircuit";
import { makeVariantId } from "./puzzleVariants";
import type { JsonRecord } from "./puzzleTypes";

const DIRECTIONS = [
  { bit: 1, row: -1, col: 0 },
  { bit: 2, row: 0, col: 1 },
  { bit: 4, row: 1, col: 0 },
  { bit: 8, row: 0, col: -1 },
] as const;

type Edge = [number, number];
type DirectionBit = 1 | 2 | 4 | 8;

type CircuitDifficulty = {
  size: number;
  terminalCount: number;
  minRequired: number;
  maxRequired: number;
  minBranches: number;
  requireCross: boolean;
};

export type GeneratedArcaneCircuit = {
  publicConfig: JsonRecord;
  secretConfig: JsonRecord;
  scrambleMoves: number;
};

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function configForDifficulty(difficulty: string): CircuitDifficulty {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return {
        size: 4,
        terminalCount: 3,
        minRequired: 8,
        maxRequired: 13,
        minBranches: 1,
        requireCross: false,
      };
    case "hard":
      return {
        size: 6,
        terminalCount: 5,
        minRequired: 19,
        maxRequired: 28,
        minBranches: 3,
        requireCross: true,
      };
    case "insane":
      return {
        size: 6,
        terminalCount: 6,
        minRequired: 21,
        maxRequired: 30,
        minBranches: 4,
        requireCross: true,
      };
    default:
      return {
        size: 5,
        terminalCount: 4,
        minRequired: 13,
        maxRequired: 20,
        minBranches: 2,
        requireCross: false,
      };
  }
}

function indexOf(row: number, col: number, size: number) {
  return row * size + col;
}

function coords(index: number, size: number) {
  return [Math.floor(index / size), index % size] as const;
}

function neighborEntries(index: number, size: number) {
  const [row, col] = coords(index, size);
  return DIRECTIONS.flatMap((direction) => {
    const nextRow = row + direction.row;
    const nextCol = col + direction.col;
    if (
      nextRow < 0 ||
      nextCol < 0 ||
      nextRow >= size ||
      nextCol >= size
    ) {
      return [];
    }

    return [{
      index: indexOf(nextRow, nextCol, size),
      bit: direction.bit,
    }];
  });
}

function directionBit(from: number, to: number, size: number) {
  const [fromRow, fromCol] = coords(from, size);
  const [toRow, toCol] = coords(to, size);
  if (toRow < fromRow) return 1;
  if (toCol > fromCol) return 2;
  if (toRow > fromRow) return 4;
  return 8;
}

function edgeKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function buildRandomSpanningTree(size: number) {
  const total = size * size;
  const adjacency = Array.from({ length: total }, () => new Set<number>());
  const start = Math.floor(Math.random() * total);
  const visited = new Set<number>([start]);
  const frontier: Edge[] = neighborEntries(start, size).map(({ index }) => [
    start,
    index,
  ]);

  while (visited.size < total) {
    if (frontier.length === 0) {
      throw new Error("Arcane Circuit spanning-tree frontier unexpectedly emptied.");
    }

    const frontierIndex = Math.floor(Math.random() * frontier.length);
    const [from, to] = frontier.splice(frontierIndex, 1)[0];
    if (visited.has(to)) continue;

    visited.add(to);
    adjacency[from].add(to);
    adjacency[to].add(from);

    for (const { index: next } of neighborEntries(to, size)) {
      if (!visited.has(next)) frontier.push([to, next]);
    }
  }

  return adjacency;
}

function treeDistances(adjacency: Array<Set<number>>, start: number) {
  const distances = Array.from({ length: adjacency.length }, () => -1);
  const queue = [start];
  distances[start] = 0;

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const next of adjacency[current]) {
      if (distances[next] >= 0) continue;
      distances[next] = distances[current] + 1;
      queue.push(next);
    }
  }

  return distances;
}

function selectSpreadTerminals(
  adjacency: Array<Set<number>>,
  terminalCount: number,
) {
  const leaves = adjacency
    .map((neighbors, index) => ({ index, degree: neighbors.size }))
    .filter(({ degree }) => degree === 1)
    .map(({ index }) => index);

  if (leaves.length < terminalCount) return null;

  const selected = [leaves[Math.floor(Math.random() * leaves.length)]];

  while (selected.length < terminalCount) {
    const distanceMaps = selected.map((terminal) =>
      treeDistances(adjacency, terminal),
    );

    const candidates = leaves
      .filter((leaf) => !selected.includes(leaf))
      .map((leaf) => ({
        leaf,
        minDistance: Math.min(
          ...distanceMaps.map((distances) => distances[leaf]),
        ),
        noise: Math.random(),
      }))
      .sort(
        (a, b) =>
          b.minDistance - a.minDistance ||
          b.noise - a.noise,
      );

    // Keeping a little randomness among equally good remote leaves avoids
    // producing the same visual skeleton over and over.
    if (candidates.length === 0) return null;
    const bestDistance = candidates[0].minDistance;
    const remotePool = candidates
      .filter((candidate) => candidate.minDistance >= bestDistance - 1)
      .slice(0, 4);

    if (remotePool.length === 0) return null;
    const chosen = remotePool[Math.floor(Math.random() * remotePool.length)];
    selected.push(chosen.leaf);
  }

  return selected;
}

function requiredSubtree(
  adjacency: Array<Set<number>>,
  terminals: number[],
) {
  const source = terminals[0];
  const parent = Array.from({ length: adjacency.length }, () => -1);
  const queue = [source];
  parent[source] = source;

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const next of adjacency[current]) {
      if (parent[next] !== -1) continue;
      parent[next] = current;
      queue.push(next);
    }
  }

  const required = new Set<number>([source]);
  const edges = new Map<string, Edge>();

  for (const terminal of terminals.slice(1)) {
    let current = terminal;
    while (current !== source) {
      const previous = parent[current];
      if (previous < 0) {
        throw new Error("Arcane Circuit terminal is disconnected from its tree.");
      }
      required.add(current);
      required.add(previous);
      edges.set(edgeKey(current, previous), [current, previous]);
      current = previous;
    }
  }

  const degrees = new Map<number, number>();
  for (const [a, b] of edges.values()) {
    degrees.set(a, (degrees.get(a) ?? 0) + 1);
    degrees.set(b, (degrees.get(b) ?? 0) + 1);
  }

  return {
    required,
    edges: [...edges.values()],
    degrees,
  };
}

function maskFromEdges(
  index: number,
  edges: Edge[],
  size: number,
) {
  let mask = 0;
  for (const [a, b] of edges) {
    if (a === index) mask |= directionBit(a, b, size);
    else if (b === index) mask |= directionBit(b, a, size);
  }
  return mask;
}

function bitCount(mask: number) {
  return [1, 2, 4, 8].reduce(
    (count, bit) => count + (mask & bit ? 1 : 0),
    0,
  );
}

function chooseDecoyMask(index: number, size: number) {
  const availableBits = neighborEntries(index, size).map(({ bit }) => bit);
  const maxDegree = availableBits.length;

  // Every spare conduit must be capable of transmitting current. A one-port
  // tile outside SOURCE/TARGET is visually self-incriminating, so v3 never
  // generates one. We also never give a decoy more ports than the cell has
  // physical neighbours; in its reference orientation it is locally viable.
  const degree =
    maxDegree === 2
      ? 2
      : maxDegree === 3
        ? Math.random() < 0.74 ? 2 : 3
        : Math.random() < 0.58 ? 2 : Math.random() < 0.82 ? 3 : 4;

  let choices: number[] = shuffle(availableBits).slice(0, degree);

  if (degree === 2 && maxDegree === 4) {
    const oppositePairs = [[1, 4], [2, 8]];
    const preferCorner = Math.random() < 0.68;
    if (!preferCorner) {
      choices = [...oppositePairs[Math.floor(Math.random() * oppositePairs.length)]];
    } else {
      const cornerPairs = [[1, 2], [2, 4], [4, 8], [8, 1]];
      choices = [...cornerPairs[Math.floor(Math.random() * cornerPairs.length)]];
    }
  }

  return choices.reduce((mask, bit) => mask | bit, 0);
}

function buildCandidate(difficulty: string) {
  const cfg = configForDifficulty(difficulty);
  const total = cfg.size * cfg.size;
  const tree = buildRandomSpanningTree(cfg.size);
  const terminals = selectSpreadTerminals(tree, cfg.terminalCount);
  if (!terminals) return null;

  const [sourceIndex, ...targetIndices] = terminals;
  const subtree = requiredSubtree(tree, terminals);
  const branchCount = [...subtree.degrees.values()].filter(
    (degree) => degree >= 3,
  ).length;
  const crossCount = [...subtree.degrees.values()].filter(
    (degree) => degree === 4,
  ).length;

  if (
    subtree.required.size < cfg.minRequired ||
    subtree.required.size > cfg.maxRequired ||
    branchCount < cfg.minBranches ||
    (cfg.requireCross && crossCount === 0) ||
    total - subtree.required.size < 3
  ) {
    return null;
  }

  const terminalSet = new Set(terminals);
  for (const [index, degree] of subtree.degrees) {
    // This is the core invariant missing from v2: the only leaves in the
    // active solution are labelled terminals. Every ordinary live conduit
    // therefore carries current onward through at least two sides.
    if (degree === 1 && !terminalSet.has(index)) return null;
  }

  const canonicalMasks = Array.from({ length: total }, (_, index) =>
    subtree.required.has(index)
      ? maskFromEdges(index, subtree.edges, cfg.size)
      : chooseDecoyMask(index, cfg.size),
  );

  if (
    canonicalMasks.some(
      (mask, index) =>
        !terminalSet.has(index) && bitCount(mask) < 2,
    )
  ) {
    return null;
  }

  const baseRotations = canonicalMasks.map(() =>
    Math.floor(Math.random() * 4),
  );
  const publicMasks = canonicalMasks.map((mask, index) =>
    rotateCircuitMask(mask, baseRotations[index]),
  );
  const solutionRotations = publicMasks.map((mask, index) =>
    findCircuitRotation(mask, canonicalMasks[index]),
  );

  const symmetricIndices = canonicalMasks
    .map((mask, index) => ({ mask, index }))
    .filter(({ mask }) => mask === 15)
    .map(({ index }) => index);
  const lockedIndices = [
    ...new Set([sourceIndex, ...targetIndices, ...symmetricIndices]),
  ];
  const locked = new Set(lockedIndices);

  let initialRotations = publicMasks.map((_, index) =>
    locked.has(index)
      ? solutionRotations[index]
      : Math.floor(Math.random() * 4),
  );

  for (
    let attempt = 0;
    attempt < 80 &&
    circuitIsSolved(
      publicMasks,
      initialRotations,
      cfg.size,
      sourceIndex,
      targetIndices,
    );
    attempt += 1
  ) {
    initialRotations = publicMasks.map((_, index) =>
      locked.has(index)
        ? solutionRotations[index]
        : Math.floor(Math.random() * 4),
    );
  }

  if (
    circuitIsSolved(
      publicMasks,
      initialRotations,
      cfg.size,
      sourceIndex,
      targetIndices,
    )
  ) {
    return null;
  }

  const canonicalClockwiseDistance = [...subtree.required].reduce(
    (sum, index) => {
      if (locked.has(index)) return sum;
      const mask = publicMasks[index];
      for (let steps = 0; steps < 4; steps += 1) {
        if (
          rotateCircuitMask(mask, initialRotations[index] + steps) ===
          canonicalMasks[index]
        ) {
          return sum + steps;
        }
      }
      return sum;
    },
    0,
  );

  const variantId = makeVariantId("circuit-v3", [
    difficulty,
    cfg.size,
    sourceIndex,
    ...targetIndices,
    ...canonicalMasks,
    Date.now(),
    Math.random(),
  ]);

  return {
    publicConfig: {
      width: cfg.size,
      height: cfg.size,
      masks: publicMasks,
      initial_rotations: initialRotations,
      source_index: sourceIndex,
      target_indices: targetIndices,
      locked_indices: lockedIndices,
      variant_id: variantId,
      required_tile_count: subtree.required.size,
      decoy_tile_count: total - subtree.required.size,
      branch_count: branchCount,
      cross_count: crossCount,
      terminal_count: terminals.length,
      generation_rule:
        "terminal-pruned-spanning-tree-with-locally-plausible-multiport-decoys",
      legend:
        "Power every target with one stable circuit. The live circuit may not leak or close into a feedback loop. Dark spare conduits can be ignored.",
    } satisfies JsonRecord,
    secretConfig: {
      target_masks: canonicalMasks,
      solution_rotations: solutionRotations,
      required_indices: [...subtree.required],
      terminal_indices: terminals,
    } satisfies JsonRecord,
    scrambleMoves: canonicalClockwiseDistance,
  } satisfies GeneratedArcaneCircuit;
}

export function buildArcaneCircuitConfig(
  difficulty: string,
): GeneratedArcaneCircuit {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const candidate = buildCandidate(difficulty);
    if (candidate) return candidate;
  }

  throw new Error(
    `Unable to generate a structurally valid Arcane Circuit (${difficulty}).`,
  );
}
