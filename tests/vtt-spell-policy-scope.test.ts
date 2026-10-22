import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {PGlite} from "@electric-sql/pglite";
test("spell-area player RLS explicitly scopes the requested scene to the area campaign",async()=>{
 const db=new PGlite();
 try{
  const sql=readFileSync(new URL("../supabase/migrations/20261022115807_vtt_spell_areas_policy_scene_scope.sql",import.meta.url),"utf8");
  assert.match(sql,/s\.campaign_id\s*=\s*vtt_spell_areas\.campaign_id/);
  assert.doesNotMatch(sql,/s\.campaign_id\s*=\s*s\.campaign_id/);
  await db.exec("create table public.vtt_spell_areas(campaign_id uuid,scene_id uuid,visible_to_players boolean,center_x double precision,center_z double precision);create table public.vtt_scenes(id uuid,campaign_id uuid,is_active boolean,visible_to_players boolean);create function public.is_campaign_member(p_campaign_id uuid) returns boolean language sql as $$select true$$;create function public.is_vtt_point_revealed(p_scene uuid,p_x double precision,p_z double precision) returns boolean language sql as $$select true$$;alter table public.vtt_spell_areas enable row level security;create policy \"VTT spell areas players see revealed\" on public.vtt_spell_areas for select using(true);");
  await db.exec(sql);
  const pol=await db.query<{qual:string}>("select pg_get_expr(polqual,polrelid) as qual from pg_policy where polname='VTT spell areas players see revealed'");
  assert.equal(pol.rows.length,1);
  assert.match(pol.rows[0].qual,/s\.campaign_id\s*=\s*vtt_spell_areas\.campaign_id/);
 }finally{await db.close();}
});
