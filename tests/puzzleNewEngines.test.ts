import assert from "node:assert/strict";
import test from "node:test";
import {
  applyResonancePress,
  buildRunicResonanceConfig,
  resonanceSolved,
} from "../lib/puzzles/runicResonance";
import {
  buildAstralWeaveConfig,
  countAstralSolutions,
  type AstralEdge,
  type AstralNode,
} from "../lib/puzzles/astralWeave";

function numbers(value: unknown) {
  assert.ok(Array.isArray(value));
  return value.map(Number);
}

function booleans(value: unknown) {
  assert.ok(Array.isArray(value));
  return value.map(Boolean);
}

for (const difficulty of ["Easy", "Medium", "Hard", "Insane"]) {
  test(`Runic Resonance ${difficulty} is solvable by its verified press sequence`, () => {
    for (let sample = 0; sample < 100; sample += 1) {
      const generated = buildRunicResonanceConfig(difficulty);
      const effects = generated.publicConfig.effects as number[][];
      const locked = new Set(numbers(generated.publicConfig.locked_indices));
      const solution = numbers(generated.secretConfig.solution_presses);
      const target = booleans(generated.publicConfig.target_lit);
      let state = booleans(generated.publicConfig.initial_lit);

      assert.ok(state.some(Boolean), "board should not start solved");
      for (const index of solution) {
        assert.equal(locked.has(index), false, "solution may not press a sealed rune");
        state = applyResonancePress(state, effects, index);
      }
      assert.equal(resonanceSolved(state, target), true);
    }
  });
}

function parseNodes(value: unknown) {
  assert.ok(Array.isArray(value));
  return value as AstralNode[];
}

function parseEdges(value: unknown) {
  assert.ok(Array.isArray(value));
  return value as AstralEdge[];
}

for (const difficulty of ["Easy", "Medium", "Hard", "Insane"]) {
  test(`Astral Weave ${difficulty} has exactly one verified constellation`, () => {
    for (let sample = 0; sample < 40; sample += 1) {
      const generated = buildAstralWeaveConfig(difficulty);
      const nodes = parseNodes(generated.publicConfig.nodes);
      const edges = parseEdges(generated.publicConfig.edges);
      const solution = generated.secretConfig.solution_bridges as Record<string, number>;

      assert.equal(countAstralSolutions(nodes, edges, 2), 1);
      assert.ok(edges.length >= nodes.length - 1);

      for (const node of nodes) {
        const degree = edges.reduce((sum, edge) => {
          if (edge.a !== node.id && edge.b !== node.id) return sum;
          return sum + (Number(solution[edge.id]) || 0);
        }, 0);
        assert.equal(degree, node.required);
      }

      for (const edge of edges) {
        if ((solution[edge.id] ?? 0) <= 0) continue;
        for (const crossing of edge.crosses) {
          assert.equal(
            (solution[crossing] ?? 0) > 0,
            false,
            "solution threads may not cross",
          );
        }
      }
    }
  });
}
