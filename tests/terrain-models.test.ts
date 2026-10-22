import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { TERRAIN_PRESETS } from "../lib/terrain/terrainTypes";
import { createTerrainModel, disposeTerrainModel, validateTerrainRecipe } from "../lib/terrain/terrainGeometry";
import { generateTerrainFile, readTerrainFile, terrainMetrics, validateTerrainFile } from "../lib/terrain/terrainModels";
import { readGlb } from "../components/miniatures/miniatureGlb";

if (!globalThis.ProgressEvent) Object.assign(globalThis, { ProgressEvent: class { constructor(public type: string) {} } });
// GLTFExporter uses FileReader in browsers; this minimal polyfill is only for Node CI.
if (!globalThis.FileReader) Object.assign(globalThis, { FileReader: class {
  result: ArrayBuffer | string | null = null;
  onloadend: ((event: unknown) => void) | null = null;
  onload: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  private load(blob: Blob, dataURL: boolean) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = dataURL ? "data:" + (blob.type || "application/octet-stream") + ";base64," + Buffer.from(buffer).toString("base64") : buffer;
      this.onload?.({target:this}); this.onloadend?.({target:this});
    }).catch((cause) => this.onerror?.(cause));
  }
  readAsArrayBuffer(blob: Blob) { this.load(blob,false); }
  readAsDataURL(blob: Blob) { this.load(blob,true); }
} });

test("eight UC terrain presets generate actual grounded 3D meshes", () => {
  assert.equal(TERRAIN_PRESETS.length, 8);
  const categories = new Set();
  for (const preset of TERRAIN_PRESETS) {
    categories.add(preset.category);
    const model = createTerrainModel(preset.recipe);
    try {
      const stats = terrainMetrics(model);
      const box = new THREE.Box3().setFromObject(model, true);
      assert.ok(stats.meshes > 0 && stats.triangles >= 12, preset.name);
      assert.ok(stats.width > 0.1 && stats.height > 0.1 && stats.depth > 0.05, preset.name);
      assert.ok(Math.abs(box.min.y) < 1e-5, preset.name + " must stand on floor");
      assert.ok(Math.abs(box.min.x + box.max.x) < 1e-5, preset.name + " centered X");
      assert.ok(Math.abs(box.min.z + box.max.z) < 1e-5, preset.name + " centered Z");
      assert.equal(stats.hasTextures, false);
    } finally { disposeTerrainModel(model); }
  }
  assert.deepEqual([...categories].sort(), ["cargo","cover","wreckage"]);
});

test("same recipe and seed reproduce identical geometry and stats", () => {
  const recipe = TERRAIN_PRESETS[4].recipe;
  const a = createTerrainModel(recipe), b = createTerrainModel({...recipe});
  try {
    assert.deepEqual(terrainMetrics(a),terrainMetrics(b));
    const meshes = (obj: THREE.Object3D) => {
      const snapshot: number[][] = [];
      obj.traverse((child) => { if (child instanceof THREE.Mesh) {
        child.updateMatrixWorld(true);
        snapshot.push([...child.matrixWorld.elements, ...Array.from(child.geometry.getAttribute("position").array as ArrayLike<number>)]);
      }});
      return snapshot;
    };
    assert.deepEqual(meshes(a),meshes(b));
  } finally { disposeTerrainModel(a); disposeTerrainModel(b); }
});

test("reject unsafe procedural parameters and invalid terrain imports", () => {
  const source = TERRAIN_PRESETS[0].recipe;
  if (source.kind !== "crate") throw new Error("Test fixture must be crate.");
  assert.throws(() => validateTerrainRecipe({...source,seed:-1}),/Seed/);
  assert.throws(() => validateTerrainRecipe({...source,seed:1.2}),/integer/);
  assert.throws(() => validateTerrainRecipe({...source,width:NaN}),/Width/);
  assert.throws(() => validateTerrainFile(new File([],"broken.obj")),/self-contained/);
  assert.throws(() => validateTerrainFile(new File([],"broken.glb")),/20 bytes/);
});

test("procedural GLB export is self-contained and can be imported again", async () => {
  const preset = TERRAIN_PRESETS[0];
  const exported = await generateTerrainFile(preset.recipe, preset.id);
  const { json } = readGlb(await exported.file.arrayBuffer());
  assert.equal(json.asset.version,"2.0");
  assert.equal(json.buffers?.[0]?.uri,undefined);
  const parsed = await readTerrainFile(exported.file);
  try {
    assert.ok(parsed.metrics.triangles > 12);
    assert.ok(Math.abs(parsed.metrics.width-exported.metrics.width) < 0.0001);
    const box = new THREE.Box3().setFromObject(parsed.model, true);
    assert.ok(Math.abs(box.min.y) < 1e-5);
  } finally { disposeTerrainModel(parsed.model); }
});
