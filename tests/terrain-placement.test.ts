import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { clampTerrainPoint, normalizeTerrainRotation, terrainDragPoint } from "../components/vtt/terrainSceneTypes";

const db = new PGlite();
const uuid = (n:number) => "00000000-0000-4000-8000-" + String(n).padStart(12,"0");
const [nattau,barovia,gm,player,outsider,scene,asset,otherScene,otherAsset]=Array.from({length:9},(_,i)=>uuid(i+1));
const initial=readFileSync(new URL("../supabase/migrations/20261020102957_vtt_terrain_asset_studio_alpha.sql",import.meta.url),"utf8");
const placement=readFileSync(new URL("../supabase/migrations/20261020111442_vtt_scene_terrain_instances_alpha.sql",import.meta.url),"utf8");

async function asUser<T>(user:string,fn:()=>Promise<T>){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  await db.exec("set role authenticated");
  try{return await fn();}finally{await db.exec("reset role");}
}
before(async ()=>{
  await db.exec([
    "create role anon;create role authenticated;create role service_role;",
    "create schema auth;create table auth.users(id uuid primary key);",
    "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    "create table public.campaigns(id uuid primary key);",
    "create table public.test_members(campaign_id uuid,user_id uuid,role text);",
    "create function public.is_campaign_dm(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.test_members where campaign_id=p_id and user_id=auth.uid() and role='dm') $$;",
    "create table public.vtt_scenes(id uuid primary key,campaign_id uuid,grid_width integer,grid_height integer);",
    "create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);",
    "create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);",
    "alter table storage.objects enable row level security;",
    "grant usage on schema auth,storage to authenticated;",
    "grant select,insert,delete on storage.objects to authenticated;",
    "grant select on public.vtt_scenes to authenticated;"
  ].join("\n"));
  await db.query("insert into auth.users values ($1),($2),($3)",[gm,player,outsider]);
  await db.query("insert into campaigns values ($1),($2)",[nattau,barovia]);
  await db.query("insert into test_members values ($1,$2,'dm'),($3,$4,'player')",[nattau,gm,barovia,player]);
  await db.query("insert into vtt_scenes values ($1,$2,24,18),($3,$4,24,18)",[scene,nattau,otherScene,barovia]);
  await db.exec(initial);
  await db.query("insert into vtt_terrain_assets(id,campaign_id,name,category,source_kind,storage_path,original_name,file_size_bytes,mesh_count,triangle_count,width_units,height_units,depth_units,generator_recipe,created_by) values ($1,$2,'Crate','cargo','generated',$3,'crate.glb',2048,2,48,1,1,1,$8::jsonb,$4),($5,$6,'Secret crate','cargo','generated',$7,'secret.glb',2048,2,48,1,1,1,$8::jsonb,$4)",
    [asset,nattau,nattau+"/"+uuid(90)+".glb",gm,otherAsset,barovia,barovia+"/"+uuid(91)+".glb",JSON.stringify({kind:"crate",seed:4})]);
  await db.exec(placement);
});
after(async()=>await db.close());

test("GM can place, select, transform and remove scene terrain",async()=>{
  await asUser(gm,async()=>{
    const created=await db.query<{id:string}>(
      "insert into vtt_scene_terrain_instances(campaign_id,scene_id,terrain_asset_id,position_x,position_z,scale) values ($1,$2,$3,3,-2,1.5) returning id",
      [nattau,scene,asset]);
    assert.equal(created.rows.length,1);
    const id=created.rows[0].id;
    const visible=await db.query<{position_x:number;scale:number}>("select position_x,scale from vtt_scene_terrain_instances where id=$1",[id]);
    assert.deepEqual(visible.rows,[{position_x:3,scale:1.5}]);
    await db.query("update vtt_scene_terrain_instances set rotation_y=$1,scale=2 where id=$2",[Math.PI/4,id]);
    assert.equal((await db.query("delete from vtt_scene_terrain_instances where id=$1 returning id",[id])).rows.length,1);
  });
});

test("non-GM cannot read, insert, update or delete placed terrain",async()=>{
  await asUser(gm,async()=>{
    await db.query("insert into vtt_scene_terrain_instances(campaign_id,scene_id,terrain_asset_id,position_x,position_z) values ($1,$2,$3,0,0)",[nattau,scene,asset]);
  });
  await asUser(player,async()=>{
    assert.equal((await db.query("select * from vtt_scene_terrain_instances")).rows.length,0);
    assert.equal((await db.query("update vtt_scene_terrain_instances set scale=3 returning id")).rows.length,0);
    assert.equal((await db.query("delete from vtt_scene_terrain_instances returning id")).rows.length,0);
    await assert.rejects(db.query("insert into vtt_scene_terrain_instances(campaign_id,scene_id,terrain_asset_id,position_x,position_z) values ($1,$2,$3,0,0)",[nattau,scene,asset]),/row.level.security|permission denied|unavailable for this campaign/i);
  });
});

test("a GM cannot place terrain from another campaign, into another scene, or out of bounds",async()=>{
  await asUser(gm,async()=>{
    for(const [sc,as,x,z] of [[scene,otherAsset,0,0],[otherScene,asset,0,0],[scene,asset,500,0]] as const){
      await assert.rejects(db.query("insert into vtt_scene_terrain_instances(campaign_id,scene_id,terrain_asset_id,position_x,position_z) values ($1,$2,$3,$4,$5)",[nattau,sc,as,x,z]),/does not belong|unavailable|outside the scene/i);
    }
  });
});

test("instance ownership cannot be changed after placement",async()=>{
  await asUser(gm,async()=>{
    await assert.rejects(db.query("update vtt_scene_terrain_instances set terrain_asset_id=$1",[otherAsset]),/cannot change|unavailable for this campaign/i);
  });
});

test("placement geometry clamps to bounds and normalizes rotation",()=>{
  assert.deepEqual(clampTerrainPoint(100,-100,24,18),[11.5,-8.5]);
  assert.deepEqual(clampTerrainPoint(1,-2,24,18),[1,-2]);
  assert.ok(Math.abs(normalizeTerrainRotation(-Math.PI/2)-3*Math.PI/2)<1e-10);
  assert.throws(()=>clampTerrainPoint(NaN,0,24,18),/Invalid/);
});

test("terrain drag keeps mouse grab offset and clamps to the battlefield",()=>{
  assert.deepEqual(terrainDragPoint([2,3],[2.2,3.2],[4.7,1.9],24,18,false),[4.5,1.6999999999999997]);
  assert.deepEqual(terrainDragPoint([11,0],[1,0],[100,0],24,18,false),[11.5,0]);
  assert.deepEqual(terrainDragPoint([0,0],[0.2,0.2],[0.2,0.2],24,18,false),[0,0]);
  assert.throws(()=>terrainDragPoint([0,0],[0,0],[NaN,1],24,18,false),/Invalid terrain pointer/);
});

test("terrain grid snap centers props on cells when requested",()=>{
  assert.deepEqual(terrainDragPoint([0,0],[0,0],[2.4,3.4],24,18,true),[2.5,3.5]);
  assert.deepEqual(terrainDragPoint([0,0],[0,0],[-100,100],24,18,true),[-11.5,8.5]);
});
