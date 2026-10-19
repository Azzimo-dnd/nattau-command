import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { calibrateGlb, glbCalibration, readGlb, scaleToReferenceHeight, miniatureFileFormat } from "../components/miniatures/miniatureGlb";
import { disposeMiniatureScene, instantiateMiniature, loadMiniatureAsset } from "../components/miniatures/miniatureAsset";
import { makeMiniatureGlb } from "./fixtures/miniatureGlb";

// GLTFLoader uses browser ProgressEvent even when parsing embedded buffers in Node.
if (!globalThis.ProgressEvent) Object.assign(globalThis, { ProgressEvent: class { constructor(public type: string) {} } });

test("calibration preserves every binary byte and original material/texture definitions", () => {
  const input = makeMiniatureGlb(true);
  const before = readGlb(input);
  const output = calibrateGlb(input, { version: 1, visualScale: 2.75, sourceFormat: "glb" });
  const after = readGlb(output);
  assert.deepEqual(new Uint8Array(output, 20 + after.jsonLength), new Uint8Array(input, 20 + before.jsonLength));
  assert.deepEqual({ ...after.json, asset: before.json.asset }, before.json);
  assert.equal(glbCalibration(after.json).visualScale, 2.75);
  assert.equal(glbCalibration(readGlb(calibrateGlb(output, { version: 1, visualScale: 0.5, sourceFormat: "glb" })).json).visualScale, 0.5);
});

test("multi-part scene preserves transforms/materials, rests on ground, and scales independently of file units", async () => {
  const input = calibrateGlb(makeMiniatureGlb(), { version: 1, visualScale: 1.5, sourceFormat: "glb" });
  const asset = await loadMiniatureAsset(new File([input], "hero.GLB"));
  try {
    assert.equal(asset.meshCount, 2); assert.equal(asset.triangles, 2); assert.equal(asset.visualScale, 1.5);
    const box = new THREE.Box3().setFromObject(asset.scene, true);
    assert.ok(Math.abs(box.min.y) < 1e-6);
    assert.ok(Math.abs((box.min.x + box.max.x) / 2) < 1e-6);
    assert.ok(asset.scene.getObjectByName("Sword"));
    assert.ok(Math.abs(Math.max(asset.width, asset.depth) * asset.baseScale - 0.82) < 1e-6);
    const original = asset.scene.getObjectByName("Body") as THREE.Mesh;
    const visible = instantiateMiniature(asset); const hidden = instantiateMiniature(asset, 0.42);
    const hiddenMaterial = (hidden.getObjectByName("Body") as THREE.Mesh).material as THREE.Material;
    const visibleMaterial = (visible.getObjectByName("Body") as THREE.Mesh).material as THREE.Material;
    assert.notEqual(hiddenMaterial, original.material); assert.equal(hiddenMaterial.opacity, 0.42); assert.equal(visibleMaterial.opacity, 1);
    disposeMiniatureScene(hidden, true); disposeMiniatureScene(visible, true);
    assert.equal((original.material as THREE.Material).opacity, 1);
  } finally { disposeMiniatureScene(asset.scene); }
});

test("rejects invalid formats, truncated GLBs and invalid scales before upload", async () => {
  assert.throws(() => miniatureFileFormat("hero.obj"), /STL or a GLB/);
  const buffer = makeMiniatureGlb();
  assert.throws(() => readGlb(buffer.slice(0, -4)), /valid.*GLB/);
  for (const scale of [0, -1, NaN, Infinity, 10.1]) assert.throws(() => calibrateGlb(buffer, { version: 1, visualScale: scale, sourceFormat: "glb" }), /scale/);
  assert.equal(scaleToReferenceHeight(2, 3), 1.5);
  assert.equal(scaleToReferenceHeight(0, 3), null);
  assert.equal(scaleToReferenceHeight(0.01, 3), null);
  await assert.rejects(loadMiniatureAsset(new File([], "empty.glb")), /non-empty/);
});
