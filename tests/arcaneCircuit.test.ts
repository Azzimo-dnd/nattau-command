import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeCircuit,
  circuitIsSolved,
} from "../lib/puzzles/arcaneCircuit";
import { buildArcaneCircuitConfig } from "../lib/puzzles/arcaneCircuitGenerator";

function numbers(value: unknown) {
  assert.ok(Array.isArray(value));
  return value.map(Number);
}

function bitCount(mask: number) {
  return [1, 2, 4, 8].reduce(
    (count, bit) => count + (mask & bit ? 1 : 0),
    0,
  );
}

test("Arcane Circuit rejects powered leaks", () => {
  // source points east into a straight which leaks east off its unmatched arm
  const masks = [2, 10, 8];
  const rotations = [0, 0, 0];
  const result = analyzeCircuit(masks, rotations, 3, 0, [2]);

  assert.equal(result.targetsPowered, true);
  assert.equal(result.leakCount, 0);
  assert.equal(result.hasCycle, false);
  assert.equal(result.solved, true);

  const leaking = analyzeCircuit([2, 11, 8], rotations, 3, 0, [2]);
  assert.equal(leaking.targetsPowered, true);
  assert.ok(leaking.leakCount > 0);
  assert.equal(leaking.solved, false);
});

test("Arcane Circuit rejects powered feedback loops", () => {
  // 2x2 ring: source is part of a closed cycle and target is reachable.
  const masks = [6, 12, 3, 9];
  const rotations = [0, 0, 0, 0];
  const result = analyzeCircuit(masks, rotations, 2, 0, [1]);

  assert.equal(result.targetsPowered, true);
  assert.equal(result.leakCount, 0);
  assert.equal(result.hasCycle, true);
  assert.equal(result.solved, false);
});

for (const difficulty of ["Easy", "Medium", "Hard", "Insane"]) {
  test(`Arcane Circuit v3 generates structurally honest ${difficulty} boards`, () => {
    for (let sample = 0; sample < 250; sample += 1) {
      const generated = buildArcaneCircuitConfig(difficulty);
      const publicConfig = generated.publicConfig;
      const secretConfig = generated.secretConfig;
      const width = Number(publicConfig.width);
      const masks = numbers(publicConfig.masks);
      const initialRotations = numbers(publicConfig.initial_rotations);
      const solutionRotations = numbers(secretConfig.solution_rotations);
      const targetMasks = numbers(secretConfig.target_masks);
      const required = new Set(numbers(secretConfig.required_indices));
      const terminals = new Set(numbers(secretConfig.terminal_indices));
      const targets = numbers(publicConfig.target_indices);
      const source = Number(publicConfig.source_index);

      assert.ok(
        circuitIsSolved(masks, solutionRotations, width, source, targets),
        "canonical solution must be stable, leak-free and acyclic",
      );
      assert.equal(
        circuitIsSolved(masks, initialRotations, width, source, targets),
        false,
        "generated board must not start solved",
      );
      assert.ok(Number(publicConfig.decoy_tile_count) >= 3);

      // The design invariant that fixes v2: only labelled terminals may be
      // single-port pieces. Every ordinary tile can plausibly pass current on.
      for (let index = 0; index < masks.length; index += 1) {
        if (terminals.has(index)) {
          assert.equal(bitCount(targetMasks[index]), 1);
        } else {
          assert.ok(
            bitCount(masks[index]) >= 2,
            `ordinary tile ${index} must not advertise itself as a dead end`,
          );
        }

        if (required.has(index) && !terminals.has(index)) {
          assert.ok(bitCount(targetMasks[index]) >= 2);
        }
      }

      if (difficulty === "Hard" || difficulty === "Insane") {
        assert.ok(Number(publicConfig.cross_count) >= 1);
      }
    }
  });
}
