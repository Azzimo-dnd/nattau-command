import type { JsonRecord } from "./puzzleTypes";
import { makeVariantId } from "./puzzleVariants";

export type AstralNode = {
  id: string;
  x: number;
  y: number;
  required: number;
  brightness?: number;
};

export type AstralEdge = {
  id: string;
  a: string;
  b: string;
  crosses: string[];
};

type TemplateStar = {
  id: string;
  x: number;
  y: number;
  brightness?: number;
};

type ConstellationTemplate = {
  id: string;
  name: string;
  family: "constellation" | "asterism";
  stars: TemplateStar[];
  lines: Array<[string, string]>;
};

export type GeneratedAstralWeave = {
  publicConfig: JsonRecord;
  secretConfig: JsonRecord;
  solutionMoves: number;
};

const CONSTELLATIONS: ConstellationTemplate[] = [
  {
    id: "cassiopeia",
    name: "Cassiopeia",
    family: "constellation",
    stars: [
      { id: "caph", x: 0.10, y: 0.48, brightness: 0.9 },
      { id: "schedar", x: 0.28, y: 0.70, brightness: 1.15 },
      { id: "navi", x: 0.48, y: 0.36, brightness: 1.05 },
      { id: "ruchbah", x: 0.69, y: 0.64, brightness: 0.9 },
      { id: "segin", x: 0.90, y: 0.31, brightness: 0.78 },
    ],
    lines: [
      ["caph", "schedar"],
      ["schedar", "navi"],
      ["navi", "ruchbah"],
      ["ruchbah", "segin"],
    ],
  },
  {
    id: "big_dipper",
    name: "Big Dipper",
    family: "asterism",
    stars: [
      { id: "dubhe", x: 0.12, y: 0.27, brightness: 1.25 },
      { id: "merak", x: 0.14, y: 0.57, brightness: 1.05 },
      { id: "phecda", x: 0.36, y: 0.62, brightness: 0.9 },
      { id: "megrez", x: 0.43, y: 0.38, brightness: 0.72 },
      { id: "alioth", x: 0.60, y: 0.34, brightness: 1.25 },
      { id: "mizar", x: 0.77, y: 0.29, brightness: 1.12 },
      { id: "alkaid", x: 0.92, y: 0.20, brightness: 1.28 },
    ],
    lines: [
      ["dubhe", "merak"],
      ["merak", "phecda"],
      ["phecda", "megrez"],
      ["megrez", "dubhe"],
      ["megrez", "alioth"],
      ["alioth", "mizar"],
      ["mizar", "alkaid"],
    ],
  },
  {
    id: "cygnus",
    name: "Cygnus",
    family: "constellation",
    stars: [
      { id: "deneb", x: 0.50, y: 0.07, brightness: 1.35 },
      { id: "sadr", x: 0.50, y: 0.41, brightness: 1.05 },
      { id: "albireo", x: 0.50, y: 0.91, brightness: 1.0 },
      { id: "gienah", x: 0.17, y: 0.43, brightness: 0.92 },
      { id: "delta", x: 0.83, y: 0.39, brightness: 0.88 },
      { id: "eta", x: 0.49, y: 0.62, brightness: 0.72 },
      { id: "zeta", x: 0.50, y: 0.77, brightness: 0.68 },
    ],
    lines: [
      ["deneb", "sadr"],
      ["gienah", "sadr"],
      ["sadr", "delta"],
      ["sadr", "eta"],
      ["eta", "zeta"],
      ["zeta", "albireo"],
    ],
  },
  {
    id: "pegasus",
    name: "Pegasus",
    family: "constellation",
    stars: [
      { id: "markab", x: 0.22, y: 0.31, brightness: 1.0 },
      { id: "scheat", x: 0.25, y: 0.69, brightness: 1.05 },
      { id: "algenib", x: 0.63, y: 0.30, brightness: 0.95 },
      { id: "alpheratz", x: 0.65, y: 0.69, brightness: 1.2 },
      { id: "enif", x: 0.05, y: 0.48, brightness: 1.18 },
      { id: "homam", x: 0.12, y: 0.39, brightness: 0.78 },
      { id: "matar", x: 0.36, y: 0.85, brightness: 0.78 },
      { id: "baham", x: 0.48, y: 0.92, brightness: 0.7 },
    ],
    lines: [
      ["markab", "scheat"],
      ["scheat", "alpheratz"],
      ["alpheratz", "algenib"],
      ["algenib", "markab"],
      ["markab", "homam"],
      ["homam", "enif"],
      ["scheat", "matar"],
      ["matar", "baham"],
    ],
  },
  {
    id: "leo",
    name: "Leo",
    family: "constellation",
    stars: [
      { id: "regulus", x: 0.20, y: 0.73, brightness: 1.35 },
      { id: "eta", x: 0.25, y: 0.53, brightness: 0.72 },
      { id: "algieba", x: 0.30, y: 0.32, brightness: 1.05 },
      { id: "adhafera", x: 0.22, y: 0.18, brightness: 0.75 },
      { id: "ras_elased", x: 0.10, y: 0.23, brightness: 0.72 },
      { id: "zosma", x: 0.57, y: 0.45, brightness: 0.92 },
      { id: "chertan", x: 0.54, y: 0.69, brightness: 0.74 },
      { id: "denebola", x: 0.88, y: 0.55, brightness: 1.18 },
      { id: "subra", x: 0.37, y: 0.83, brightness: 0.68 },
    ],
    lines: [
      ["regulus", "eta"],
      ["eta", "algieba"],
      ["algieba", "adhafera"],
      ["adhafera", "ras_elased"],
      ["algieba", "zosma"],
      ["zosma", "denebola"],
      ["denebola", "chertan"],
      ["chertan", "regulus"],
      ["regulus", "subra"],
    ],
  },
  {
    id: "orion",
    name: "Orion",
    family: "constellation",
    stars: [
      { id: "meissa", x: 0.50, y: 0.06, brightness: 0.86 },
      { id: "betelgeuse", x: 0.27, y: 0.23, brightness: 1.42 },
      { id: "bellatrix", x: 0.72, y: 0.22, brightness: 1.16 },
      { id: "alnitak", x: 0.39, y: 0.47, brightness: 1.1 },
      { id: "alnilam", x: 0.50, y: 0.46, brightness: 1.18 },
      { id: "mintaka", x: 0.61, y: 0.45, brightness: 1.08 },
      { id: "saiph", x: 0.32, y: 0.84, brightness: 0.92 },
      { id: "rigel", x: 0.72, y: 0.86, brightness: 1.48 },
      { id: "sword_north", x: 0.49, y: 0.60, brightness: 0.62 },
      { id: "sword_south", x: 0.48, y: 0.72, brightness: 0.68 },
    ],
    lines: [
      ["meissa", "betelgeuse"],
      ["meissa", "bellatrix"],
      ["betelgeuse", "alnitak"],
      ["bellatrix", "mintaka"],
      ["alnitak", "alnilam"],
      ["alnilam", "mintaka"],
      ["alnitak", "saiph"],
      ["mintaka", "rigel"],
      ["saiph", "rigel"],
      ["alnilam", "sword_north"],
      ["sword_north", "sword_south"],
    ],
  },
  {
    id: "scorpius",
    name: "Scorpius",
    family: "constellation",
    stars: [
      { id: "graffias", x: 0.18, y: 0.12, brightness: 0.9 },
      { id: "dschubba", x: 0.28, y: 0.21, brightness: 0.92 },
      { id: "pi", x: 0.12, y: 0.25, brightness: 0.68 },
      { id: "antares", x: 0.38, y: 0.37, brightness: 1.48 },
      { id: "tau", x: 0.45, y: 0.49, brightness: 0.64 },
      { id: "epsilon", x: 0.52, y: 0.59, brightness: 0.8 },
      { id: "mu", x: 0.61, y: 0.68, brightness: 0.72 },
      { id: "zeta", x: 0.72, y: 0.76, brightness: 0.76 },
      { id: "eta", x: 0.83, y: 0.73, brightness: 0.72 },
      { id: "sargas", x: 0.91, y: 0.62, brightness: 1.16 },
      { id: "shaula", x: 0.88, y: 0.48, brightness: 1.32 },
      { id: "lesath", x: 0.80, y: 0.51, brightness: 0.98 },
    ],
    lines: [
      ["pi", "dschubba"],
      ["graffias", "dschubba"],
      ["dschubba", "antares"],
      ["antares", "tau"],
      ["tau", "epsilon"],
      ["epsilon", "mu"],
      ["mu", "zeta"],
      ["zeta", "eta"],
      ["eta", "sargas"],
      ["sargas", "shaula"],
      ["shaula", "lesath"],
    ],
  },
  {
    id: "draco",
    name: "Draco",
    family: "constellation",
    stars: [
      { id: "eltanin", x: 0.83, y: 0.18, brightness: 1.28 },
      { id: "rastaban", x: 0.70, y: 0.11, brightness: 1.05 },
      { id: "grumium", x: 0.91, y: 0.31, brightness: 0.72 },
      { id: "nu", x: 0.73, y: 0.33, brightness: 0.72 },
      { id: "xi", x: 0.59, y: 0.41, brightness: 0.78 },
      { id: "altais", x: 0.47, y: 0.53, brightness: 0.9 },
      { id: "chi", x: 0.32, y: 0.57, brightness: 0.65 },
      { id: "thuban", x: 0.22, y: 0.48, brightness: 0.95 },
      { id: "iota", x: 0.14, y: 0.61, brightness: 0.68 },
      { id: "kappa", x: 0.24, y: 0.75, brightness: 0.7 },
      { id: "lambda", x: 0.40, y: 0.83, brightness: 0.7 },
      { id: "epsilon", x: 0.56, y: 0.76, brightness: 0.78 },
    ],
    lines: [
      ["grumium", "eltanin"],
      ["eltanin", "rastaban"],
      ["rastaban", "nu"],
      ["nu", "grumium"],
      ["nu", "xi"],
      ["xi", "altais"],
      ["altais", "chi"],
      ["chi", "thuban"],
      ["thuban", "iota"],
      ["iota", "kappa"],
      ["kappa", "lambda"],
      ["lambda", "epsilon"],
    ],
  },
];

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
      return {
        templateIds: ["cassiopeia", "big_dipper", "cygnus"],
        decoys: 1,
        doubleChance: 0.08,
        allowance: 7,
      };
    case "hard":
      return {
        templateIds: ["leo", "orion", "scorpius", "draco"],
        decoys: 5,
        doubleChance: 0.32,
        allowance: 5,
      };
    case "insane":
      return {
        templateIds: ["orion", "scorpius", "draco"],
        decoys: 7,
        doubleChance: 0.44,
        allowance: 4,
      };
    default:
      return {
        templateIds: ["big_dipper", "cygnus", "pegasus", "leo", "orion"],
        decoys: 3,
        doubleChance: 0.2,
        allowance: 6,
      };
  }
}

function edgeId(a: string, b: string) {
  return a < b ? `${a}--${b}` : `${b}--${a}`;
}

function distance(a: TemplateStar, b: TemplateStar) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointToSegmentDistance(
  point: TemplateStar,
  a: TemplateStar,
  b: TemplateStar,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(point, a);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq,
    ),
  );
  return Math.hypot(
    point.x - (a.x + t * dx),
    point.y - (a.y + t * dy),
  );
}

function orientation(
  a: TemplateStar,
  b: TemplateStar,
  c: TemplateStar,
) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function properCross(
  first: { a: string; b: string },
  second: { a: string; b: string },
  stars: Map<string, TemplateStar>,
) {
  if (
    first.a === second.a ||
    first.a === second.b ||
    first.b === second.a ||
    first.b === second.b
  ) {
    return false;
  }

  const a = stars.get(first.a);
  const b = stars.get(first.b);
  const c = stars.get(second.a);
  const d = stars.get(second.b);
  if (!a || !b || !c || !d) return false;

  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  const epsilon = 1e-7;

  return (
    o1 * o2 < -epsilon &&
    o3 * o4 < -epsilon
  );
}

function buildCandidateEdges(
  template: ConstellationTemplate,
  decoyCount: number,
): AstralEdge[] | null {
  const stars = new Map(template.stars.map((star) => [star.id, star]));
  const skeletonIds = new Set(
    template.lines.map(([a, b]) => edgeId(a, b)),
  );
  const skeleton = template.lines.map(([a, b]) => ({
    id: edgeId(a, b),
    a: a < b ? a : b,
    b: a < b ? b : a,
  }));

  const decoyPool: Array<{
    id: string;
    a: string;
    b: string;
    score: number;
  }> = [];

  for (let first = 0; first < template.stars.length; first += 1) {
    for (let second = first + 1; second < template.stars.length; second += 1) {
      const a = template.stars[first];
      const b = template.stars[second];
      const id = edgeId(a.id, b.id);
      if (skeletonIds.has(id)) continue;

      const length = distance(a, b);
      if (length > 0.58) continue;

      const passesTooClose = template.stars.some(
        (star) =>
          star.id !== a.id &&
          star.id !== b.id &&
          pointToSegmentDistance(star, a, b) < 0.055,
      );
      if (passesTooClose) continue;

      decoyPool.push({
        id,
        a: a.id < b.id ? a.id : b.id,
        b: a.id < b.id ? b.id : a.id,
        score: length + Math.random() * 0.12,
      });
    }
  }

  if (decoyPool.length < decoyCount) return null;

  const chosen = decoyPool
    .sort((a, b) => a.score - b.score)
    .slice(0, decoyCount);

  const raw = [...skeleton, ...chosen];
  return raw.map((edge) => ({
    id: edge.id,
    a: edge.a,
    b: edge.b,
    crosses: raw
      .filter(
        (other) =>
          other.id !== edge.id &&
          properCross(edge, other, stars),
      )
      .map((other) => other.id),
  }));
}

function solutionIsNonCrossing(
  solutionIds: Set<string>,
  edges: AstralEdge[],
) {
  for (const edge of edges) {
    if (!solutionIds.has(edge.id)) continue;
    if (edge.crosses.some((id) => solutionIds.has(id))) {
      return false;
    }
  }
  return true;
}

function labelsFromSolution(
  template: ConstellationTemplate,
  counts: Record<string, number>,
): AstralNode[] {
  return template.stars.map((star) => ({
    id: star.id,
    x: Math.round(star.x * 1000) / 1000,
    y: Math.round(star.y * 1000) / 1000,
    brightness: star.brightness ?? 1,
    required: template.lines.reduce((sum, [a, b]) => {
      if (a !== star.id && b !== star.id) return sum;
      return sum + (counts[edgeId(a, b)] ?? 0);
    }, 0),
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
  const templates = shuffle(
    CONSTELLATIONS.filter((template) =>
      cfg.templateIds.includes(template.id),
    ),
  );

  for (let templateAttempt = 0; templateAttempt < 80; templateAttempt += 1) {
    const template = templates[templateAttempt % templates.length];
    if (!template) break;

    const edges = buildCandidateEdges(template, cfg.decoys);
    if (!edges) continue;

    const solutionIds = new Set(
      template.lines.map(([a, b]) => edgeId(a, b)),
    );
    if (!solutionIsNonCrossing(solutionIds, edges)) continue;

    for (let countAttempt = 0; countAttempt < 120; countAttempt += 1) {
      const solutionBridges: Record<string, number> = {};
      let doubles = 0;

      for (const [a, b] of template.lines) {
        const count = Math.random() < cfg.doubleChance ? 2 : 1;
        solutionBridges[edgeId(a, b)] = count;
        if (count === 2) doubles += 1;
      }

      if (
        difficulty.toLowerCase() !== "easy" &&
        doubles === 0 &&
        template.lines.length > 0
      ) {
        const [a, b] =
          template.lines[Math.floor(Math.random() * template.lines.length)];
        solutionBridges[edgeId(a, b)] = 2;
      }

      const nodes = labelsFromSolution(template, solutionBridges);
      if (nodes.some((node) => node.required < 1 || node.required > 8)) {
        continue;
      }

      if (countAstralSolutions(nodes, edges, 2) !== 1) continue;

      const solutionMoves = Object.values(solutionBridges).reduce(
        (sum, count) => sum + count,
        0,
      );
      const variantId = makeVariantId("astral-weave-constellation", [
        difficulty,
        template.id,
        ...nodes.flatMap((node) => [
          node.x,
          node.y,
          node.required,
          node.brightness ?? 1,
        ]),
        ...Object.entries(solutionBridges).flatMap(([id, count]) => [
          id,
          count,
        ]),
        Date.now(),
        Math.random(),
      ]);

      return {
        publicConfig: {
          nodes,
          edges,
          initial_bridges: {},
          variant_id: variantId,
          generation_rule:
            "unique-constellation-template-weave-with-decoy-star-lanes",
          legend:
            "Join stars along the faint possible paths. Each star must receive exactly its shown number of threads, no active threads may cross, and every star must belong to one constellation. A path may carry one or two threads.",
        } satisfies JsonRecord,
        secretConfig: {
          constellation_id: template.id,
          constellation_name: template.name,
          constellation_family: template.family,
          solution_bridges: solutionBridges,
        } satisfies JsonRecord,
        solutionMoves: solutionMoves + cfg.allowance,
      };
    }
  }

  throw new Error(
    `Unable to generate a unique constellation-based Astral Weave (${difficulty}).`,
  );
}
