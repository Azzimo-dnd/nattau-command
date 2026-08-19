import * as THREE from "three";

export type PaletteCategory = "Primer" | "Skin" | "Cloth" | "Leather" | "Metal" | "Natural" | "Magic" | "Custom";

export type MiniaturePaintPaletteEntry = {
  name: string;
  color: string;
  category: PaletteCategory;
};

export type MiniaturePaintDocument = {
  version: 1;
  triangleCount: number;
  palette: MiniaturePaintPaletteEntry[];
  runs: Array<[materialId: number, count: number]>;
};

const CATEGORIES = new Set<PaletteCategory>(["Primer", "Skin", "Cloth", "Leather", "Metal", "Natural", "Magic", "Custom"]);
const MAX_PALETTE_SIZE = 250;

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function createMiniaturePaintDocument(
  triangleCount: number,
  palette: MiniaturePaintPaletteEntry[],
  paintIds: Uint8Array,
): MiniaturePaintDocument {
  if (triangleCount !== paintIds.length) throw new Error("Paint data does not match the miniature triangle count.");
  if (palette.length < 1 || palette.length > MAX_PALETTE_SIZE) throw new Error("Paint palette is invalid.");

  const runs: Array<[number, number]> = [];
  if (paintIds.length > 0) {
    let materialId = paintIds[0];
    let count = 1;
    for (let index = 1; index < paintIds.length; index += 1) {
      const next = paintIds[index];
      if (next === materialId) {
        count += 1;
      } else {
        runs.push([materialId, count]);
        materialId = next;
        count = 1;
      }
    }
    runs.push([materialId, count]);
  }

  return {
    version: 1,
    triangleCount,
    palette: palette.map((entry) => ({ ...entry })),
    runs,
  };
}

export function parseMiniaturePaintDocument(value: unknown): MiniaturePaintDocument {
  if (!value || typeof value !== "object") throw new Error("Paint skin file is not a valid document.");
  const source = value as Record<string, unknown>;
  if (source.version !== 1) throw new Error("Unsupported miniature paint skin version.");
  if (!Number.isInteger(source.triangleCount) || Number(source.triangleCount) < 0) throw new Error("Paint skin triangle count is invalid.");
  if (!Array.isArray(source.palette) || source.palette.length < 1 || source.palette.length > MAX_PALETTE_SIZE) throw new Error("Paint skin palette is invalid.");

  const palette = source.palette.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Paint skin palette entry is invalid.");
    const entry = raw as Record<string, unknown>;
    if (typeof entry.name !== "string" || entry.name.length < 1 || entry.name.length > 80) throw new Error("Paint skin palette name is invalid.");
    if (!isHexColor(entry.color)) throw new Error("Paint skin palette color is invalid.");
    if (typeof entry.category !== "string" || !CATEGORIES.has(entry.category as PaletteCategory)) throw new Error("Paint skin palette category is invalid.");
    return {
      name: entry.name,
      color: entry.color,
      category: entry.category as PaletteCategory,
    };
  });

  if (!Array.isArray(source.runs)) throw new Error("Paint skin run data is invalid.");
  let total = 0;
  const runs: Array<[number, number]> = source.runs.map((raw) => {
    if (!Array.isArray(raw) || raw.length !== 2) throw new Error("Paint skin run is invalid.");
    const materialId = Number(raw[0]);
    const count = Number(raw[1]);
    if (!Number.isInteger(materialId) || materialId < 0 || materialId >= palette.length) throw new Error("Paint skin references an invalid material.");
    if (!Number.isInteger(count) || count <= 0) throw new Error("Paint skin run length is invalid.");
    total += count;
    return [materialId, count];
  });

  const triangleCount = Number(source.triangleCount);
  if (total !== triangleCount) throw new Error("Paint skin data is incomplete for this miniature.");

  return { version: 1, triangleCount, palette, runs };
}

export function decodeMiniaturePaintIds(document: MiniaturePaintDocument): Uint8Array {
  const ids = new Uint8Array(document.triangleCount);
  let offset = 0;
  for (const [materialId, count] of document.runs) {
    ids.fill(materialId, offset, offset + count);
    offset += count;
  }
  if (offset !== document.triangleCount) throw new Error("Paint skin data does not match its declared triangle count.");
  return ids;
}

export function applyMiniaturePaintDocumentToGeometry(
  geometry: THREE.BufferGeometry,
  document: MiniaturePaintDocument,
): boolean {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!position) return false;
  const triangleCount = Math.floor(position.count / 3);
  if (triangleCount !== document.triangleCount) return false;

  const ids = decodeMiniaturePaintIds(document);
  const colors = document.palette.map((entry) => new THREE.Color(entry.color));
  const colorAttribute = new THREE.BufferAttribute(new Float32Array(triangleCount * 9), 3);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const color = colors[ids[triangle]] ?? colors[0];
    const offset = triangle * 3;
    colorAttribute.setXYZ(offset, color.r, color.g, color.b);
    colorAttribute.setXYZ(offset + 1, color.r, color.g, color.b);
    colorAttribute.setXYZ(offset + 2, color.r, color.g, color.b);
  }
  colorAttribute.needsUpdate = true;
  geometry.setAttribute("color", colorAttribute);
  return true;
}

export function clearMiniaturePaintGeometry(geometry: THREE.BufferGeometry) {
  if (geometry.getAttribute("color")) geometry.deleteAttribute("color");
}

export function serializeMiniaturePaintDocument(document: MiniaturePaintDocument) {
  return JSON.stringify(document);
}
