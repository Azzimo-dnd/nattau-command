import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { snapTokenCoordinate } from "../components/vtt/vttGridMath";
import { fogRegionContains } from "../components/vtt/vttFogMath";

const db = new PGlite();
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [barovia, nattau, gm, baroviaPlayer, nattauPlayer, outsider, liveScene, preparedScene, otherScene, hiddenEnemy, shownEnemy] = Array.from({ length: 11 }, (_, i) => uuid(i + 1));
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260907141320_barovia_vtt_session_readiness.sql");

async function scalar<T>(sql: string, params: unknown[] = []) {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0])[0];
}
async function asUser<T>(user: string, action: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec("set role authenticated");
  try { return await action(); } finally { await db.exec("reset role"); }
}

before(async () => {
  // Minimal Supabase platform fixtures; production VTT tables/policies and the
  // actual migration below run in PostgreSQL, with RLS enforced for each role.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    create schema realtime;
    create table realtime.messages(id bigint generated always as identity, extension text);
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated;
    grant select, insert on realtime.messages to authenticated;
    create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
    create table public.campaigns(id uuid primary key);
    create table public.test_members(campaign_id uuid, user_id uuid, role text);
    create function public.is_campaign_member(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.test_members where campaign_id=p_id and user_id=auth.uid()) $$;
    create function public.is_campaign_dm(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.test_members where campaign_id=p_id and user_id=auth.uid() and role='dm') $$;
    create table public.character_miniatures(id uuid primary key, web_storage_path text, storage_path text, original_name text);
    create table public.character_miniature_paint_jobs(miniature_id uuid, storage_path text, is_default boolean);
    insert into auth.users values ('${gm}'),('${baroviaPlayer}'),('${nattauPlayer}'),('${outsider}');
    insert into campaigns values ('${barovia}'),('${nattau}');
    insert into test_members values ('${barovia}','${gm}','dm'),('${nattau}','${gm}','dm'),('${barovia}','${baroviaPlayer}','player'),('${nattau}','${nattauPlayer}','player');
  `);
  const initial = read("supabase/vtt-alpha-v0-1.sql");
  await db.exec(initial.slice(0, initial.indexOf("insert into storage.buckets")) + "commit;");
  await db.exec(`
    alter table vtt_scenes add column visible_to_players boolean not null default true;
    alter table vtt_tokens add column initiative integer;
  `);
  const visibility = read("supabase/vtt-alpha-v0-4-3-player-visibility.sql");
  await db.exec(visibility.slice(0, visibility.indexOf("create or replace function public.can_read_vtt_map_object")) + "commit;");
  const pathStart = initial.indexOf("create or replace function public.vtt_storage_campaign_id");
  const pathEnd = initial.indexOf("create or replace function", pathStart + 10);
  await db.exec(initial.slice(pathStart, pathEnd));
  await db.exec(read("supabase/vtt-alpha-v0-4-8-manual-fog.sql"));
  await db.exec(migration);
  await db.exec(`
    insert into vtt_scenes(id,campaign_id,name,is_active,fog_enabled,fog_base_state) values
      ('${liveScene}','${barovia}','The old road',true,true,'covered'),
      ('${preparedScene}','${barovia}','A future secret',false,true,'covered'),
      ('${otherScene}','${nattau}','Expedition',true,false,'revealed');
    insert into vtt_enemy_models(id,campaign_id,name,storage_path,web_storage_path,original_name,file_size_bytes,created_by) values
      ('${hiddenEnemy}','${barovia}','Hidden sentinel','${barovia}/hidden.stl','${barovia}/hidden.web.glb','hidden.stl',100,'${gm}'),
      ('${shownEnemy}','${barovia}','Visible sentinel','${barovia}/shown.stl','${barovia}/shown.web.glb','shown.stl',100,'${gm}');
    insert into vtt_enemy_paint_jobs(enemy_model_id,storage_path,name,file_size_bytes,is_default,created_by) values
      ('${hiddenEnemy}','${barovia}/hidden.json','Hidden paint',100,true,'${gm}');
    insert into vtt_tokens(scene_id,enemy_model_id,name,x,z,visible_to_players) values
      ('${liveScene}','${hiddenEnemy}','Fog secret',0,0,true),
      ('${liveScene}','${shownEnemy}','Visible sentinel',5,5,true),
      ('${liveScene}','${shownEnemy}','Manual secret',5,5,false),
      ('${preparedScene}','${hiddenEnemy}','Prepared secret',5,5,true);
    insert into vtt_fog_regions(scene_id,operation,shape,points) values
      ('${liveScene}','reveal','rectangle','[[5,5],[6,6]]');
    insert into realtime.messages(extension) values ('broadcast'),('presence');
  `);
});
after(async () => { await db.close(); });

test("direct table reads and token RPC expose the same fog-filtered actors", async () => {
  await asUser(baroviaPlayer, async () => {
    const direct = await db.query("select name from vtt_tokens order by name");
    const rpc = await db.query("select name from list_vtt_scene_tokens($1) order by name", [liveScene]);
    assert.deepEqual(direct.rows, [{ name: "Visible sentinel" }]);
    assert.deepEqual(rpc.rows, direct.rows);
    assert.equal(await scalar("select can_read_vtt_enemy_model_object($1)", [`${barovia}/hidden.web.glb`]), false);
    assert.equal(await scalar("select can_read_vtt_enemy_paint_object($1)", [`${barovia}/hidden.json`]), false);
    assert.equal(await scalar("select can_read_vtt_enemy_model_object($1)", [`${barovia}/shown.web.glb`]), true);
    assert.equal(await scalar("select model_file_name from list_vtt_scene_tokens($1)", [liveScene]), "shown.web.glb");
  });
});

test("GM sees and edits private actors; players remain spectators", async () => {
  await asUser(gm, async () => {
    assert.equal(await scalar("select count(*)::int from vtt_tokens"), 4);
    assert.equal(await scalar("select can_read_vtt_enemy_paint_object($1)", [`${barovia}/hidden.json`]), true);
  });
  await asUser(baroviaPlayer, async () => {
    const update = await db.query("update vtt_tokens set x=7 returning id");
    assert.equal(update.rows.length, 0);
    await assert.rejects(db.query("insert into vtt_tokens(scene_id,enemy_model_id,name) values ($1,$2,'Injected actor')", [liveScene, hiddenEnemy]), /row-level security/);
  });
});

test("another campaign member and an outsider cannot read or probe Barovia", async () => {
  for (const user of [nattauPlayer, outsider]) await asUser(user, async () => {
    assert.equal(await scalar("select count(*)::int from vtt_tokens"), 0);
    assert.equal(await scalar("select is_vtt_point_revealed($1,5,5)", [liveScene]), false);
    assert.equal(await scalar("select can_read_vtt_enemy_model_object($1)", [`${barovia}/shown.web.glb`]), false);
    await assert.rejects(db.query("select * from list_vtt_scene_tokens($1)", [liveScene]), /Campaign access required/);
  });
  await asUser(baroviaPlayer, async () => {
    assert.equal(await scalar("select is_vtt_point_revealed($1,0,0)", [uuid(999)]), false);
    assert.equal(await scalar("select is_vtt_point_revealed($1,0,0)", [preparedScene]), false);
  });
});

test("grid snapping is identical in PostgreSQL and the rendered board", async () => {
  for (const squares of [4, 5, 24, 25, 100]) for (const size of [.5, 1, 2, 3, 4, 8]) for (const x of [-100, -1.5, -.5, 0, .5, 1.5, 100]) {
    assert.equal(await scalar("select vtt_snap_token_coordinate($1,$2,$3)", [x, squares, size]), snapTokenCoordinate(x, squares, size));
  }
});

test("ordered reveal/cover/undo applies at a token's visible center, including asset access", async () => {
  await db.query("insert into vtt_fog_regions(scene_id,operation,shape,points) values ($1,'reveal','rectangle','[[0.4,0.4],[0.6,0.6]]')", [liveScene]);
  await asUser(baroviaPlayer, async () => {
    assert.equal(await scalar("select count(*)::int from list_vtt_scene_tokens($1)", [liveScene]), 2);
    assert.equal(await scalar("select can_read_vtt_enemy_paint_object($1)", [`${barovia}/hidden.json`]), true);
  });
  const { rows: [cover] } = await db.query<{ id: number }>("insert into vtt_fog_regions(scene_id,operation,shape) values ($1,'cover','all') returning id", [liveScene]);
  await asUser(baroviaPlayer, async () => assert.equal(await scalar("select count(*)::int from vtt_tokens"), 0));
  await db.query("delete from vtt_fog_regions where id=$1", [cover.id]);
  await asUser(baroviaPlayer, async () => assert.equal(await scalar("select count(*)::int from vtt_tokens"), 2));
});

test("hiding a live scene blocks table, RPC, assets, point probes, and dice topics", async () => {
  await db.query("update vtt_scenes set visible_to_players=false where id=$1", [liveScene]);
  try {
    await asUser(baroviaPlayer, async () => {
      assert.equal(await scalar("select count(*)::int from vtt_tokens"), 0);
      assert.equal(await scalar("select is_vtt_point_revealed($1,5,5)", [liveScene]), false);
      assert.equal(await scalar("select can_read_vtt_enemy_model_object($1)", [`${barovia}/shown.web.glb`]), false);
      assert.equal(await scalar("select can_access_vtt_topic($1,false)", [`vtt:dice:${liveScene}`]), false);
      await assert.rejects(db.query("select * from list_vtt_scene_tokens($1)", [liveScene]), /not currently available/);
    });
  } finally { await db.query("update vtt_scenes set visible_to_players=true where id=$1", [liveScene]); }
});

test("private Realtime enforces campaign membership and GM-only fog publishing", async () => {
  await asUser(baroviaPlayer, async () => {
    for (const topic of [`vtt:campaign:${barovia}`, `vtt:presence:${barovia}`, `vtt:dice:${liveScene}`]) {
      await db.query("select set_config('realtime.topic',$1,false)", [topic]);
      assert.equal(await scalar("select count(*)::int from realtime.messages"), 2);
    }
    await db.query("select set_config('realtime.topic',$1,false)", [`vtt:fog:${barovia}`]);
    await assert.rejects(db.query("insert into realtime.messages(extension) values ('broadcast')"), /row-level security/);
    for (const topic of [`vtt:campaign:${nattau}`, `vtt:dice:${preparedScene}`, `vtt:campaign:bad`, "other:campaign:any"]) {
      assert.equal(await scalar("select can_access_vtt_topic($1,true)", [topic]), false);
    }
  });
  await asUser(gm, async () => assert.equal(await scalar("select can_access_vtt_topic($1,true)", [`vtt:fog:${barovia}`]), true));
  await asUser(outsider, async () => {
    await db.query("select set_config('realtime.topic',$1,false)", [`vtt:campaign:${barovia}`]);
    assert.equal(await scalar("select count(*)::int from realtime.messages"), 0);
  });
});

test("JavaScript and PostgreSQL agree on rectangle/polygon edges and point containment", async () => {
  for (const region of [
    { shape: "rectangle" as const, points: [[2, 2], [-2, -2]] as [number, number][] },
    { shape: "polygon" as const, points: [[-2, -2], [2, -2], [2, 2], [0, 0], [-2, 2]] as [number, number][] },
  ]) for (const x of [-2, -1, 0, 1, 2, 3]) for (const z of [-2, -.5, 0, 1, 2]) {
    assert.equal(await scalar("select vtt_fog_region_contains($1,$2::jsonb,$3,$4)", [region.shape, JSON.stringify(region.points), x, z]), fogRegionContains(region, x, z));
  }
});

test("migration can be reapplied and anonymous roles cannot call privileged RPCs", async () => {
  await db.exec(migration);
  await db.exec("set role anon");
  try { await assert.rejects(db.query("select is_vtt_point_revealed($1,0,0)", [liveScene]), /permission denied/); }
  finally { await db.exec("reset role"); }
});
