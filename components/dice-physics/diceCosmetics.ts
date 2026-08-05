import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import type { DiceCosmeticId, DiceNumberSize } from "./dicePhysicsTypes";

export type DiceTextureKind =
  | "solid"
  | "bone"
  | "stone"
  | "marble"
  | "mist";

export type DiceCosmeticRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

/**
 * This shape is intentionally close to the future database model.
 * Built-in lab styles use unlockMode="builtin". A later Dice Locker can
 * hydrate the same renderer with campaign or player reward definitions.
 */
export type DiceCosmeticDefinition = {
  id: DiceCosmeticId;
  name: string;
  description: string;
  rarity: DiceCosmeticRarity;
  unlockMode: "builtin" | "reward";
  campaignScope: "global" | "nattau" | "barovia";
  textureKind: DiceTextureKind;
  baseColor: string;
  secondaryColor: string;
  edgeColor: string;
  numberColor: string;
  numberOutlineColor: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  emissive?: string;
  emissiveIntensity?: number;
  swatch: string;
};

export const DEFAULT_DICE_COSMETIC_ID = "ivory";

export const DICE_COSMETICS: readonly DiceCosmeticDefinition[] = [
  {
    id: "ivory",
    name: "Ivory",
    description: "Warm ivory resin with deep inked numbers.",
    rarity: "common",
    unlockMode: "builtin",
    campaignScope: "global",
    textureKind: "solid",
    baseColor: "#d8cba9",
    secondaryColor: "#eee4c8",
    edgeColor: "#74684f",
    numberColor: "#211b14",
    numberOutlineColor: "#f6edda",
    roughness: 0.38,
    metalness: 0.03,
    clearcoat: 0.48,
    clearcoatRoughness: 0.28,
    swatch: "linear-gradient(135deg,#f1e8cf 0%,#c3b38d 100%)",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    description: "Glossy black stone with warm ivory numerals.",
    rarity: "common",
    unlockMode: "builtin",
    campaignScope: "global",
    textureKind: "solid",
    baseColor: "#111318",
    secondaryColor: "#343942",
    edgeColor: "#686f79",
    numberColor: "#fff0cf",
    numberOutlineColor: "#08090b",
    roughness: 0.24,
    metalness: 0.12,
    clearcoat: 0.72,
    clearcoatRoughness: 0.17,
    swatch: "linear-gradient(135deg,#3b414b 0%,#08090c 70%)",
  },
  {
    id: "blood-ruby",
    name: "Blood Ruby",
    description: "Deep translucent-looking crimson with antique gold ink.",
    rarity: "uncommon",
    unlockMode: "builtin",
    campaignScope: "global",
    textureKind: "solid",
    baseColor: "#74182b",
    secondaryColor: "#b43a51",
    edgeColor: "#e0a061",
    numberColor: "#ffd99a",
    numberOutlineColor: "#351018",
    roughness: 0.27,
    metalness: 0.08,
    clearcoat: 0.74,
    clearcoatRoughness: 0.16,
    emissive: "#31040d",
    emissiveIntensity: 0.09,
    swatch: "linear-gradient(135deg,#c54a60 0%,#681326 62%,#2b0911 100%)",
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Saturated green resin with pale mint numbers.",
    rarity: "uncommon",
    unlockMode: "builtin",
    campaignScope: "global",
    textureKind: "solid",
    baseColor: "#145b47",
    secondaryColor: "#2c9274",
    edgeColor: "#8fd6bc",
    numberColor: "#e6fff3",
    numberOutlineColor: "#082c22",
    roughness: 0.31,
    metalness: 0.05,
    clearcoat: 0.62,
    clearcoatRoughness: 0.2,
    swatch: "linear-gradient(135deg,#3ea886 0%,#125440 68%,#072d23 100%)",
  },
  {
    id: "royal-blue",
    name: "Royal Blue",
    description: "Dark sapphire resin with silver-white numbers.",
    rarity: "uncommon",
    unlockMode: "builtin",
    campaignScope: "global",
    textureKind: "solid",
    baseColor: "#173f78",
    secondaryColor: "#3f70b5",
    edgeColor: "#a9c7ea",
    numberColor: "#f1f7ff",
    numberOutlineColor: "#0a213f",
    roughness: 0.29,
    metalness: 0.09,
    clearcoat: 0.68,
    clearcoatRoughness: 0.18,
    swatch: "linear-gradient(135deg,#578acb 0%,#173f78 65%,#091f3d 100%)",
  },
  {
    id: "ancient-bone",
    name: "Ancient Bone",
    description: "Weathered bone with stains, pores and dark carved numbers.",
    rarity: "rare",
    unlockMode: "builtin",
    campaignScope: "global",
    textureKind: "bone",
    baseColor: "#bca77f",
    secondaryColor: "#efe0b8",
    edgeColor: "#6d593a",
    numberColor: "#291d11",
    numberOutlineColor: "#e9d8af",
    roughness: 0.7,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.58,
    swatch: "radial-gradient(circle at 35% 25%,#efe0b8 0%,#c0aa7f 48%,#725d3c 100%)",
  },
  {
    id: "cracked-stone",
    name: "Cracked Stone",
    description: "Cold carved stone crossed by fine dark fractures.",
    rarity: "rare",
    unlockMode: "builtin",
    campaignScope: "global",
    textureKind: "stone",
    baseColor: "#666a70",
    secondaryColor: "#a6aaad",
    edgeColor: "#c6c9ca",
    numberColor: "#f8f3df",
    numberOutlineColor: "#232629",
    roughness: 0.9,
    metalness: 0.02,
    clearcoat: 0.03,
    clearcoatRoughness: 0.8,
    swatch: "linear-gradient(135deg,#a8abad 0%,#686c71 58%,#2c3034 100%)",
  },
  {
    id: "dark-marble",
    name: "Dark Marble",
    description: "Polished black marble with pale natural veins.",
    rarity: "epic",
    unlockMode: "builtin",
    campaignScope: "global",
    textureKind: "marble",
    baseColor: "#151419",
    secondaryColor: "#aaa2ad",
    edgeColor: "#bdb3c0",
    numberColor: "#f2dfb8",
    numberOutlineColor: "#171015",
    roughness: 0.25,
    metalness: 0.05,
    clearcoat: 0.78,
    clearcoatRoughness: 0.14,
    swatch: "linear-gradient(125deg,#121116 0%,#4e4952 42%,#c5bdc6 45%,#17161b 49%,#08080b 100%)",
  },
  {
    id: "kainite-gold",
    name: "Kainite Gold",
    description: "A Nattau preview set of burnished gold with deep crimson ink.",
    rarity: "legendary",
    unlockMode: "builtin",
    campaignScope: "nattau",
    textureKind: "solid",
    baseColor: "#b8872f",
    secondaryColor: "#f0cb68",
    edgeColor: "#ffe49a",
    numberColor: "#3a1015",
    numberOutlineColor: "#f4d779",
    roughness: 0.3,
    metalness: 0.62,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
    emissive: "#3d2505",
    emissiveIntensity: 0.06,
    swatch: "linear-gradient(135deg,#ffe29a 0%,#c39335 48%,#6d4610 100%)",
  },
  {
    id: "mist-touched",
    name: "Mist-Touched",
    description: "A Barovian preview set with drifting crimson-violet mist.",
    rarity: "legendary",
    unlockMode: "builtin",
    campaignScope: "barovia",
    textureKind: "mist",
    baseColor: "#25131f",
    secondaryColor: "#8d4562",
    edgeColor: "#c4879c",
    numberColor: "#fff1f5",
    numberOutlineColor: "#2a0d18",
    roughness: 0.34,
    metalness: 0.07,
    clearcoat: 0.55,
    clearcoatRoughness: 0.21,
    emissive: "#2c0719",
    emissiveIntensity: 0.11,
    swatch: "radial-gradient(circle at 30% 30%,#a65b78 0%,#4a2036 45%,#170c15 100%)",
  },
] as const;

const cosmeticMap = new Map(DICE_COSMETICS.map((cosmetic) => [cosmetic.id, cosmetic]));
const surfaceTextureCache = new Map<string, CanvasTexture>();

export function getDiceCosmetic(id: DiceCosmeticId) {
  return cosmeticMap.get(id) ?? cosmeticMap.get(DEFAULT_DICE_COSMETIC_ID)!;
}

export function isDiceCosmeticId(id: unknown): id is DiceCosmeticId {
  return typeof id === "string" && cosmeticMap.has(id);
}

export function isDiceNumberSize(value: unknown): value is DiceNumberSize {
  return value === "standard" || value === "large" || value === "extra-large";
}

export function getDiceNumberScale(size: DiceNumberSize) {
  if (size === "extra-large") return 1.31;
  if (size === "large") return 1.16;
  return 1;
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function addFineNoise(
  context: CanvasRenderingContext2D,
  random: () => number,
  width: number,
  height: number,
  light: string,
  dark: string,
  count: number
) {
  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const radius = 0.35 + random() * 1.6;
    context.globalAlpha = 0.025 + random() * 0.085;
    context.fillStyle = random() > 0.5 ? light : dark;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawBone(
  context: CanvasRenderingContext2D,
  cosmetic: DiceCosmeticDefinition,
  random: () => number,
  size: number
) {
  const gradient = context.createRadialGradient(
    size * 0.34,
    size * 0.28,
    size * 0.04,
    size * 0.5,
    size * 0.5,
    size * 0.78
  );
  gradient.addColorStop(0, cosmetic.secondaryColor);
  gradient.addColorStop(0.62, cosmetic.baseColor);
  gradient.addColorStop(1, "#806a45");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  addFineNoise(context, random, size, size, "#fff0c8", "#5b462c", 2300);

  for (let index = 0; index < 32; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const radiusX = 3 + random() * 16;
    const radiusY = 1 + random() * 7;
    context.save();
    context.translate(x, y);
    context.rotate(random() * Math.PI);
    context.globalAlpha = 0.05 + random() * 0.1;
    context.fillStyle = "#4f391f";
    context.beginPath();
    context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.globalAlpha = 1;
}

function drawCrack(
  context: CanvasRenderingContext2D,
  random: () => number,
  startX: number,
  startY: number,
  length: number,
  angle: number,
  depth: number
) {
  let x = startX;
  let y = startY;
  context.beginPath();
  context.moveTo(x, y);
  const segments = 4 + Math.floor(random() * 6);
  for (let segment = 0; segment < segments; segment += 1) {
    const step = length / segments;
    angle += (random() - 0.5) * 0.7;
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
    context.lineTo(x, y);
  }
  context.stroke();

  if (depth < 1 && random() > 0.35) {
    drawCrack(
      context,
      random,
      x,
      y,
      length * (0.28 + random() * 0.22),
      angle + (random() > 0.5 ? 1 : -1) * (0.45 + random() * 0.65),
      depth + 1
    );
  }
}

function drawStone(
  context: CanvasRenderingContext2D,
  cosmetic: DiceCosmeticDefinition,
  random: () => number,
  size: number
) {
  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, cosmetic.secondaryColor);
  gradient.addColorStop(0.5, cosmetic.baseColor);
  gradient.addColorStop(1, "#3d4247");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  addFineNoise(context, random, size, size, "#ffffff", "#0f1113", 3600);

  context.strokeStyle = "rgba(20,22,25,0.72)";
  context.lineWidth = 1.15;
  for (let index = 0; index < 18; index += 1) {
    drawCrack(
      context,
      random,
      random() * size,
      random() * size,
      35 + random() * 110,
      random() * Math.PI * 2,
      0
    );
  }
  context.strokeStyle = "rgba(230,232,230,0.12)";
  context.lineWidth = 0.65;
  for (let index = 0; index < 10; index += 1) {
    drawCrack(
      context,
      random,
      random() * size,
      random() * size,
      25 + random() * 75,
      random() * Math.PI * 2,
      1
    );
  }
}

function drawMarble(
  context: CanvasRenderingContext2D,
  cosmetic: DiceCosmeticDefinition,
  random: () => number,
  size: number
) {
  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#08080b");
  gradient.addColorStop(0.5, cosmetic.baseColor);
  gradient.addColorStop(1, "#2c2930");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  addFineNoise(context, random, size, size, "#c8c2ca", "#000000", 1200);

  for (let index = 0; index < 13; index += 1) {
    const y = random() * size;
    context.beginPath();
    context.moveTo(-30, y);
    context.bezierCurveTo(
      size * 0.22,
      y + (random() - 0.5) * 150,
      size * 0.66,
      y + (random() - 0.5) * 210,
      size + 30,
      y + (random() - 0.5) * 110
    );
    context.strokeStyle = random() > 0.7
      ? "rgba(219,205,181,0.45)"
      : "rgba(190,184,194,0.22)";
    context.lineWidth = 0.8 + random() * 4.5;
    context.stroke();
  }
}

function drawMist(
  context: CanvasRenderingContext2D,
  cosmetic: DiceCosmeticDefinition,
  random: () => number,
  size: number
) {
  const gradient = context.createRadialGradient(
    size * 0.3,
    size * 0.3,
    0,
    size * 0.55,
    size * 0.55,
    size * 0.8
  );
  gradient.addColorStop(0, cosmetic.secondaryColor);
  gradient.addColorStop(0.46, "#4a2038");
  gradient.addColorStop(1, cosmetic.baseColor);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.save();
  context.globalCompositeOperation = "screen";
  for (let index = 0; index < 44; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const radiusX = 18 + random() * 75;
    const radiusY = 5 + random() * 22;
    const cloud = context.createRadialGradient(x, y, 0, x, y, radiusX);
    cloud.addColorStop(0, `rgba(227,177,202,${0.035 + random() * 0.07})`);
    cloud.addColorStop(1, "rgba(227,177,202,0)");
    context.fillStyle = cloud;
    context.save();
    context.translate(x, y);
    context.rotate((random() - 0.5) * 1.4);
    context.scale(1, radiusY / radiusX);
    context.beginPath();
    context.arc(0, 0, radiusX, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();
  addFineNoise(context, random, size, size, "#e8b3cc", "#08040a", 900);
}

export function getDiceSurfaceTexture(cosmeticId: DiceCosmeticId) {
  const cosmetic = getDiceCosmetic(cosmeticId);
  if (cosmetic.textureKind === "solid") return null;

  const cached = surfaceTextureCache.get(cosmetic.id);
  if (cached) return cached;
  if (typeof document === "undefined") return null;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const random = createRandom(hashSeed(cosmetic.id));
  if (cosmetic.textureKind === "bone") {
    drawBone(context, cosmetic, random, size);
  } else if (cosmetic.textureKind === "stone") {
    drawStone(context, cosmetic, random, size);
  } else if (cosmetic.textureKind === "marble") {
    drawMarble(context, cosmetic, random, size);
  } else {
    drawMist(context, cosmetic, random, size);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1.6, 1.6);
  texture.anisotropy = 4;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  surfaceTextureCache.set(cosmetic.id, texture);
  return texture;
}
