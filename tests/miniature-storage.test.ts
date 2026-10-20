import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [campaign, other, gm, player, outsider, stl, glb, absent] = Array.from({length: 8}, (_, i) => id(i + 1));
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/character-miniatures-v2-textured-glb.sql");
async function as(user: string, action: () => Promise<void>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
  try { await action(); } finally { await db.exec("reset role"); }
}
async function register(model: string, format = "glb", sourceCampaign = campaign, web = `${sourceCampaign}/${player}/${model}.web.glb`) {
  return db.query("select register_character_miniature_asset($1,$2,$3,$4,$5,100,120,2,30,20,40) as id", [sourceCampaign, player, `${sourceCampaign}/${player}/${model}.${format}`, web, `hero.${format}`]);
}
before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create schema storage; create table storage.objects(bucket_id text, name text);
    create table campaigns(id uuid primary key);
    create function is_campaign_dm(c uuid) returns boolean language sql as $$ select c='${campaign}' and auth.uid()='${gm}' $$;
    create function is_active_campaign_player(c uuid,p uuid) returns boolean language sql as $$ select c='${campaign}' and p='${player}' $$;
    insert into campaigns values ('${campaign}'),('${other}');
    insert into auth.users values ('${gm}'),('${player}'),('${outsider}');
  `);
  const initial = read("supabase/character-miniatures-v1.sql");
  await db.exec(initial.slice(initial.indexOf("create table if not exists public.character_miniatures"), initial.indexOf("create or replace function public.is_active_campaign_player")));
  await db.exec(`alter table character_miniatures add web_storage_path text, add web_file_size_bytes bigint, add web_generated_at timestamptz;`);
  await db.exec(migration);
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
});
