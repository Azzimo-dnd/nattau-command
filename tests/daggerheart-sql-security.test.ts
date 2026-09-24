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
    tail,
    /revoke all on function public\.list_daggerheart_character_roster\(uuid\) from public;/i
  );
  assert.match(
    tail,
    /revoke all on function public\.list_daggerheart_character_roster\(uuid\) from anon;/i
  );
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
