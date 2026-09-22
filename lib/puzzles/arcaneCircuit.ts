export type CircuitFlow = {
  rotatedMasks: number[];
  poweredIndices: Set<number>;
  energizedMasks: number[];
  distances: number[];
};

export type CircuitValidation = CircuitFlow & {
  targetsPowered: boolean;
  leakCount: number;
  poweredEdgeCount: number;
  hasCycle: boolean;
  solved: boolean;
};

const DIRECTIONS = [
  { bit: 1, opposite: 4, row: -1, col: 0 },
  { bit: 2, opposite: 8, row: 0, col: 1 },
  { bit: 4, opposite: 1, row: 1, col: 0 },
  { bit: 8, opposite: 2, row: 0, col: -1 },
] as const;

export function rotateCircuitMask(mask: number, rotation: number) {
  let value = mask;
  const steps = ((rotation % 4) + 4) % 4;

  for (let index = 0; index < steps; index += 1) {
    const n = value & 1;
    const e = value & 2;
    const s = value & 4;
    const w = value & 8;
    value =
      (n ? 2 : 0) |
      (e ? 4 : 0) |
      (s ? 8 : 0) |
      (w ? 1 : 0);
  }

  return value;
}

export function findCircuitRotation(baseMask: number, targetMask: number) {
  for (let rotation = 0; rotation < 4; rotation += 1) {
    if (rotateCircuitMask(baseMask, rotation) === targetMask) {
      return rotation;
    }
  }

  return 0;
}

export function getCircuitFlow(
  masks: number[],
  rotations: number[],
  width: number,
  sourceIndex: number,
): CircuitFlow {
  const rotatedMasks = masks.map((mask, index) =>
    rotateCircuitMask(mask, rotations[index] ?? 0),
  );
  const poweredIndices = new Set<number>();
  const energizedMasks = Array.from({ length: masks.length }, () => 0);
  const distances = Array.from({ length: masks.length }, () => -1);

  if (
    masks.length === 0 ||
    width < 1 ||
    sourceIndex < 0 ||
    sourceIndex >= masks.length
  ) {
    return { rotatedMasks, poweredIndices, energizedMasks, distances };
  }

  const queue: number[] = [sourceIndex];
  poweredIndices.add(sourceIndex);
  distances[sourceIndex] = 0;

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    const currentMask = rotatedMasks[current] ?? 0;
    const row = Math.floor(current / width);
    const col = current % width;

    for (const direction of DIRECTIONS) {
      if ((currentMask & direction.bit) === 0) {
        continue;
      }

      const nextRow = row + direction.row;
      const nextCol = col + direction.col;
      if (nextRow < 0 || nextCol < 0 || nextCol >= width) {
        continue;
      }

      const next = nextRow * width + nextCol;
      if (next < 0 || next >= masks.length) {
        continue;
      }

      const neighborMask = rotatedMasks[next] ?? 0;
      if ((neighborMask & direction.opposite) === 0) {
        continue;
      }

      energizedMasks[current] |= direction.bit;
      energizedMasks[next] |= direction.opposite;

      if (!poweredIndices.has(next)) {
        poweredIndices.add(next);
        distances[next] = distances[current] + 1;
        queue.push(next);
      }
    }
  }

  return { rotatedMasks, poweredIndices, energizedMasks, distances };
}

export function analyzeCircuit(
  masks: number[],
  rotations: number[],
  width: number,
  sourceIndex: number,
  targetIndices: number[],
): CircuitValidation {
  const flow = getCircuitFlow(masks, rotations, width, sourceIndex);
  const targetsPowered =
    targetIndices.length > 0 &&
    targetIndices.every((index) => flow.poweredIndices.has(index));

  let leakCount = 0;
  let poweredEdgeCount = 0;
  const height = width > 0 ? Math.ceil(masks.length / width) : 0;

  for (const current of flow.poweredIndices) {
    const currentMask = flow.rotatedMasks[current] ?? 0;
    const row = Math.floor(current / width);
    const col = current % width;

    for (const direction of DIRECTIONS) {
      if ((currentMask & direction.bit) === 0) continue;

      const nextRow = row + direction.row;
      const nextCol = col + direction.col;
      const outside =
        nextRow < 0 ||
        nextCol < 0 ||
        nextRow >= height ||
        nextCol >= width;

      if (outside) {
        leakCount += 1;
        continue;
      }

      const next = nextRow * width + nextCol;
      if (next < 0 || next >= masks.length) {
        leakCount += 1;
        continue;
      }

      const neighborMask = flow.rotatedMasks[next] ?? 0;
      if ((neighborMask & direction.opposite) === 0) {
        leakCount += 1;
        continue;
      }

      if (current < next && flow.poweredIndices.has(next)) {
        poweredEdgeCount += 1;
      }
    }
  }

  // The source-powered region is connected by construction. For a connected
  // undirected graph, E >= V means that at least one closed cycle exists.
  const hasCycle =
    flow.poweredIndices.size > 0 &&
    poweredEdgeCount >= flow.poweredIndices.size;

  return {
    ...flow,
    targetsPowered,
    leakCount,
    poweredEdgeCount,
    hasCycle,
    solved: targetsPowered && leakCount === 0 && !hasCycle,
  };
}

export function circuitReachesTargets(
  masks: number[],
  rotations: number[],
  width: number,
  sourceIndex: number,
  targetIndices: number[],
) {
  if (targetIndices.length === 0) {
    return false;
  }

  const flow = getCircuitFlow(masks, rotations, width, sourceIndex);
  return targetIndices.every((index) => flow.poweredIndices.has(index));
}

export function circuitIsSolved(
  masks: number[],
  rotations: number[],
  width: number,
  sourceIndex: number,
  targetIndices: number[],
) {
  return analyzeCircuit(
    masks,
    rotations,
    width,
    sourceIndex,
    targetIndices,
  ).solved;
}
