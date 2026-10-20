import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const migration = readFileSync(new URL("../supabase/migrations/20261020103000_vtt_terrain_asset_studio_alpha.sql", import.meta.url), "utf8");
const uuid = (n: number) => "00000000-0000-4000-8000-" + String(n).padStart(12,"0");
const [nattau, barovia, gm, player, outsider, fileId] = Array.from({length:6},(_,i)=>uuid(i+1));
const path = nattau + "/" + fileId + ".glb";
const insertSQL = "insert into vtt_terrain_assets (campaign_id,name,category,source_kind,storage_path,original_name,file_size_bytes,mesh_count,triangle_count,width_units,height_units,depth_units,generator_recipe) values ($1,'Cargo','cargo','generated',$2,'cargo.glb',4096,8,120,1,1,1,$3::jsonb)";
async function asUser<T>(id:string, fn:()=>Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec("set role authenticated");
  try { return await fn(); } finally { await db.exec("reset role"); }
}
before(async () => {
  await db.exec([
    "create role anon; create role authenticated; create role service_role;",
    "create schema auth; create table auth.users(id uuid primary key);",
    "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    "create table public.campaigns(id uuid primary key);",
    "create table public.test_members(campaign_id uuid,user_id uuid,role text);",
    "create function public.is_campaign_dm(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.test_members where campaign_id=p_id and user_id=auth.uid() and role='dm') $$;",
    "create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);",
    "create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);",
    "alter table storage.objects enable row level security;",
    "grant usage on schema auth,storage to authenticated;",
    "grant select,insert,delete on storage.objects to authenticated;"
  ].join("\n"));
  await db.query("insert into auth.users(id) values ($1),($2),($3)",[gm,player,outsider]);
  await db.query("insert into campaigns values ($1),($2)",[nattau,barovia]);
  await db.query("insert into test_members values ($1,$2,'dm'),($3,$4,'player')",[nattau,gm,barovia,player]);
  await db.exec(migration);
});
after(async ()=>{ await db.close(); });

test("private terrain bucket and campaign GM-only RLS", async () => {
  const bucket = await db.query("select public from storage.buckets where id='vtt-terrain-assets'");
  assert.deepEqual(bucket.rows,[{public:false}]);
  await asUser(gm,async () => {
    await db.query(insertSQL,[nattau,path,JSON.stringify({kind:"crate",seed:1})]);
    assert.equal((await db.query("select name from vtt_terrain_assets")).rows.length,1);
    const decision = await db.query<{campaign:string|null;allowed:boolean;matches:boolean}>(
      "select public.vtt_terrain_path_campaign($1) as campaign,public.is_campaign_dm(public.vtt_terrain_path_campaign($1)) as allowed,$1::text ~ $2 as matches",
      [path,"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.glb$"]);
    assert.equal(decision.rows[0].campaign,nattau,JSON.stringify(decision.rows[0]));
    assert.equal(decision.rows[0].allowed,true,JSON.stringify(decision.rows[0]));
    assert.equal(decision.rows[0].matches,true,JSON.stringify(decision.rows[0]));
    try { await db.query("insert into storage.objects(bucket_id,name) values ('vtt-terrain-assets',$1)",[path]); }
    catch (cause) { const policies = await db.query("select policyname,cmd,with_check from pg_policies where schemaname='storage' and tablename='objects'"); throw new Error("GM storage insert: "+(cause instanceof Error ? cause.message : String(cause))+"; policies: "+JSON.stringify(policies.rows)); }
    assert.equal((await db.query("select name from storage.objects")).rows.length,1);
  });
  await asUser(player,async () => {
    assert.equal((await db.query("select * from vtt_terrain_assets")).rows.length,0);
    assert.equal((await db.query("select * from storage.objects")).rows.length,0);
    await assert.rejects(db.query(insertSQL,[nattau,nattau+"/"+uuid(11)+".glb",JSON.stringify({kind:"crate"})]),/row-level security|permission denied/i);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('vtt-terrain-assets',$1)",[path]),/row-level security|permission denied/i,"Player should not upload terrain.");
  });
});

test("immutable identity fields and cross-campaign keys", async () => {
  await asUser(gm,async () => {
    await assert.rejects(db.query("update vtt_terrain_assets set storage_path=$1 where storage_path=$2",[nattau+"/"+uuid(11)+".glb",path]),/immutable/i);
    await assert.rejects(db.query(insertSQL,[nattau,barovia+"/"+uuid(12)+".glb",JSON.stringify({kind:"crate"})]),/terrain_asset_storage_key/i);
  });
});

test("GM can edit a saved asset and remove metadata + file; players cannot mutate it", async () => {
  await asUser(player, async () => {
    assert.equal((await db.query("update vtt_terrain_assets set name='hijacked' returning id")).rows.length,0);
    assert.equal((await db.query("delete from vtt_terrain_assets returning id")).rows.length,0);
    assert.equal((await db.query("delete from storage.objects returning id")).rows.length,0);
  });
  await asUser(gm, async () => {
    const changed = await db.query("update vtt_terrain_assets set name='UC Crates', status='approved', default_scale=1.6 where storage_path=$1 returning name,status,default_scale,updated_at",[path]);
    assert.equal(changed.rows.length,1);
    assert.equal(changed.rows[0].name,"UC Crates");
    assert.equal(changed.rows[0].status,"approved");
    assert.equal(changed.rows[0].default_scale,1.6);
    assert.equal((await db.query("delete from vtt_terrain_assets where storage_path=$1 returning id",[path])).rows.length,1);
    assert.equal((await db.query("delete from storage.objects where name=$1 returning id",[path])).rows.length,1);
    assert.equal((await db.query("select * from vtt_terrain_assets")).rows.length,0);
    assert.equal((await db.query("select * from storage.objects")).rows.length,0);
  });
});

test("invalid paths are denied safely without throwing UUID cast errors", async () => {
  const result = await db.query("select public.vtt_terrain_path_campaign('not-a-uuid/test.glb') as campaign");
  assert.equal(result.rows[0].campaign,null);
  await asUser(gm,async () => {
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('vtt-terrain-assets','not-a-uuid/test.glb')"),/row-level security/i);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('vtt-terrain-assets',$1)",[nattau+"/file.txt"]),/row-level security/i);
  });
});
