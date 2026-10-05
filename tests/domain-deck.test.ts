import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { cardHolders, holderLabel, sameDomainCard } from "../lib/daggerheart/domain-deck";

const card = { name: "Rune Ward", domain: "Codex", compendium_id: "card-1", source_key: "core", slug: "rune-ward" };
test("card matching supports legacy sheets without conflating sources or domains", () => {
  assert.ok(sameDomainCard(card, { ...card, name: "Renamed" }));
  assert.ok(sameDomainCard(card, { name: " Rune Ward ", domain: "codex" }));
  assert.ok(!sameDomainCard(card, { ...card, compendium_id: "card-2" }));
  assert.ok(!sameDomainCard(card, { ...card, compendium_id: undefined, source_key: "hope-fear" }));
  assert.ok(!sameDomainCard(card, { name: "Rune Ward", domain: "Blade" }));
  const usage = ["self", "other", "other"].map((id) => ({ ...card, character_id: id, character_name: id, player_name: "Pippo" }));
  assert.deepEqual(cardHolders(card, usage, "self").map((row) => row.character_id), ["other"]);
});

test("holder labels use the actual character and player names for every shared copy", () => {
  const usage = [
    { ...card, character_id: "one", character_name: "Odetta", player_name: "Anna" },
    { ...card, character_id: "two", character_name: "Torsten", player_name: "Torsten" },
    { ...card, character_id: "self", character_name: "My character", player_name: "Me" },
  ];
  assert.deepEqual(cardHolders(card, usage, "self").map(holderLabel), ["Odetta (Anna)", "Torsten"]);
  assert.equal(holderLabel({ ...usage[0], character_name: "Renamed character" }), "Renamed character (Anna)");
});

const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;
const [campaign, otherCampaign, player, pippo, outsider, inactive] = [1, 2, 3, 4, 5, 6].map(id);
async function asUser<T>(user: string, action: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
  try { return await action(); } finally { await db.exec("reset role"); }
}
before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create table campaign_members(campaign_id uuid, user_id uuid, role text, is_active boolean);
    create table daggerheart_characters(id uuid, campaign_id uuid, player_id uuid, name text, is_active boolean, domain_cards jsonb, private_notes text);
    alter table daggerheart_characters enable row level security;
    grant select on daggerheart_characters to authenticated;
    create policy own_sheet on daggerheart_characters for select to authenticated using (player_id=auth.uid());
    create function private.is_active_daggerheart_campaign_member(c uuid) returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from public.campaign_members where campaign_id=c and user_id=auth.uid() and is_active) $$;
    create function private.campaign_display_name(c uuid,u uuid,f text) returns text language sql as $$ select case when u='${pippo}' then 'Pippo' else f end $$;
    insert into campaign_members values ('${campaign}','${player}','player',true),('${campaign}','${pippo}','player',true),('${otherCampaign}','${outsider}','player',true),('${campaign}','${inactive}','player',false);
  `);
  for (const [n, owner, c, active] of [[10, pippo, campaign, true], [11, inactive, campaign, true], [12, outsider, otherCampaign, true], [13, pippo, campaign, false], [14, null, campaign, true]] as const) {
    await db.query("insert into daggerheart_characters values ($1,$2,$3,$4,$5,$6,$7)", [id(n),c,owner,`Character ${n}`,active,JSON.stringify([{...card,state:"vault"},{...card,state:"loadout"}]),"SECRET BACKSTORY"]);
  }
  await db.exec(readFileSync(new URL("../supabase/migrations/20261005093155_daggerheart_domain_card_usage.sql", import.meta.url), "utf8"));
});
after(async () => { await db.close(); });
test("players see a narrow same-campaign card projection, not other sheets", async () => {
  await asUser(player, async () => {
    assert.equal((await db.query("select * from daggerheart_characters")).rows.length, 0);
    const { rows } = await db.query<Record<string, unknown>>("select * from list_daggerheart_domain_card_usage($1)", [campaign]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].player_name, "Pippo");
    assert.equal(rows[0].character_id, id(10));
    assert.equal(rows[0].character_name, "Character 10");
    assert.deepEqual(Object.keys(rows[0]).sort(), ["character_id","character_name","player_name","compendium_id","slug","source_key","name","domain"].sort());
    assert.ok(!JSON.stringify(rows).includes("SECRET"));
  });
});
test("anonymous, inactive and cross-campaign callers cannot read usage through either function", async () => {
  for (const user of ["", inactive, outsider]) for (const fn of ["public.list_daggerheart_domain_card_usage", "private.daggerheart_domain_card_usage"]) {
    await assert.rejects(asUser(user, () => db.query(`select * from ${fn}($1)`, [campaign])), /membership required/);
  }
  await db.exec("set role anon");
  try { await assert.rejects(db.query("select * from list_daggerheart_domain_card_usage($1)", [campaign]), /permission denied/); }
  finally { await db.exec("reset role"); }
});
