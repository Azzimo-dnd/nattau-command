import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDuality } from "../components/vtt/vttDuality";
import { buildPuzzlePreset } from "../lib/puzzles/puzzlePresets";
import { solveSlidingLockMinimumMoves, type SlidingBlock } from "../lib/puzzles/puzzleVariants";
import { circuitReachesTargets, findCircuitRotation } from "../lib/puzzles/arcaneCircuit";
import { BAROVIA_RUNE_IDS, getCampaignRuneDefinition } from "../lib/puzzles/campaignRunes";
import { NATTAU_RUNE_IDS } from "../lib/puzzles/nattauRunes";
import type { PuzzleType } from "../lib/puzzles/puzzleTypes";
import { campaignPath } from "../lib/campaigns/campaignPresentation";

const types: PuzzleType[] = ["rune_cipher", "sliding_lock", "shattered_sigil", "arcane_circuit", "rune_sequence"];

test("Duality resolves Hope/Fear independently of modifier and advantage", () => {
  assert.deepEqual(resolveDuality(8, 4, 2, "normal"), { hope: 8, fear: 4, advantageDie: null, outcome: "hope", total: 14 });
  assert.deepEqual(resolveDuality(2, 12, 3, "advantage", 6), { hope: 2, fear: 12, advantageDie: 6, outcome: "fear", total: 23 });
  assert.equal(resolveDuality(10, 4, -2, "disadvantage", 3).total, 9);
  for (let face = 1; face <= 12; face++) assert.equal(resolveDuality(face, face, -20, "disadvantage", 6).outcome, "critical");
  for (const invalid of [0, 13, .5, Infinity, NaN]) assert.throws(() => resolveDuality(invalid, 2, 0, "normal"));
  assert.throws(() => resolveDuality(2, 6, 0, "advantage"));
  assert.throws(() => resolveDuality(2, 6, 0, "disadvantage", 7));
});

test("campaign routes preserve legacy Nattau links and isolate Barovia tools", () => {
  for (const path of ["/vtt", "/characters/paint", "/gm/session", "/gm/miniatures/paint", "/gm/vtt/enemies"]) {
    assert.equal(campaignPath("nattau", path), path);
    assert.equal(campaignPath("barovia", path), `/campaigns/barovia${path}`);
  }
});

for (const theme of ["nattau", "barovia"] as const) test(`${theme}: all puzzle types retain valid solutions at every difficulty`, () => {
  for (const difficulty of ["Easy", "Medium", "Hard", "Insane"]) for (const type of types) {
    const preset = buildPuzzlePreset(type, difficulty, { theme });
    const config = preset.publicConfig;
    assert.equal(config.campaign_theme, theme);
    assert.ok(typeof config.success_message === "string" && config.success_message.length > 20);
    if (theme === "barovia") assert.doesNotMatch(`${preset.title} ${preset.description} ${preset.failureMessage} ${JSON.stringify(config.blocks ?? [])}`, /Nattau|Koru|Azzimo|greenstone/i);
    if (type === "rune_cipher" || type === "rune_sequence") {
      const pool = config.runes as string[];
      assert.ok(pool.every((id) => (theme === "barovia" ? BAROVIA_RUNE_IDS : NATTAU_RUNE_IDS).includes(id)));
      assert.ok(pool.every((id) => getCampaignRuneDefinition(id)));
      const solution = (preset.secretConfig.solution ?? preset.secretConfig.sequence) as string[];
      assert.ok(solution.every((id) => pool.includes(id)));
      assert.equal("solution" in config || "sequence" in config, false);
      if (type === "rune_cipher") assert.equal(solution.length, config.code_length);
      else assert.equal(solution.length, Number(config.base_length) + Number(config.max_level) - 1);
    } else if (type === "sliding_lock") {
      const minimum = solveSlidingLockMinimumMoves(config.blocks as SlidingBlock[]);
      assert.ok(minimum !== null && minimum > 0 && minimum <= Number(preset.moveLimit));
      assert.equal(minimum, config.verified_minimum_moves);
    } else if (type === "arcane_circuit") {
      const masks = config.masks as number[];
      const targets = preset.secretConfig.target_masks as number[];
      const rotations = masks.map((mask, i) => findCircuitRotation(mask, targets[i]));
      assert.ok(circuitReachesTargets(masks, rotations, Number(config.width), Number(config.source_index), config.target_indices as number[]));
      assert.equal(circuitReachesTargets(masks, config.initial_rotations as number[], Number(config.width), Number(config.source_index), config.target_indices as number[]), false);
    } else {
      assert.deepEqual([...(config.initial_order as string[])].sort(), [...(preset.secretConfig.target_order as string[])].sort());
      assert.notDeepEqual(config.initial_order, preset.secretConfig.target_order);
      assert.ok(Number(config.scramble_steps) < Number(preset.moveLimit));
    }
  }
});
