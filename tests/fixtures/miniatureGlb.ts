/** Small, deterministic multi-part fixture; no proprietary character assets. */
export function makeMiniatureGlb(textured = false) {
  const positions = new Float32Array([-0.5,0,0, 0.5,0,0, 0,1.6,0]);
  const uv = new Float32Array([0,0, 1,0, 0.5,1]);
  // Two-colour embedded PNG, rendered by browser regression checks.
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGElEQVR4nAXBAQEAAAjDIG7/zhMWiRPGAzIHBAEZ7zcwAAAAAElFTkSuQmCC"), (char) => char.charCodeAt(0));
  const bin = new Uint8Array(Math.ceil((positions.byteLength + uv.byteLength + (textured ? png.length : 0)) / 4) * 4);
  bin.set(new Uint8Array(positions.buffer)); bin.set(new Uint8Array(uv.buffer), positions.byteLength);
  if (textured) bin.set(png, positions.byteLength + uv.byteLength);
  const json = {
    asset: { version: "2.0", generator: "miniature-regression-fixture" },
    scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: "Character", translation: [3, 2, -1], children: [1, 2] }, { name: "Body", mesh: 0 }, { name: "Sword", mesh: 1, translation: [0.8, 0.4, 0], scale: [0.3, 1, 1] }],
    meshes: [0,1].map((material) => ({ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material }] })),
    materials: [{ name: "Cloth", doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1,1,1,1], metallicFactor: 0, ...(textured ? { baseColorTexture: { index: 0 } } : {}) } }, { name: "Steel", doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.1,0.6,1,1], metallicFactor: 0 } }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [-0.5,0,0], max: [0.5,1.6,0] }, { bufferView: 1, componentType: 5126, count: 3, type: "VEC2" }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }, { buffer: 0, byteOffset: positions.byteLength, byteLength: uv.byteLength }, ...(textured ? [{ buffer: 0, byteOffset: positions.byteLength + uv.byteLength, byteLength: png.length }] : [])],
    ...(textured ? { images: [{ bufferView: 2, mimeType: "image/png" }], textures: [{ source: 0 }] } : {}),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  const padded = Math.ceil(bytes.length / 4) * 4;
  const buffer = new ArrayBuffer(28 + padded + bin.length);
  const data = new DataView(buffer);
  data.setUint32(0, 0x46546c67, true); data.setUint32(4, 2, true); data.setUint32(8, buffer.byteLength, true);
  data.setUint32(12, padded, true); data.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer).fill(32, 20, 20 + padded); new Uint8Array(buffer).set(bytes, 20);
  data.setUint32(20 + padded, bin.length, true); data.setUint32(24 + padded, 0x004e4942, true);
  new Uint8Array(buffer).set(bin, 28 + padded);
  return buffer;
}
