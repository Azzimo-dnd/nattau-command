import type { JsonRecord } from "./puzzleTypes";

export type SlidingBlock = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  axis: "h" | "v";
  target?: boolean;
  label?: string;
};

type SlidingVariant = {
  id: string;
  minimumMoves: number;
  positions: Array<[string, number, number]>;
};

const WIDTH = 6;
const HEIGHT = 6;
const EXIT_ROW = 2;

const SLIDING_SHAPES: SlidingBlock[] = [
  { id: "A", x: 4, y: 2, w: 2, h: 1, axis: "h", target: true, label: "Koru Seal" },
  { id: "B", x: 2, y: 1, w: 1, h: 2, axis: "v", label: "Awa Ward" },
  { id: "C", x: 3, y: 0, w: 2, h: 1, axis: "h", label: "Matau Ward" },
  { id: "D", x: 5, y: 0, w: 1, h: 2, axis: "v", label: "Tara Ward" },
  { id: "E", x: 0, y: 3, w: 2, h: 1, axis: "h", label: "Whetu Ward" },
  { id: "F", x: 3, y: 3, w: 1, h: 3, axis: "v", label: "Ahi Ward" },
  { id: "G", x: 4, y: 4, w: 2, h: 1, axis: "h", label: "Niho Ward" },
  { id: "H", x: 0, y: 5, w: 3, h: 1, axis: "h", label: "Rangi Ward" },
];

// These layouts were produced by legal reverse play from a solved board and
// independently verified against the exact game rule: moving one ward any legal
// distance along its axis costs one move. We verify the chosen variant again at
// runtime, so a future accidental edit cannot silently ship an impossible lock.
const SLIDING_VARIANTS: Record<"easy" | "medium" | "hard", SlidingVariant[]> = {
  easy: [
    { id: "koru-e01", minimumMoves: 3, positions: [["A",0,2],["B",2,0],["C",4,0],["D",5,1],["E",0,3],["F",3,3],["G",4,4],["H",0,5]] },
    { id: "koru-e02", minimumMoves: 2, positions: [["A",3,2],["B",2,1],["C",2,0],["D",5,1],["E",1,3],["F",3,3],["G",4,4],["H",0,5]] },
    { id: "koru-e03", minimumMoves: 3, positions: [["A",1,2],["B",2,3],["C",2,0],["D",5,3],["E",0,3],["F",3,1],["G",0,4],["H",3,5]] },
    { id: "koru-e04", minimumMoves: 2, positions: [["A",0,2],["B",2,1],["C",3,0],["D",5,0],["E",0,3],["F",3,3],["G",4,4],["H",0,5]] },
    { id: "koru-e05", minimumMoves: 3, positions: [["A",1,2],["B",2,0],["C",0,0],["D",5,4],["E",4,3],["F",3,1],["G",3,4],["H",0,5]] },
    { id: "koru-e06", minimumMoves: 3, positions: [["A",0,2],["B",2,1],["C",1,0],["D",5,0],["E",0,3],["F",3,2],["G",4,4],["H",0,5]] },
  ],
  medium: [
    { id: "koru-m01", minimumMoves: 4, positions: [["A",0,2],["B",2,1],["C",4,0],["D",5,4],["E",4,3],["F",3,1],["G",3,4],["H",0,5]] },
    { id: "koru-m02", minimumMoves: 5, positions: [["A",1,2],["B",2,0],["C",4,0],["D",5,1],["E",2,3],["F",3,0],["G",0,4],["H",1,5]] },
    { id: "koru-m03", minimumMoves: 5, positions: [["A",0,2],["B",2,0],["C",4,0],["D",5,2],["E",0,3],["F",3,1],["G",3,4],["H",3,5]] },
    { id: "koru-m04", minimumMoves: 5, positions: [["A",0,2],["B",2,2],["C",0,0],["D",5,1],["E",0,3],["F",3,2],["G",0,4],["H",2,5]] },
    { id: "koru-m05", minimumMoves: 4, positions: [["A",0,2],["B",2,0],["C",0,0],["D",5,2],["E",0,3],["F",3,1],["G",3,4],["H",0,5]] },
    { id: "koru-m06", minimumMoves: 4, positions: [["A",1,2],["B",2,0],["C",0,0],["D",5,2],["E",1,3],["F",3,0],["G",0,4],["H",3,5]] },
    { id: "koru-m07", minimumMoves: 4, positions: [["A",0,2],["B",2,0],["C",3,0],["D",5,1],["E",0,3],["F",3,2],["G",0,4],["H",3,5]] },
  ],
  hard: [
    { id: "koru-h01", minimumMoves: 6, positions: [["A",0,2],["B",2,1],["C",2,0],["D",5,1],["E",0,3],["F",3,1],["G",3,4],["H",3,5]] },
    { id: "koru-h02", minimumMoves: 6, positions: [["A",0,2],["B",2,1],["C",0,0],["D",5,1],["E",0,3],["F",3,0],["G",3,4],["H",2,5]] },
    { id: "koru-h03", minimumMoves: 6, positions: [["A",1,2],["B",2,0],["C",0,0],["D",5,1],["E",2,3],["F",3,0],["G",3,4],["H",2,5]] },
    { id: "koru-h04", minimumMoves: 6, positions: [["A",0,2],["B",2,1],["C",1,0],["D",5,0],["E",3,3],["F",3,0],["G",2,4],["H",2,5]] },
    { id: "koru-h05", minimumMoves: 6, positions: [["A",1,2],["B",2,3],["C",4,0],["D",5,1],["E",0,3],["F",3,1],["G",3,4],["H",3,5]] },
    { id: "koru-h06", minimumMoves: 6, positions: [["A",0,2],["B",2,1],["C",4,0],["D",5,2],["E",0,3],["F",3,1],["G",3,4],["H",2,5]] },
    { id: "koru-h07", minimumMoves: 7, positions: [["A",1,2],["B",2,4],["C",0,0],["D",5,2],["E",2,3],["F",3,0],["G",3,4],["H",3,5]] },
  ],
};

const lastSlidingVariantByBucket = new Map<"easy" | "medium" | "hard", string>();

function overlaps(a: SlidingBlock, b: SlidingBlock) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function canOccupy(block: SlidingBlock, x: number, y: number, blocks: SlidingBlock[]) {
  if (x < 0 || y < 0 || x + block.w > WIDTH || y + block.h > HEIGHT) return false;
  const candidate = { ...block, x, y };
  return !blocks.some((other) => other.id !== block.id && overlaps(candidate, other));
}

function stateKey(blocks: SlidingBlock[]) {
  return blocks.map((block) => `${block.id}:${block.x},${block.y}`).join("|");
}

function isSlidingSolved(blocks: SlidingBlock[]) {
  const target = blocks.find((block) => block.id === "A");
  return Boolean(target && target.y === EXIT_ROW && target.x + target.w === WIDTH);
}

function legalSlidingStates(blocks: SlidingBlock[]) {
  const states: SlidingBlock[][] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const directions: Array<[number, number]> = block.axis === "h"
      ? [[-1, 0], [1, 0]]
      : [[0, -1], [0, 1]];

    for (const [dx, dy] of directions) {
      for (let distance = 1; distance <= Math.max(WIDTH, HEIGHT); distance += 1) {
        const x = block.x + dx * distance;
        const y = block.y + dy * distance;
        if (!canOccupy(block, x, y, blocks)) break;
        const next = blocks.map((item) => ({ ...item }));
        next[index].x = x;
        next[index].y = y;
        states.push(next);
      }
    }
  }
  return states;
}

export function solveSlidingLockMinimumMoves(initial: SlidingBlock[], maxDepth = 10) {
  const queue: Array<{ blocks: SlidingBlock[]; depth: number }> = [{ blocks: initial, depth: 0 }];
  const seen = new Set([stateKey(initial)]);
  let cursor = 0;

  while (cursor < queue.length) {
    const current = queue[cursor++];
    if (isSlidingSolved(current.blocks)) return current.depth;
    if (current.depth >= maxDepth) continue;

    for (const next of legalSlidingStates(current.blocks)) {
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ blocks: next, depth: current.depth + 1 });
    }
  }

  return null;
}

function materializeVariant(variant: SlidingVariant) {
  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, x, y] of variant.positions) {
    positions.set(id, { x, y });
  }

  return SLIDING_SHAPES.map((shape) => {
    const position = positions.get(shape.id);
    if (!position) throw new Error(`Sliding Lock variant ${variant.id} is missing block ${shape.id}.`);
    return { ...shape, ...position };
  });
}

export function buildVerifiedSlidingVariant(difficulty: string) {
  const normalized = difficulty.toLowerCase();
  const bucket: "easy" | "medium" | "hard" = normalized === "easy" ? "easy" : normalized === "medium" ? "medium" : "hard";
  const variants = SLIDING_VARIANTS[bucket];
  const previous = lastSlidingVariantByBucket.get(bucket);
  const candidates = variants.filter((variant) => variant.id !== previous);
  const pool = candidates.length > 0 ? candidates : variants;
  const variant = pool[Math.floor(Math.random() * pool.length)];
  lastSlidingVariantByBucket.set(bucket, variant.id);

  const blocks = materializeVariant(variant);
  const verifiedMinimum = solveSlidingLockMinimumMoves(blocks, 10);

  if (verifiedMinimum !== variant.minimumMoves) {
    throw new Error(
      `Sliding Lock variant ${variant.id} failed verification: expected ${variant.minimumMoves}, solver found ${verifiedMinimum ?? "no solution"}.`,
    );
  }

  return {
    publicConfig: {
      width: WIDTH,
      height: HEIGHT,
      exit_side: "right",
      exit_row: EXIT_ROW,
      target_block_id: "A",
      variant_id: variant.id,
      verified_minimum_moves: verifiedMinimum,
      generation_rule: "preverified-and-runtime-bfs-checked",
      blocks,
    } satisfies JsonRecord,
    minimumMoves: verifiedMinimum,
    variantId: variant.id,
  };
}

function transformPoint(row: number, col: number, size: number, transform: number) {
  let r = row;
  let c = col;
  if (transform >= 4) c = size - 1 - c;
  for (let turn = 0; turn < transform % 4; turn += 1) {
    [r, c] = [c, size - 1 - r];
  }
  return [r, c] as const;
}

function rowSnake(size: number) {
  const path: Array<[number, number]> = [];
  for (let row = 0; row < size; row += 1) {
    const cols = Array.from({ length: size }, (_, index) => index);
    if (row % 2 === 1) cols.reverse();
    cols.forEach((col) => path.push([row, col]));
  }
  return path;
}

function spiral(size: number) {
  const path: Array<[number, number]> = [];
  let top = 0;
  let bottom = size - 1;
  let left = 0;
  let right = size - 1;
  while (top <= bottom && left <= right) {
    for (let col = left; col <= right; col += 1) path.push([top, col]);
    top += 1;
    for (let row = top; row <= bottom; row += 1) path.push([row, right]);
    right -= 1;
    if (top <= bottom) {
      for (let col = right; col >= left; col -= 1) path.push([bottom, col]);
      bottom -= 1;
    }
    if (left <= right) {
      for (let row = bottom; row >= top; row -= 1) path.push([row, left]);
      left += 1;
    }
  }
  return path;
}

export function buildCircuitPathVariant(size: number) {
  const family = Math.random() < 0.5 ? "snake" : "spiral";
  const transform = Math.floor(Math.random() * 8);
  const reversed = Math.random() < 0.5;
  const base = family === "snake" ? rowSnake(size) : spiral(size);
  const transformed = base.map(([row, col]) => transformPoint(row, col, size, transform));
  const ordered = reversed ? [...transformed].reverse() : transformed;
  const path = ordered.map(([row, col]) => row * size + col);
  return {
    path,
    variantId: `circuit-${size}-${family}-t${transform}-${reversed ? "r" : "f"}`,
  };
}

export function makeVariantId(prefix: string, values: Array<string | number | boolean>) {
  let hash = 2166136261;
  const source = values.join("|");
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}
