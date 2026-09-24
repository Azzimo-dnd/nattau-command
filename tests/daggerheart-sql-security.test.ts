import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function sqlFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function hardenedTail(sql: string, marker: string) {
  const index = sql.lastIndexOf(marker);
  assert.notEqual(index, -1, `Missing hardening marker: ${marker}`);
  return sql.slice(index);
}

test("Daggerheart character SQL keeps browser roles on least privilege", () => {
  const sql = sqlFile("supabase/daggerheart-character-sheets.sql");
  const tail = hardenedTail(sql, "-- Final access hardening:");

  assert.match(
    tail,
    /revoke all on table public\.daggerheart_characters from anon;/i
  );
  assert.match(
    tail,
    /revoke all on table public\.daggerheart_characters from authenticated;/i
  );
  assert.match(
    tail,
    /grant select, insert, update, delete on table public\.daggerheart_characters to authenticated;/i
  );
  assert.match(
    sql,
    /alter table public\.daggerheart_characters[\s\S]*?alter column player_id drop not null;/i
  );
  assert.match(
    tail,
    /player_id is null[\s\S]*?public\.is_campaign_dm\(campaign_id\)/i
  );
  assert.match(
    tail,
    /create policy "Active Daggerheart campaign members can view characters"[\s\S]*?player_id = \(select auth\.uid\(\)\)[\s\S]*?public\.is_campaign_dm\(campaign_id\)/i
  );
  assert.match(
    tail,
    /create or replace function public\.list_daggerheart_character_roster\(p_campaign_id uuid\)[\s\S]*?public\.is_campaign_dm\(p_campaign_id\)[\s\S]*?cm\.user_id = \(select auth\.uid\(\)\)/i
  );

  assert.match(
    tail,
    /new\.player_id is distinct from old\.player_id[\s\S]*?not public\.is_campaign_dm\(old\.campaign_id\)/i
  );
  assert.match(
    tail,
    /revoke all on function public\.list_daggerheart_character_roster\(uuid\) from public;/i
  );
  assert.match(
    tail,
    /revoke all on function public\.list_daggerheart_character_roster\(uuid\) from anon;/i
  );
  assert.match(
    sql,
    /language plpgsql security definer set search_path = '' as \$\$/i
  );
  assert.match(
    sql,
    /create or replace function public\.set_daggerheart_character_updated_at\(\)[\s\S]*?set search_path = ''/i
  );
  assert.match(
    sql,
    /create or replace function public\.prevent_daggerheart_character_reassignment\(\)[\s\S]*?set search_path = ''/i
  );
  assert.match(
    sql,
    /revoke all on function public\.set_daggerheart_character_updated_at\(\)[\s\S]*?from public, anon, authenticated;/i
  );
  assert.match(
    sql,
    /revoke all on function public\.prevent_daggerheart_character_reassignment\(\)[\s\S]*?from public, anon, authenticated;/i
  );
  assert.doesNotMatch(sql, /security definer set search_path = '' as \$\n/i);
  assert.doesNotMatch(tail, /grant\s+all\b[^;]*\b(?:anon|authenticated)\b/i);
  assert.doesNotMatch(tail, /grant\s+truncate\b[^;]*\b(?:anon|authenticated)\b/i);
});

test("Daggerheart compendium SQL remains authenticated read-only", () => {
  const sql = sqlFile("supabase/daggerheart-compendium.sql");
  const tail = hardenedTail(sql, "-- Keep client roles on least privilege.");

  assert.match(
    tail,
    /revoke all on table public\.daggerheart_compendium_entries from anon;/i
  );
  assert.match(
    tail,
    /revoke all on table public\.daggerheart_compendium_entries from authenticated;/i
  );
  assert.match(
    tail,
    /grant select on table public\.daggerheart_compendium_entries to authenticated;/i
  );
  assert.match(
    sql,
    /create or replace function private\.has_daggerheart_compendium_access\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''/i
  );
  assert.match(
    sql,
    /create or replace function public\.set_daggerheart_compendium_updated_at\(\)[\s\S]*?set search_path = ''/i
  );
  assert.match(
    sql,
    /revoke all on function public\.set_daggerheart_compendium_updated_at\(\)[\s\S]*?from public, anon, authenticated;/i
  );
  assert.doesNotMatch(tail, /grant\s+(?:insert|update|delete|truncate|all)\b[^;]*\bauthenticated\b/i);

  assert.match(
    sql,
    /revoke execute on function public\.search_daggerheart_compendium\([\s\S]*?\) from public;/i
  );
  assert.match(
    sql,
    /revoke execute on function public\.search_daggerheart_compendium\([\s\S]*?\) from anon;/i
  );
  assert.match(
    sql,
    /grant execute on function public\.search_daggerheart_compendium\([\s\S]*?\) to authenticated;/i
  );
});
