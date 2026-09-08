import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import highDeck from "../lib/tarokka/highDeck.json";

const db = new PGlite();
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migrationName = readdirSync(new URL("../supabase/migrations", import.meta.url)).find((name) => name.endsWith("_barovia_tarokka_high_deck.sql"))!;
const privateName = readdirSync(new URL("../supabase/migrations", import.meta.url)).find((name) => name.endsWith("_barovia_tarokka_private_interpretations.sql"))!;
const migration = read(`supabase/migrations/${migrationName}`) + read(`supabase/migrations/${privateName}`);
const uuid = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;
const [barovia, nattau, gm, player, otherPlayer, outsider] = Array.from({ length: 6 }, (_, i) => uuid(i + 1));
let cycle: string;
async function scalar<T = string>(sql: string, params: unknown[] = []) {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0])[0];
}
async function asUser<T>(user: string, action: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec("set role authenticated");
  try { return await action(); } finally { await db.exec("reset role"); }
}
const gmCall = <T = string>(sql: string, args: unknown[] = []) => asUser(gm, () => scalar<T>(sql, args));
const playerCall = <T = string>(sql: string, args: unknown[] = []) => asUser(player, () => scalar<T>(sql, args));
async function offer() { return playerCall("select offer_id from get_or_create_tarokka_offer($1)", [barovia]); }
async function claim(offerId: string, slot = 1, turn = false) { return playerCall("select draw_id from claim_tarokka_offer($1,$2::smallint,$3)", [offerId, slot, turn]); }
async function revealedDraw() { const id = await claim(await offer()); await playerCall("select reveal_tarokka_draw($1)", [id]); return id; }

before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    create table public.campaigns(id uuid primary key, slug text unique);
    create table public.campaign_members(campaign_id uuid, user_id uuid, role text, is_active boolean default true, counts_toward_campaign_progress boolean default true, primary key(campaign_id,user_id));
    create table public.profiles(id uuid primary key, display_name text);
    create function public.is_campaign_member(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.campaign_members where campaign_id=p_id and user_id=auth.uid() and is_active) $$;
    create function public.is_campaign_dm(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.campaign_members where campaign_id=p_id and user_id=auth.uid() and is_active and role='dm') $$;
    grant select on public.campaigns to authenticated;
    insert into campaigns values ('${barovia}','barovia'),('${nattau}','nattau');
    insert into auth.users values ('${gm}'),('${player}'),('${otherPlayer}'),('${outsider}');
    insert into campaign_members(campaign_id,user_id,role) values ('${barovia}','${gm}','dm'),('${nattau}','${gm}','dm'),('${barovia}','${player}','player'),('${nattau}','${otherPlayer}','player');
    insert into profiles values ('${player}','Traveller');
  `);
  await db.exec(read("tests/fixtures/tarokka-legacy-schema.sql"));
  await db.exec(`
    insert into tarokka_cards(id,slug,card_number,name,subtitle,meaning,upright_title,upright_description,reversed_title,reversed_description,sigil,art_key)
      values (80,'old-lantern','I','Old Lantern','Old inscription','Old meaning','Old gift','Old effect','Old price','Old reversed','*','lantern');
    insert into tarokka_cycles(id,campaign_id,cycle_number,title,is_active) values ('${uuid(50)}','${barovia}',1,'Legacy Turning',true);
    insert into tarokka_draws(id,campaign_id,cycle_id,player_id,card_id,is_reversed,selected_slot,card_slug_snapshot,card_number_snapshot,card_name_snapshot,subtitle_snapshot,meaning_snapshot,sigil_snapshot,art_key_snapshot,effect_title_snapshot,effect_description_snapshot)
      values ('${uuid(51)}','${barovia}','${uuid(50)}','${player}',80,false,1,'old-lantern','I','Old Lantern','Old inscription','Old meaning','*','lantern','Original boon','Preserve this exact effect');
  `);
  await db.exec(migration);
  assert.equal(await scalar("select effect_description_snapshot from tarokka_draws where id=$1", [uuid(51)]), "Preserve this exact effect");
  assert.equal(await scalar("select id from tarokka_cycles where is_active"), uuid(50));
  assert.equal(await scalar<boolean>("select is_active from tarokka_cards where id=80"), false);
  assert.equal(await scalar<number>("select count(*)::int from tarokka_cards where deck_key='high' and id>80"), 14);
});
beforeEach(async () => {
  await db.exec("update campaign_members set is_active=true; update tarokka_cards set is_active=true where deck_key='high';");
  cycle = await gmCall("select id from start_next_tarokka_cycle($1, 'Test Turning')", [barovia]);
});
after(async () => { await db.close(); });

test("High Deck contains all 14 traditional subjects and 28 complete, distinct effects", () => {
  assert.deepEqual(highDeck.map((card) => card.slug), ["artifact","beast","broken-one","darklord","donjon","executioner","ghost","horseman","innocent","marionette","mists","raven","seer","tempter"].map((slug) => `high-${slug}`));
  const effects = highDeck.flatMap((card) => [card.upright_description, card.reversed_description]);
  assert.equal(new Set(effects).size, 28);
  assert.ok(effects.every((effect) => effect.startsWith("Once this cycle,") && effect.length > 100));
  assert.ok(highDeck.every((card) => card.prophecy_upright.length > 50 && card.prophecy_reversed.length > 50));
});

test("hidden hand is private, stable and distinct; choosing locks its orientation and result", async () => {
  const id = await offer();
  assert.equal(await offer(), id);
  assert.equal(await playerCall<number>("select count(*)::int from tarokka_draw_offers"), 0);
  const { rows: [hand] } = await db.query<{ card_ids: number[]; reversed_flags: boolean[] }>("select card_ids,reversed_flags from tarokka_draw_offers where id=$1", [id]);
  assert.equal(new Set(hand.card_ids).size, 3);
  const draw = await claim(id, 2, true);
  assert.equal(await scalar<boolean>("select is_reversed from tarokka_draws where id=$1", [draw]), !hand.reversed_flags[1]);
  assert.equal(await claim(id, 1, false), draw);
  assert.equal(await scalar<number>("select card_id from tarokka_draws where id=$1", [draw]), hand.card_ids[1]);
  await assert.rejects(offer(), /already drawn/);
  await assert.rejects(playerCall("select * from claim_tarokka_offer($1,null::smallint,false)", [id]), /three cards/);
});

test("cross-campaign users, guests and removed members cannot draw or inspect Barovia", async () => {
  for (const user of [otherPlayer, outsider]) await asUser(user, async () => {
    assert.equal(await scalar<number>("select count(*)::int from tarokka_cards"), 0);
    await assert.rejects(db.query("select * from get_or_create_tarokka_offer($1)", [barovia]), /access/);
    await assert.rejects(db.query("select * from get_or_create_tarokka_offer($1)", [nattau]), /access/);
  });
  const id = await offer();
  await db.query("update campaign_members set is_active=false where user_id=$1", [player]);
  await assert.rejects(claim(id), /access/);
  assert.equal(await playerCall<number>("select count(*)::int from tarokka_draws"), 0);
  assert.equal(await playerCall<number>("select count(*)::int from tarokka_cards"), 0);
  await assert.rejects(asUser("", () => scalar("select reveal_tarokka_draw($1)", [uuid(51)])), /Sign in/);
  await db.exec("set role anon");
  try { await assert.rejects(db.query("select reveal_tarokka_draw($1)", [uuid(51)]), /permission denied/); }
  finally { await db.exec("reset role"); }
  await assert.rejects(gmCall("select * from start_next_tarokka_cycle($1,null)", [nattau]), /access/);
});

test("paused or closed cycles reject outstanding claims, while held omens can still be used during a pause", async () => {
  const id = await offer();
  await gmCall("select set_tarokka_draws_open($1,$2,false)", [barovia, cycle]);
  await assert.rejects(claim(id), /closed|paused/);
  await assert.rejects(offer(), /paused/);
  await gmCall("select set_tarokka_draws_open($1,$2,true)", [barovia, cycle]);
  const draw = await claim(id);
  await playerCall("select reveal_tarokka_draw($1)", [draw]);
  await gmCall("select set_tarokka_draws_open($1,$2,false)", [barovia, cycle]);
  await playerCall("select set_tarokka_effect_used($1,true,'At the bridge')", [draw]);
  await gmCall("select reset_tarokka_player_draw($1,$2,'Correction')", [barovia, player]);
  await gmCall("select set_tarokka_draws_open($1,$2,true)", [barovia, cycle]);
  const outstanding = await offer();
  await gmCall("select start_next_tarokka_cycle($1,null,$2)", [barovia, cycle]);
  await assert.rejects(claim(outstanding), /closed|paused/);
  await assert.rejects(gmCall("select start_next_tarokka_cycle($1,null,$2)", [barovia, cycle]), /cycle changed/);
});

test("omen use is idempotent, owner-bound, and only the GM can restore it with a reason", async () => {
  const draw = await revealedDraw();
  await assert.rejects(asUser(otherPlayer, () => scalar("select set_tarokka_effect_used($1,true,'')", [draw])), /access/);
  await playerCall("select set_tarokka_effect_used($1,true,'Protected a friend')", [draw]);
  await playerCall("select set_tarokka_effect_used($1,true,'Retry')", [draw]);
  assert.equal(await scalar<number>("select count(*)::int from tarokka_events where draw_id=$1 and kind='omen_used'", [draw]), 1);
  assert.equal(await scalar("select use_note from tarokka_draws where id=$1", [draw]), "Protected a friend");
  await assert.rejects(playerCall("select set_tarokka_effect_used($1,false,'Undo')", [draw]), /only the GM/);
  await assert.rejects(gmCall("select set_tarokka_effect_used($1,false,'')", [draw]), /reason/);
  await gmCall("select set_tarokka_effect_used($1,false,'Accidental click')", [draw]);
  assert.equal(await scalar("select used_at from tarokka_draws where id=$1", [draw]), null);
  assert.equal(await playerCall<number>("select count(*)::int from tarokka_events"), 0);
  await gmCall("select start_next_tarokka_cycle($1,null)", [barovia]);
  await assert.rejects(playerCall("select set_tarokka_effect_used($1,true,'')", [draw]), /active cycle/);
});

test("returning an omen retains its history and permits exactly one replacement draw", async () => {
  const old = await revealedDraw();
  await gmCall("select reset_tarokka_player_draw($1,$2,'Session correction',$3)", [barovia, player, old]);
  await gmCall("select reset_tarokka_player_draw($1,$2,'Session correction',$3)", [barovia, player, old]);
  assert.equal(await scalar("select void_reason from tarokka_draws where id=$1", [old]), "Session correction");
  assert.ok(await scalar("select voided_at from tarokka_draws where id=$1", [old]));
  await assert.rejects(playerCall("select set_tarokka_effect_used($1,true,'')", [old]), /active cycle/);
  const replacement = await claim(await offer());
  assert.notEqual(replacement, old);
  await assert.rejects(gmCall("select reset_tarokka_player_draw($1,$2,'Stale correction',$3)", [barovia,player,old]), /omen changed/);
  assert.equal(await scalar<number>("select count(*)::int from tarokka_draws where cycle_id=$1", [cycle]), 2);
  assert.equal(await gmCall("select draw_id from get_tarokka_cycle_progress($1) where player_id=$2", [barovia, player]), replacement);
});

test("deck edits require GM access and current revision; existing draw snapshots survive edits and a replay", async () => {
  const draw = await revealedDraw();
  const card = await scalar<number>("select card_id from tarokka_draws where id=$1", [draw]);
  const revision = await scalar<number>("select revision from tarokka_cards where id=$1", [card]);
  const snapshot = await scalar("select effect_description_snapshot from tarokka_draws where id=$1", [draw]);
  const patch = { upright_description: "Future upright effect only", reversed_description: "Future reversed effect only" };
  await assert.rejects(playerCall("select save_tarokka_card($1,$2::smallint,$3,$4)", [barovia,card,patch,revision]), /access/);
  await assert.rejects(gmCall("select save_tarokka_card($1,$2::smallint,$3,$4)", [barovia,card,{ name: "Not an editable identity" },revision]), /cannot be edited/);
  await assert.rejects(gmCall("select save_tarokka_card($1,$2::smallint,$3,$4)", [barovia,card,{ upright_description: null },revision]), /complete/);
  await gmCall("select save_tarokka_card($1,$2::smallint,$3,$4)", [barovia,card,patch,revision]);
  await assert.rejects(gmCall("select save_tarokka_card($1,$2::smallint,$3,$4)", [barovia,card,patch,revision]), /another window/);
  await db.exec(migration);
  assert.equal(await scalar("select effect_description_snapshot from tarokka_draws where id=$1", [draw]), snapshot);
  assert.equal(await scalar("select upright_description from tarokka_cards where id=$1", [card]), patch.upright_description);
  assert.equal(await scalar<number>("select count(*)::int from tarokka_cards where deck_key='high'"), 14);
  await assert.rejects(playerCall("update tarokka_cards set is_active=false returning id"), /permission denied/);
});

test("inactive or expired hands cannot be claimed and the active deck never falls below five cards", async () => {
  const id = await offer();
  const card = await scalar<number>("select card_ids[1] from tarokka_draw_offers where id=$1", [id]);
  const rev = await scalar<number>("select revision from tarokka_cards where id=$1", [card]);
  await gmCall("select set_tarokka_card_active($1,$2::smallint,false,$3)", [barovia,card,rev]);
  await assert.rejects(claim(id), /deck changed/);
  const newId = await offer(); assert.notEqual(id, newId);
  await assert.rejects(claim(id), /belong/);
  await db.query("update tarokka_draw_offers set expires_at=now()-interval '1 minute' where id=$1", [newId]);
  await assert.rejects(claim(newId), /swallowed/);
  const active = await db.query<{ id: number; revision: number }>("select id,revision from tarokka_cards where deck_key='high' and is_active order by id");
  for (const c of active.rows.slice(0,8)) await gmCall("select set_tarokka_card_active($1,$2::smallint,false,$3)", [barovia,c.id,c.revision]);
  const next = active.rows[8];
  await assert.rejects(gmCall("select set_tarokka_card_active($1,$2::smallint,false,$3)", [barovia,next.id,next.revision]), /at least five/);
});

test("Grand Reading keeps draft and unrevealed positions private and supplies prophecy instead of boons", async () => {
  const id = await gmCall("select create_tarokka_grand_reading($1,'The Road')", [barovia]);
  assert.equal(await playerCall<number>("select count(*)::int from tarokka_readings where id=$1", [id]), 0);
  assert.equal(await playerCall<number>("select count(*)::int from tarokka_reading_positions where reading_id=$1", [id]), 0);
  await assert.rejects(gmCall("select create_tarokka_grand_reading($1,null)", [barovia]), /Complete the existing/);
  const positions = await db.query<{ id: string; effect_title_snapshot: string; effect_description_snapshot: string }>("select id,effect_title_snapshot,effect_description_snapshot from tarokka_reading_positions where reading_id=$1 order by position_index", [id]);
  assert.equal(positions.rows.length, 5);
  assert.ok(positions.rows.every((row) => row.effect_title_snapshot === "The prophecy" && !row.effect_description_snapshot.includes("Once this cycle")));
  await assert.rejects(gmCall("select reveal_tarokka_reading_position($1)", [positions.rows[0].id]), /Open the reading/);
  await gmCall("select open_tarokka_grand_reading($1)", [id]);
  assert.equal(await playerCall<number>("select count(*)::int from tarokka_reading_positions where reading_id=$1", [id]), 0);
  for (let i=0; i<5; i++) {
    await gmCall("select reveal_tarokka_reading_position($1)", [positions.rows[i].id]);
    assert.equal(await playerCall<number>("select count(*)::int from tarokka_reading_positions where reading_id=$1", [id]), i+1);
  }
  assert.equal(await scalar("select status from tarokka_readings where id=$1", [id]), "complete");
  assert.equal(await scalar<number>("select count(*)::int from tarokka_draws where cycle_id=$1", [cycle]), 0);
});


test("GM interpretations stay private in both the catalogue RPC and direct column reads", async () => {
  assert.equal(await playerCall<number>("select count(*)::int from list_tarokka_deck($1)", [barovia]), 14);
  assert.equal(await playerCall<number>("select count(*)::int from list_tarokka_deck($1) where prophecy_upright<>'' or prophecy_reversed<>''", [barovia]), 0);
  assert.equal(await gmCall<number>("select count(*)::int from list_tarokka_deck($1) where prophecy_upright<>'' and prophecy_reversed<>''", [barovia]), 14);
  await assert.rejects(playerCall("select prophecy_upright from tarokka_cards limit 1"), /permission denied/);
  await assert.rejects(playerCall("select * from tarokka_cards limit 1"), /permission denied/);
  await assert.rejects(asUser(otherPlayer, () => scalar("select * from list_tarokka_deck($1)", [barovia])), /access/);
});
