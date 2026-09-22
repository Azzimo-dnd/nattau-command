import type { JsonRecord } from "./puzzleTypes";
import { makeVariantId } from "./puzzleVariants";

export type AstralNode = {
  id: string;
  x: number;
  y: number;
  required: number;
};

export type AstralEdge = {
  id: string;
  a: string;
  b: string;
  crosses: string[];
};

type Point = { id: string; x: number; y: number };
type SolvedEdge = { id: string; a: string; b: string; count: number };

export type GeneratedAstralWeave = {
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

function configForDifficulty(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return { grid: 6, nodes: 7, extraEdges: 0, minCandidateSurplus: 0, doubleChance: 0.15, allowance: 7 };
    case "hard":
      return { grid: 8, nodes: 11, extraEdges: 2, minCandidateSurplus: 2, doubleChance: 0.36, allowance: 5 };
    case "insane":
      return { grid: 9, nodes: 13, extraEdges: 3, minCandidateSurplus: 3, doubleChance: 0.46, allowance: 4 };
    default:
      return { grid: 7, nodes: 9, extraEdges: 1, minCandidateSurplus: 1, doubleChance: 0.25, allowance: 6 };
  }
}

function edgeId(a: string, b: string) {
  return a < b ? `${a}--${b}` : `${b}--${a}`;
}

function generatePoints(grid: number, count: number): Point[] | null {
  const occupied = new Set<string>();
  const points: Point[] = [];

  const add = (x: number, y: number) => {
    const key = `${x}:${y}`;
    if (occupied.has(key)) return false;
    occupied.add(key);
    points.push({ id: `s${points.length + 1}`, x, y });
    return true;
  };

  add(
    1 + Math.floor(Math.random() * Math.max(1, grid - 2)),
    1 + Math.floor(Math.random() * Math.max(1, grid - 2)),
  );

  for (let index = 1; index < count; index += 1) {
    let placed = false;
    for (let attempt = 0; attempt < 80 && !placed; attempt += 1) {
      const anchor = points[Math.floor(Math.random() * points.length)];
      const horizontal = Math.random() < 0.5;
      const x = horizontal
        ? Math.floor(Math.random() * grid)
        : anchor.x;
      const y = horizontal
        ? anchor.y
        : Math.floor(Math.random() * grid);
      if (x === anchor.x && y === anchor.y) continue;
      placed = add(x, y);
    }
    if (!placed) return null;
  }

  if (
    new Set(points.map((point) => point.x)).size < 3 ||
    new Set(points.map((point) => point.y)).size < 3
  ) {
    return null;
  }

  return points;
}

function candidateEdges(points: Point[]) {
  const byId = new Map(points.map((point) => [point.id, point]));
  const found = new Map<string, { id: string; a: string; b: string }>();

  for (const point of points) {
    const sameRow = points
      .filter((other) => other.id !== point.id && other.y === point.y)
      .sort((a, b) => Math.abs(a.x - point.x) - Math.abs(b.x - point.x));
    const sameCol = points
      .filter((other) => other.id !== point.id && other.x === point.x)
      .sort((a, b) => Math.abs(a.y - point.y) - Math.abs(b.y - point.y));

    const left = sameRow.filter((other) => other.x < point.x)[0];
    const right = sameRow.filter((other) => other.x > point.x)[0];
    const up = sameCol.filter((other) => other.y < point.y)[0];
    const down = sameCol.filter((other) => other.y > point.y)[0];

    for (const other of [left, right, up, down]) {
      if (!other) continue;
      const id = edgeId(point.id, other.id);
      const [a, b] = point.id < other.id
        ? [point.id, other.id]
        : [other.id, point.id];
      found.set(id, { id, a, b });
    }
  }

  return [...found.values()].filter(
    (edge) => byId.has(edge.a) && byId.has(edge.b),
  );
}

function properCross(
  first: { a: string; b: string },
  second: { a: string; b: string },
  pointsById: Map<string, Point>,
) {
  if (
    first.a === second.a ||
    first.a === second.b ||
    first.b === second.a ||
    first.b === second.b
  ) {
    return false;
  }

  const a1 = pointsById.get(first.a);
  const b1 = pointsById.get(first.b);
  const a2 = pointsById.get(second.a);
  const b2 = pointsById.get(second.b);
  if (!a1 || !b1 || !a2 || !b2) return false;

  const firstHorizontal = a1.y === b1.y;
  const secondHorizontal = a2.y === b2.y;
  if (firstHorizontal === secondHorizontal) return false;

  const horizontal = firstHorizontal ? [a1, b1] : [a2, b2];
  const vertical = firstHorizontal ? [a2, b2] : [a1, b1];
  const minX = Math.min(horizontal[0].x, horizontal[1].x);
  const maxX = Math.max(horizontal[0].x, horizontal[1].x);
  const minY = Math.min(vertical[0].y, vertical[1].y);
  const maxY = Math.max(vertical[0].y, vertical[1].y);
  const crossX = vertical[0].x;
  const crossY = horizontal[0].y;

  return (
    crossX > minX &&
    crossX < maxX &&
    crossY > minY &&
    crossY < maxY
  );
}

function withCrossings(
  points: Point[],
  edges: Array<{ id: string; a: string; b: string }>,
): AstralEdge[] {
  const pointsById = new Map(points.map((point) => [point.id, point]));
  return edges.map((edge) => ({
    ...edge,
    crosses: edges
      .filter(
        (other) =>
          other.id !== edge.id &&
          properCross(edge, other, pointsById),
      )
      .map((other) => other.id),
  }));
}

function candidateGraphConnected(points: Point[], edges: AstralEdge[]) {
  if (points.length === 0) return false;
  const adjacency = new Map(points.map((point) => [point.id, [] as string[]]));
  for (const edge of edges) {
    adjacency.get(edge.a)?.push(edge.b);
    adjacency.get(edge.b)?.push(edge.a);
  }
  const visited = new Set<string>([points[0].id]);
  const queue = [points[0].id];
  for (let head = 0; head < queue.length; head += 1) {
    for (const next of adjacency.get(queue[head]) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited.size === points.length;
}

function buildSolvedGraph(
  points: Point[],
  edges: AstralEdge[],
  extraEdges: number,
  doubleChance: number,
): SolvedEdge[] | null {
  const parent = new Map(points.map((point) => [point.id, point.id]));
  const find = (value: string): string => {
    const current = parent.get(value) ?? value;
    if (current === value) return value;
    const root = find(current);
    parent.set(value, root);
    return root;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  for (let treeAttempt = 0; treeAttempt < 60; treeAttempt += 1) {
    for (const point of points) parent.set(point.id, point.id);
    const selected: AstralEdge[] = [];

    for (const edge of shuffle(edges)) {
      if (find(edge.a) === find(edge.b)) continue;
      if (
        selected.some(
          (chosen) =>
            chosen.crosses.includes(edge.id) ||
            edge.crosses.includes(chosen.id),
        )
      ) {
        continue;
      }
      selected.push(edge);
      union(edge.a, edge.b);
      if (selected.length === points.length - 1) break;
    }

    if (selected.length !== points.length - 1) continue;

    const optional = shuffle(
      edges.filter(
        (edge) =>
          !selected.some((chosen) => chosen.id === edge.id) &&
          !selected.some(
            (chosen) =>
              chosen.crosses.includes(edge.id) ||
              edge.crosses.includes(chosen.id),
          ),
      ),
    );

    for (const edge of optional.slice(0, extraEdges)) {
      selected.push(edge);
    }

    return selected.map((edge) => ({
      id: edge.id,
      a: edge.a,
      b: edge.b,
      count: Math.random() < doubleChance ? 2 : 1,
    }));
  }

  return null;
}

function labelsFromSolution(points: Point[], solved: SolvedEdge[]): AstralNode[] {
  return points.map((point) => ({
    ...point,
    required: solved.reduce(
      (sum, edge) =>
        edge.a === point.id || edge.b === point.id
          ? sum + edge.count
          : sum,
      0,
    ),
  }));
}

function activeConnected(
  nodes: AstralNode[],
  edges: AstralEdge[],
  counts: number[],
) {
  if (nodes.length === 0) return false;
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
  edges.forEach((edge, index) => {
    if ((counts[index] ?? 0) <= 0) return;
    adjacency.get(edge.a)?.push(edge.b);
    adjacency.get(edge.b)?.push(edge.a);
  });
  const visited = new Set([nodes[0].id]);
  const queue = [nodes[0].id];
  for (let head = 0; head < queue.length; head += 1) {
    for (const next of adjacency.get(queue[head]) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited.size === nodes.length;
}

export function countAstralSolutions(
  nodes: AstralNode[],
  edges: AstralEdge[],
  limit = 2,
) {
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const edgeIndex = new Map(edges.map((edge, index) => [edge.id, index]));
  const incident = nodes.map(() => [] as number[]);
  edges.forEach((edge, index) => {
    const a = nodeIndex.get(edge.a);
    const b = nodeIndex.get(edge.b);
    if (a != null) incident[a].push(index);
    if (b != null) incident[b].push(index);
  });

  const counts = Array.from({ length: edges.length }, () => -1);
  const sums = Array.from({ length: nodes.length }, () => 0);
  let solutions = 0;

  const viable = () =>
    nodes.every((node, nodeIdx) => {
      const current = sums[nodeIdx];
      if (current > node.required) return false;
      const remaining = incident[nodeIdx].filter(
        (index) => counts[index] < 0,
      ).length;
      return current + remaining * 2 >= node.required;
    });

  const recurse = (edgeIdx: number) => {
    if (solutions >= limit) return;
    if (!viable()) return;

    if (edgeIdx >= edges.length) {
      if (
        nodes.every((node, index) => sums[index] === node.required) &&
        activeConnected(nodes, edges, counts)
      ) {
        solutions += 1;
      }
      return;
    }

    const edge = edges[edgeIdx];
    const aIndex = nodeIndex.get(edge.a);
    const bIndex = nodeIndex.get(edge.b);
    if (aIndex == null || bIndex == null) return;

    const crossingActive = edge.crosses.some((id) => {
      const index = edgeIndex.get(id);
      return index != null && counts[index] > 0;
    });
    const max = crossingActive
      ? 0
      : Math.min(
          2,
          nodes[aIndex].required - sums[aIndex],
          nodes[bIndex].required - sums[bIndex],
        );

    for (let count = 0; count <= max; count += 1) {
      counts[edgeIdx] = count;
      sums[aIndex] += count;
      sums[bIndex] += count;
      recurse(edgeIdx + 1);
      sums[aIndex] -= count;
      sums[bIndex] -= count;
      if (solutions >= limit) break;
    }
    counts[edgeIdx] = -1;
  };

  recurse(0);
  return solutions;
}

export function buildAstralWeaveConfig(
  difficulty: string,
): GeneratedAstralWeave {
  const cfg = configForDifficulty(difficulty);

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const points = generatePoints(cfg.grid, cfg.nodes);
    if (!points) continue;

    const edges = withCrossings(points, candidateEdges(points));
    if (!candidateGraphConnected(points, edges)) continue;
    if (edges.length < points.length - 1 + cfg.minCandidateSurplus) continue;

    const solved = buildSolvedGraph(
      points,
      edges,
      cfg.extraEdges,
      cfg.doubleChance,
    );
    if (!solved) continue;

    const nodes = labelsFromSolution(points, solved);
    if (nodes.some((node) => node.required < 1 || node.required > 8)) continue;

    const solutionBridges = Object.fromEntries(
      solved.map((edge) => [edge.id, edge.count]),
    );

    if (countAstralSolutions(nodes, edges, 2) !== 1) continue;

    const solutionMoves = solved.reduce((sum, edge) => sum + edge.count, 0);
    const variantId = makeVariantId("astral-weave", [
      difficulty,
      cfg.grid,
      ...nodes.flatMap((node) => [node.x, node.y, node.required]),
      ...solved.flatMap((edge) => [edge.id, edge.count]),
      Date.now(),
      Math.random(),
    ]);

    return {
      publicConfig: {
        grid_size: cfg.grid,
        nodes,
        edges,
        initial_bridges: {},
        variant_id: variantId,
        generation_rule:
          "unique-hashiwokakero-inspired-connected-noncrossing-star-map",
        legend:
          "Join aligned stars. Each star must receive exactly its shown number of threads, no threads may cross, and every star must belong to one constellation. A path may carry one or two threads.",
      } satisfies JsonRecord,
      secretConfig: {
        solution_bridges: solutionBridges,
      } satisfies JsonRecord,
      solutionMoves: solutionMoves + cfg.allowance,
    };
  }

  throw new Error(
    `Unable to generate a unique Astral Weave (${difficulty}).`,
  );
}
