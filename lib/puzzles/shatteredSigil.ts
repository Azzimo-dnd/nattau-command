export type SigilMaterial = "stone" | "parchment";
export type SigilMaterialMode = "auto" | SigilMaterial;
export type SigilVariant =
  | "eclipse"
  | "drowned_star"
  | "serpent"
  | "moon_gate"
  | "thorn_crown"
  | "first_flame"
  | "sun_compass"
  | "ancestral_eye"
  | "storm_wheel"
  | "guardian_knot"
  | "twin_moons"
  | "oracle_web";

export const SIGIL_NAMES: Record<SigilVariant, string> = {
  eclipse: "Seal of the Drowned Eclipse",
  drowned_star: "The Nine-Tide Star",
  serpent: "Coil of the First Serpent",
  moon_gate: "The Moon Gate Diagram",
  thorn_crown: "Crown of Thorns",
  first_flame: "Circle of the First Flame",
  sun_compass: "Compass of the Buried Sun",
  ancestral_eye: "Eye of the First Ancestor",
  storm_wheel: "Wheel of the Black Storm",
  guardian_knot: "The Guardian Knot",
  twin_moons: "Conjunction of the Twin Moons",
  oracle_web: "The Oracle's Web",
};

export const STONE_SIGIL_VARIANTS: SigilVariant[] = [
  "eclipse",
  "drowned_star",
  "serpent",
  "moon_gate",
  "thorn_crown",
  "first_flame",
  "sun_compass",
  "ancestral_eye",
  "storm_wheel",
  "guardian_knot",
];

export const PARCHMENT_SIGIL_VARIANTS: SigilVariant[] = [
  "eclipse",
  "drowned_star",
  "moon_gate",
  "thorn_crown",
  "first_flame",
  "sun_compass",
  "ancestral_eye",
  "guardian_knot",
  "twin_moons",
  "oracle_web",
];

export const SIGIL_VARIANTS: SigilVariant[] = Array.from(
  new Set([...STONE_SIGIL_VARIANTS, ...PARCHMENT_SIGIL_VARIANTS]),
);

export function stableSigilHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function isSigilMaterial(value: unknown): value is SigilMaterial {
  return value === "stone" || value === "parchment";
}

export function isSigilMaterialMode(value: unknown): value is SigilMaterialMode {
  return value === "auto" || isSigilMaterial(value);
}

export function sigilPoolForMaterial(material: SigilMaterial) {
  return material === "parchment" ? PARCHMENT_SIGIL_VARIANTS : STONE_SIGIL_VARIANTS;
}

export function selectSigilMaterial(mode: SigilMaterialMode): SigilMaterial {
  if (mode !== "auto") return mode;
  return Math.random() < 0.5 ? "stone" : "parchment";
}

export function selectSigilVariant(material: SigilMaterial): SigilVariant {
  const pool = sigilPoolForMaterial(material);
  return pool[Math.floor(Math.random() * pool.length)];
}

function signedNoise(seed: string, key: string, sample: number) {
  const hash = stableSigilHash(`${seed}:${key}:${sample}`);
  return (hash / 0xffffffff) * 2 - 1;
}

function tearProfile(seed: string, key: string, strength: number) {
  const samples = 7;
  return Array.from({ length: samples }, (_, index) => {
    if (index === 0 || index === samples - 1) return 0;
    const primary = signedNoise(seed, key, index);
    const secondary = signedNoise(seed, `${key}:fibers`, index) * 0.38;
    return Number(((primary + secondary) * strength).toFixed(2));
  });
}

function edgePositions(length: number) {
  const low = 3;
  const high = 97;
  return Array.from({ length }, (_, index) =>
    low + ((high - low) * index) / (length - 1),
  );
}

/**
 * Builds a deterministic torn-paper polygon for one fragment.
 *
 * Internal boundaries are keyed only by their shared grid boundary, so the
 * bottom edge of one fragment and the top edge of the fragment below it use
 * the exact same tear profile. The same is true for left/right neighbors.
 * When the fragments return to their canonical positions, the paper tears
 * therefore close into one continuous sheet instead of merely looking random.
 */
export function buildMatchedParchmentClipPath(
  pieceIndex: number,
  size: number,
  seed: string,
) {
  const row = Math.floor(pieceIndex / size);
  const col = pieceIndex % size;
  const low = 3;
  const high = 97;

  const topKey = row === 0 ? `outer-top:${col}` : `horizontal:${row}`;
  const bottomKey =
    row === size - 1 ? `outer-bottom:${col}` : `horizontal:${row + 1}`;
  const leftKey = col === 0 ? `outer-left:${row}` : `vertical:${col}`;
  const rightKey =
    col === size - 1 ? `outer-right:${row}` : `vertical:${col + 1}`;

  const top = tearProfile(seed, topKey, row === 0 ? 2.9 : 2.25);
  const right = tearProfile(seed, rightKey, col === size - 1 ? 2.9 : 2.25);
  const bottom = tearProfile(seed, bottomKey, row === size - 1 ? 2.9 : 2.25);
  const left = tearProfile(seed, leftKey, col === 0 ? 2.9 : 2.25);
  const positions = edgePositions(top.length);
  const points: Array<[number, number]> = [];

  positions.forEach((x, index) => points.push([x, low + top[index]]));
  positions.slice(1).forEach((y, offset) => {
    const index = offset + 1;
    points.push([high + right[index], y]);
  });
  positions
    .slice(0, -1)
    .reverse()
    .forEach((x, reverseIndex) => {
      const index = bottom.length - 2 - reverseIndex;
      points.push([x, high + bottom[index]]);
    });
  positions
    .slice(1, -1)
    .reverse()
    .forEach((y, reverseIndex) => {
      const index = left.length - 2 - reverseIndex;
      points.push([low + left[index], y]);
    });

  return `polygon(${points
    .map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`)
    .join(", ")})`;
}
