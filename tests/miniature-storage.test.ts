import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [campaign, other, gm, player, outsider, stl, glb, absent] = Array.from({length: 8}, (_, i) => id(i + 1));
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/character-miniatures-v2-textured-glb.sql");
const limitMigration = read("supabase/migrations/20261020053537_miniature_file_limit_75mb.sql");
const LIMIT = 75 * 1024 * 1024;
async function as(user: string, action: () => Promise<void>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
  try { await action(); } finally { await db.exec("reset role"); }
}
async function register(model: string, format = "glb", sourceCampaign = campaign, web = `${sourceCampaign}/${player}/${model}.web.glb`, sourceSize = 100, webSize = 120) {
  return db.query("select register_character_miniature_asset($1,$2,$3,$4,$5,$6,$7,2,30,20,40) as id", [sourceCampaign, player, `${sourceCampaign}/${player}/${model}.${format}`, web, `hero.${format}`, sourceSize, webSize]);
}
before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create schema storage; create table storage.objects(bucket_id text, name text);
    create table storage.buckets(id text primary key, file_size_limit bigint);
    insert into storage.buckets values ('character-miniatures',52428800),('vtt-enemy-models',52428800),('maps',20971520);
    create table campaigns(id uuid primary key);
    create function is_campaign_dm(c uuid) returns boolean language sql as $$ select c='${campaign}' and auth.uid()='${gm}' $$;
    create function is_active_campaign_player(c uuid,p uuid) returns boolean language sql as $$ select c='${campaign}' and p='${player}' $$;
    insert into campaigns values ('${campaign}'),('${other}');
    insert into auth.users values ('${gm}'),('${player}'),('${outsider}');
  `);
  const initial = read("supabase/character-miniatures-v1.sql");
  await db.exec(initial.slice(initial.indexOf("create table if not exists public.character_miniatures"), initial.indexOf("create or replace function public.is_active_campaign_player")));
  const webMigration = read("supabase/character-miniatures-v1-2-web-glb.sql");
  await db.exec(webMigration.slice(webMigration.indexOf("alter table public.character_miniatures"), webMigration.indexOf("create unique index")));
  await db.exec(webMigration.slice(webMigration.indexOf("create or replace function public.attach_character_miniature_web_derivative"), webMigration.indexOf("-- Return the optional derivative")));
  const enemyMigration = read("supabase/vtt-alpha-v0-1.sql");
  await db.exec(enemyMigration.slice(enemyMigration.indexOf("create table if not exists public.vtt_enemy_models"), enemyMigration.indexOf("create index if not exists vtt_enemy_models_campaign_idx")));
  await db.exec(migration);
  await db.exec(limitMigration);
  for (const [model, format] of [[stl, "stl"], [glb, "glb"]]) {
    await db.query("insert into storage.objects values ('character-miniatures',$1),('character-miniatures',$2)", [`${campaign}/${player}/${model}.${format}`, `${campaign}/${player}/${model}.web.glb`]);
  }
});
after(async () => { await db.close(); });
test("registers source and calibrated web GLB together; switches current version atomically", async () => {
  await as(gm, async () => {
    assert.deepEqual((await register(stl, "stl")).rows, [{ id: stl }]);
    await assert.rejects(register(absent), /Both the source and web/);
  });
  assert.deepEqual((await db.query("select id from character_miniatures where is_current")).rows, [{ id: stl }]);
  await as(gm, async () => { assert.deepEqual((await register(glb)).rows, [{ id: glb }]); });
  assert.deepEqual((await db.query("select id,format,web_storage_path from character_miniatures where is_current")).rows, [{ id: glb, format: "glb", web_storage_path: `${campaign}/${player}/${glb}.web.glb` }]);
  assert.equal((await db.query<{n: number}>("select count(*)::int n from character_miniatures")).rows[0].n, 2);
});
test("players, outsiders, cross-campaign paths and anonymous calls are rejected", async () => {
  for (const user of [player, outsider]) await as(user, async () => { await assert.rejects(register(glb), /Game Master/); });
  await as(gm, async () => {
    await assert.rejects(register(glb, "glb", other), /Game Master/);
    await assert.rejects(register(glb, "glb", campaign, `${other}/${player}/${glb}.web.glb`), /Invalid miniature storage path/);
  });
  await db.exec("set role anon");
  try { await assert.rejects(register(glb), /permission denied/); } finally { await db.exec("reset role"); }
  await db.exec(migration);
  await db.exec(limitMigration);
});

test("75 MB boundary works through character registration and legacy web attachment", async () => {
  const model = id(20);
  const source = `${campaign}/${player}/${model}.glb`;
  const web = `${campaign}/${player}/${model}.web.glb`;
  await db.query("insert into storage.objects values ('character-miniatures',$1),('character-miniatures',$2)", [source, web]);
  await as(gm, async () => {
    for (const [sourceSize, webSize] of [[0, LIMIT], [LIMIT, 0], [LIMIT + 1, LIMIT], [LIMIT, LIMIT + 1]]) {
      await assert.rejects(register(model, "glb", campaign, web, sourceSize, webSize), /75 MB/);
    }
    await register(model, "glb", campaign, web, LIMIT, LIMIT);
    await db.query("select attach_character_miniature_web_derivative($1,$2,$3)", [model, web, LIMIT]);
    await assert.rejects(db.query("select attach_character_miniature_web_derivative($1,$2,$3)", [model, web, LIMIT + 1]), /75 MB/);
  });
  for (const column of ["file_size_bytes", "web_file_size_bytes"]) {
    await assert.rejects(db.query(`update character_miniatures set ${column}=$1 where id=$2`, [LIMIT + 1, model]), /check constraint/);
  }
});

test("enemy source/web constraints and only the two model buckets move to 75 MB", async () => {
  assert.deepEqual((await db.query("select id,file_size_limit::int as limit from storage.buckets order by id")).rows, [
    { id: "character-miniatures", limit: LIMIT }, { id: "maps", limit: 20971520 }, { id: "vtt-enemy-models", limit: LIMIT },
  ]);
  const model = id(21);
  await db.query("insert into vtt_enemy_models(id,campaign_id,name,storage_path,web_storage_path,original_name,file_size_bytes,web_file_size_bytes,created_by) values ($1,$2,'Large enemy','enemy.glb','enemy.web.glb','enemy.glb',$3,$3,$4)", [model, campaign, LIMIT, gm]);
  for (const column of ["file_size_bytes", "web_file_size_bytes"]) {
    await assert.rejects(db.query(`update vtt_enemy_models set ${column}=$1 where id=$2`, [LIMIT + 1, model]), /check constraint/);
    await assert.rejects(db.query(`update vtt_enemy_models set ${column}=0 where id=$1`, [model]), /check constraint/);
  }
  await db.exec(limitMigration);
});
