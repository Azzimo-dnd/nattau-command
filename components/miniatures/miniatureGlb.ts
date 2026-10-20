// Keep calibration in the GLB asset metadata. Updating this JSON chunk preserves
// every mesh, material, texture, extension and byte of the original binary data.
export const MAX_MINIATURE_MB = 75;
export const MAX_MINIATURE_BYTES = MAX_MINIATURE_MB * 1024 * 1024;
export const MINIATURE_FILE_LIMIT = `${MAX_MINIATURE_MB} MB`;
export const MIN_VISUAL_SCALE = 0.1;
export const MAX_VISUAL_SCALE = 10;
export const MINIATURE_FOOTPRINT = 0.82;

export type MiniatureCalibration = { version: 1; visualScale: number; sourceFormat: "stl" | "glb" };
type GlbJson = {
  asset: { version: string; extras?: Record<string, unknown> };
  buffers?: { uri?: string }[];
  images?: { uri?: string; mimeType?: string }[];
  extensionsRequired?: string[];
};

export function validVisualScale(value: number) {
  return Number.isFinite(value) && value >= MIN_VISUAL_SCALE && value <= MAX_VISUAL_SCALE;
}

export function miniatureFileFormat(name: string): "stl" | "glb" {
  if (/\.glb$/i.test(name)) return "glb";
  if (/\.stl$/i.test(name)) return "stl";
  throw new Error("Choose an STL or a GLB with embedded PNG/JPEG textures.");
}

export function readGlb(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) {
    throw new Error("This is not a valid glTF 2.0 binary (GLB) file.");
  }
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || jsonLength % 4 || jsonLength > buffer.byteLength - 20) throw new Error("Invalid GLB JSON chunk.");
  let offset = 20 + jsonLength;
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) throw new Error("Truncated GLB chunk.");
    const length = view.getUint32(offset, true);
    if (length % 4 || length > buffer.byteLength - offset - 8) throw new Error("Invalid GLB chunk length.");
    offset += 8 + length;
  }
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)).trim()) as GlbJson;
  if (json.asset?.version !== "2.0") throw new Error("Only glTF 2.0 models are supported.");
  // Private assets must be self-contained; do not silently fetch remote textures.
  for (const resource of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (resource.uri && !resource.uri.startsWith("data:")) throw new Error("This GLB references external files. Export it again with textures and buffers embedded.");
  }
  if (json.extensionsRequired?.includes("KHR_texture_basisu") || json.images?.some((image) => image.mimeType === "image/ktx2")) {
    throw new Error("KTX2 textures are not supported yet. Export this GLB with embedded PNG/JPEG textures.");
  }
  if (json.extensionsRequired?.includes("KHR_draco_mesh_compression")) {
    throw new Error("Export this GLB without Draco compression, keeping its textures embedded.");
  }
  return { json, jsonLength };
}

export function glbCalibration(json: GlbJson): MiniatureCalibration {
  const value = json.asset.extras?.nattauMiniature as Partial<MiniatureCalibration> | undefined;
  return {
    version: 1,
    visualScale: value?.version === 1 && validVisualScale(value.visualScale ?? NaN) ? value.visualScale! : 1,
    sourceFormat: value?.sourceFormat === "stl" ? "stl" : "glb",
  };
}

export function calibrateGlb(buffer: ArrayBuffer, calibration: MiniatureCalibration): ArrayBuffer {
  if (!validVisualScale(calibration.visualScale)) throw new Error("Visual scale must be between 10% and 1000%.");
  const { json, jsonLength } = readGlb(buffer);
  json.asset.extras = { ...json.asset.extras, nattauMiniature: calibration };
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const paddedLength = Math.ceil(encoded.length / 4) * 4;
  const tail = new Uint8Array(buffer, 20 + jsonLength);
  const result = new ArrayBuffer(20 + paddedLength + tail.length);
  if (result.byteLength > MAX_MINIATURE_BYTES) throw new Error(`The prepared GLB exceeds the ${MINIATURE_FILE_LIMIT} limit.`);
  const output = new Uint8Array(result);
  output.set(new Uint8Array(buffer, 0, 20));
  new DataView(result).setUint32(8, result.byteLength, true);
  new DataView(result).setUint32(12, paddedLength, true);
  output.fill(0x20, 20, 20 + paddedLength);
  output.set(encoded, 20);
  output.set(tail, 20 + paddedLength);
  return result;
}

export function scaleToReferenceHeight(height: number, referenceHeight: number) {
  if (!Number.isFinite(height) || !Number.isFinite(referenceHeight) || height <= 0 || referenceHeight <= 0) return null;
  const scale = referenceHeight / height;
  return validVisualScale(scale) ? scale : null;
}
