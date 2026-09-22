import { stableSigilHash } from "./shatteredSigil";
import type { PuzzlePreset, PuzzleTheme, PuzzleType } from "./puzzleTypes";

const BAROVIA: Record<PuzzleType, { title: string; description: string; failure: string; success: string }> = {
  rune_cipher: { title: "The Mourner's Seal", description: "Wax seals a letter whose ink has never dried. A raven, a thorn, a candle: place the mourning signs in order and listen for the lock to breathe.", failure: "The wax turns black. A name is scratched out on the other side.", success: "The seal parts with a sigh. The ink finally dries." },
  sliding_lock: { title: "The Iron Reliquary", description: "Cold iron bars enclose a silver key. Slide each ward along its groove until the key can escape through the right-hand opening.", failure: "The iron bites shut. From inside the reliquary comes a single knock.", success: "The silver key slips free. Whatever was knocking has fallen silent." },
  shattered_sigil: { title: "The Broken Vigil", description: "Someone shattered this protective seal from within. Reunite the fragments; every misplaced line leaves a way for the dark to enter.", failure: "A hairline crack cuts through the last light in the seal.", success: "The final line closes. For a moment, the shadows retreat." },
  arcane_circuit: { title: "The Last Lantern", description: "One ember remains in a dead lantern. Turn the channels to carry its light to the waiting wick before the house remembers you are here.", failure: "The ember goes out. Footsteps continue in the room above.", success: "The wick catches. The footsteps stop at the door." },
  rune_sequence: { title: "Echoes Behind the Door", description: "The door remembers everyone who knocked. Watch the signs appear, then repeat their order without inviting an extra voice inside.", failure: "You repeat the wrong sign. Something repeats your voice in reply.", success: "The last echo is your own. The door opens a little." },
  runic_resonance: { title: "The Choir Beneath the Floor", description: "A circle of burial signs hums beneath the boards. Touch one and its neighbours answer. Quiet the whole choir before something answers from below.", failure: "The last note rises instead of fading. Something beneath the floor begins to hum back.", success: "One by one the signs fall silent. The room exhales with them." },
  astral_weave: { title: "The Dead Constellation", description: "Silver stars have been nailed into a black chart. Bind them with moonlit threads until the dead constellation becomes whole again.", failure: "Two silver paths cross. For an instant, the chart shows a sky that does not belong to this world.", success: "The final thread settles into place. A forgotten constellation burns above the Mists." },
};

const NATTAU_SUCCESS: Record<PuzzleType, string> = {
  rune_cipher: "The carvings answer in a low, resonant chord. The old seal releases.",
  sliding_lock: "Greenstone meets the open edge. The gate shifts with the weight of ages.",
  shattered_sigil: "The fragments join. The restored lines catch the light like a single living mark.",
  arcane_circuit: "The last conduit kindles. A pulse passes through the entire mechanism.",
  rune_sequence: "The stone returns the final echo, then rests beneath your hand.",
  runic_resonance: "The final glyph falls quiet. The stone circle settles into perfect stillness.",
  astral_weave: "The last star-thread catches. A complete sky-map glows across the ancient surface.",
};

export function applyPuzzleAtmosphere(preset: PuzzlePreset, type: PuzzleType, theme: PuzzleTheme): PuzzlePreset {
  const story = BAROVIA[type];
  const publicConfig = { ...preset.publicConfig, campaign_theme: theme, success_message: theme === "barovia" ? story.success : NATTAU_SUCCESS[type] };
  if (theme === "nattau") return { ...preset, publicConfig };
  if (type === "sliding_lock" && Array.isArray(preset.publicConfig.blocks)) {
    Object.assign(publicConfig, { blocks: preset.publicConfig.blocks.map((block: Record<string, unknown>) => ({ ...block, label: block.target ? "Silver Key" : "Iron Ward" })) });
  }
  if (type === "shattered_sigil") {
    const motifs = ["thorn_crown", "eclipse", "moon_gate", "oracle_web"];
    Object.assign(publicConfig, { art_variant: motifs[stableSigilHash(String(preset.publicConfig.variant_id)) % motifs.length] });
  }
  return { ...preset, title: story.title, description: story.description, failureMessage: story.failure, publicConfig };
}
