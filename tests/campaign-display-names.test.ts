import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function file(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("campaign memberships own their display names", () => {
  const sql = file("supabase/campaign-specific-display-names.sql");

  assert.match(
    sql,
    /alter table public\.campaign_members[\s\S]*?add column if not exists display_name text;/i
  );
  assert.match(
    sql,
    /create or replace function private\.campaign_display_name\(/i
  );
  assert.match(
    sql,
    /create trigger campaign_members_default_display_name[\s\S]*?before insert on public\.campaign_members/i
  );
  assert.match(
    sql,
    /list_campaign_admin_members[\s\S]*?nullif\(trim\(cm\.display_name\), ''\)/i
  );
  assert.match(
    sql,
    /list_daggerheart_character_roster[\s\S]*?private\.campaign_display_name\(p_campaign_id, cm\.user_id/i
  );
  assert.match(
    sql,
    /prepare_campaign_dice_roll[\s\S]*?private\.campaign_display_name\(new\.campaign_id, resolved_user_id/i
  );
  assert.match(
    sql,
    /prepare_vtt_dice_roll[\s\S]*?private\.campaign_display_name\(v_campaign_id, v_user_id/i
  );
});

test("GM member editor writes the campaign-specific name", () => {
  const ui = file("components/campaign-admin/CampaignAdministration.tsx");
  const createUser = file(
    "supabase/functions/campaign-admin-create-user/index.ts"
  );

  assert.match(ui, /Campaign display name/);
  assert.match(ui, /p_display_name: draft\.displayName\.trim\(\)/);
  assert.match(
    createUser,
    /\.from\("campaign_members"\)[\s\S]*?display_name: resolvedDisplayName/
  );
});
