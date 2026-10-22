import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {before,after,test} from "node:test";
import {PGlite} from "@electric-sql/pglite";
const db=new PGlite();
const uuid=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const [gm,player,campaign,scene,otherScene,a,b,c,large]=Array.from({length:9},(_,i)=>uuid(i+1));
const sql=readFileSync(new URL("../supabase/migrations/20261022103000_vtt_group_formation_move.sql",import.meta.url),"utf8");
async function asUser<T>(id:string,fn:()=>Promise<T>){
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 await db.exec("set role authenticated");
 try{return await fn();}finally{await db.exec("reset role");}
}
before(async()=>{
 await db.exec([
  "create role anon;create role authenticated;create role service_role;",
  "create schema auth;create table auth.users(id uuid primary key);",
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  "create table public.vtt_scenes(id uuid primary key,campaign_id uuid,grid_width integer,grid_height integer);",
  "create table public.test_members(campaign_id uuid,user_id uuid,role text);",
  "create function public.is_campaign_dm(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.test_members where campaign_id=p_id and user_id=auth.uid() and role='dm') $$;",
  "create table public.vtt_tokens(id uuid primary key,scene_id uuid,x double precision,z double precision,size_squares double precision,revision bigint default 0,updated_at timestamptz default now());",
  "alter table public.vtt_tokens enable row level security;",
  "grant select,update on public.vtt_tokens to authenticated;",
  "grant select on public.vtt_scenes to authenticated;",
  "grant usage on schema auth to authenticated;",
  "grant execute on function auth.uid() to authenticated;",
  "create policy gm_read on public.vtt_tokens for select to authenticated using (exists(select 1 from public.vtt_scenes s where s.id=scene_id and public.is_campaign_dm(s.campaign_id)));",
  "create policy gm_write on public.vtt_tokens for update to authenticated using (exists(select 1 from public.vtt_scenes s where s.id=scene_id and public.is_campaign_dm(s.campaign_id))) with check (exists(select 1 from public.vtt_scenes s where s.id=scene_id and public.is_campaign_dm(s.campaign_id)));"
 ].join("\n"));
 await db.query("insert into auth.users values ($1),($2)",[gm,player]);
 await db.query("insert into test_members values ($1,$2,'dm')",[campaign,gm]);
 await db.query("insert into vtt_scenes values ($1,$3,24,18),($2,$3,24,18)",[scene,otherScene,campaign]);
 await db.query("insert into vtt_tokens(id,scene_id,x,z,size_squares) values ($1,$5,-3.5,-1.5,1),($2,$5,-2.5,-1.5,1),($3,$5,2.5,1.5,1),($4,$6,0.5,0.5,1)",[a,b,c,large,scene,otherScene]);
 await db.exec(sql);
});
after(async()=>{await db.close();});
test("GM atomically moves a multi-miniature formation and increases revisions",async()=>{
 await asUser(gm,async()=>{
  const result=await db.query<{move_vtt_token_formation:number}>("select public.move_vtt_token_formation($1,array[$2,$3]::uuid[],2,0)",[scene,a,b]);
  assert.equal(result.rows[0].move_vtt_token_formation,2);
  const rows=await db.query<{x:number;z:number;revision:number}>("select x,z,revision from vtt_tokens where id in ($1,$2) order by x",[a,b]);
  assert.deepEqual(rows.rows,[{x:-1.5,z:-1.5,revision:1},{x:-0.5,z:-1.5,revision:1}]);
 });
});
test("occupied or outside destinations do not partially update the group",async()=>{
 await asUser(gm,async()=>{
  const before=await db.query("select id,x,z,revision from vtt_tokens where scene_id=$1 order by id",[scene]);
  await assert.rejects(db.query("select public.move_vtt_token_formation($1,array[$2,$3]::uuid[],3,3)",[scene,a,b]),/occupied/);
  await assert.rejects(db.query("select public.move_vtt_token_formation($1,array[$2,$3]::uuid[],20,0)",[scene,a,b]),/outside/);
  const after=await db.query("select id,x,z,revision from vtt_tokens where scene_id=$1 order by id",[scene]);
  assert.deepEqual(after.rows,before.rows);
 });
});
test("cannot forge IDs, mix scenes, repeat IDs or move as non-GM",async()=>{
 await asUser(gm,async()=>{
  await assert.rejects(db.query("select public.move_vtt_token_formation($1,array[$2,$3]::uuid[],1,0)",[scene,a,large]),/missing/);
  await assert.rejects(db.query("select public.move_vtt_token_formation($1,array[$2,$2]::uuid[],1,0)",[scene,a]),/duplicate/);
 });
 await asUser(player,async()=>{
  await assert.rejects(db.query("select public.move_vtt_token_formation($1,array[$2]::uuid[],1,0)",[scene,a]),/GM access/);
 });
});
