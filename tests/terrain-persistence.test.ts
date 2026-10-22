import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteTerrainAsset, saveTerrainAsset, terrainRegistration, TerrainCleanupError, type TerrainAssetGateway, type TerrainRegistration } from "../lib/terrain/terrainAssetOperations";
import { TERRAIN_PRESETS } from "../lib/terrain/terrainTypes";
import type { TerrainAssetRow } from "../lib/terrain/terrainTypes";

const campaignId = "00000000-0000-4000-8000-000000000001";
const objectId = "00000000-0000-4000-8000-000000000002";
const file = new File([new Uint8Array(256)], "cargo.glb", {type:"model/gltf-binary"});
const recipe = TERRAIN_PRESETS[0].recipe;
const metrics = {width:1,depth:0.8,height:0.9,meshes:4,triangles:148,hasTextures:false};

function fakeGateway() {
  const files = new Map<string, File>();
  const records = new Map<string, TerrainRegistration>();
  const calls: string[] = [];
  let fail: "register" | "remove" | "delete" | null = null;
  const gateway: TerrainAssetGateway = {
    async upload(path, input) {
      calls.push("upload");
      if (files.has(path)) throw new Error("duplicate path");
      files.set(path,input);
    },
    async register(metadata) {
      calls.push("register");
      if (fail === "register") throw new Error("metadata rejected");
      records.set(metadata.storage_path, metadata);
    },
    async removeFile(path) {
      calls.push("remove");
      if (fail === "remove") throw new Error("storage offline");
      if (!files.delete(path)) throw new Error("file not present");
    },
    async deleteRecord(asset) {
      calls.push("delete");
      if (fail === "delete") throw new Error("database unavailable");
      const record = [...records.entries()].find(([key, entry]) => entry.campaign_id === asset.campaign_id && key.startsWith(asset.campaign_id));
      if (!record) return false;
      return records.delete(record[0]);
    },
  };
  return {gateway,files,records,calls,setFail:(next:typeof fail)=>{fail=next;}};
}
const input = () => ({campaignId,objectId,file,metrics,name:"  Cargo test  ",category:"cargo" as const,sourceKind:"generated" as const,recipe,scale:1.25});

test("terrain save registers file and metadata only after upload succeeds", async () => {
  const fake = fakeGateway();
  const created = await saveTerrainAsset(fake.gateway,input());
  assert.deepEqual(fake.calls,["upload","register"]);
  assert.equal(created.name,"Cargo test");
  assert.equal(created.default_scale,1.25);
  assert.equal(created.file_size_bytes,256);
  assert.ok(fake.files.has(created.storage_path));
  assert.ok(fake.records.has(created.storage_path));
});

test("failed registration compensates uploaded binary instead of leaving an orphan", async () => {
  const fake = fakeGateway(); fake.setFail("register");
  await assert.rejects(saveTerrainAsset(fake.gateway,input()),/metadata rejected/);
  assert.deepEqual(fake.calls,["upload","register","remove"]);
  assert.equal(fake.files.size,0); assert.equal(fake.records.size,0);
});

test("failed rollback reports the exact recoverable orphan path", async () => {
  const fake = fakeGateway();
  const gateway = {...fake.gateway,register:async () => {throw new Error("db offline");},removeFile:async () => {throw new Error("storage offline");}};
  await assert.rejects(saveTerrainAsset(gateway,input()), (cause) => {
    assert.ok(cause instanceof TerrainCleanupError);
    assert.match(cause.orphanPath,/000000000002.glb$/);
    assert.match(cause.message,/db offline/);
    return true;
  });
});

test("delete never removes a file if metadata delete fails", async () => {
  const fake = fakeGateway();
  const created = await saveTerrainAsset(fake.gateway,input());
  fake.setFail("delete");
  const asset = {id:objectId,campaign_id:campaignId,storage_path:created.storage_path};
  await assert.rejects(deleteTerrainAsset(fake.gateway,asset),/database unavailable/);
  assert.equal(fake.files.size,1);assert.equal(fake.records.size,1);
});

test("delete tracks storage orphan after a committed metadata deletion", async () => {
  const fake = fakeGateway();
  const created = await saveTerrainAsset(fake.gateway,input());
  fake.setFail("remove");
  await assert.rejects(deleteTerrainAsset(fake.gateway,{id:objectId,campaign_id:campaignId,storage_path:created.storage_path}), (cause) => {
    assert.ok(cause instanceof TerrainCleanupError);
    assert.equal(cause.orphanPath,created.storage_path);
    return true;
  });
  assert.equal(fake.records.size,0);
  assert.equal(fake.files.size,1);
});

test("invalid metadata never uploads a binary", async () => {
  const fake = fakeGateway();
  const cases = [
    {...input(), scale: 0},
    {...input(), name:" "},
    {...input(), metrics:{...metrics,triangles:Infinity}},
    {...input(), campaignId:"../../"},
    {...input(), category:"attack" as "cargo"},
    {...input(),sourceKind:"uploaded" as const},
  ];
  for(const testCase of cases) await assert.rejects(saveTerrainAsset(fake.gateway,testCase));
  assert.equal(fake.calls.length,0);
  assert.throws(()=>terrainRegistration({...input(),file:new File([],"empty.glb")}),/valid self-contained/);
});
