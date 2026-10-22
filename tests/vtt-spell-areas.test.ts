import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {before,after,test} from "node:test";
import {PGlite} from "@electric-sql/pglite";
import {safeSpellRadius,validSharedMeasure} from "../components/vtt/vttSpellAreas";

const db=new PGlite();
const uuid=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const [campaign,scene,gm,player,hidden,otherScene]=Array.from({length:6},(_,i)=>uuid(i+1));
const sql=readFileSync(new URL("../supabase/migrations/20261022142000_vtt_spell_areas.sql",import.meta.url),"utf8");
async function asUser<T>(id:string,run:()=>Promise<T>){
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 await db.exec("set role authenticated");
 try{return await run();}finally{await db.exec("reset role");}
}
before(async()=>{
 await db.exec([
  "create role anon;create role authenticated;create role service_role;",
  "create schema auth;create table auth.users(id uuid primary key);",
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  "create table public.campaigns(id uuid primary key);",
  "create table public.test_members(campaign_id uuid,user_id uuid,role text);",
  "create table public.vtt_scenes(id uuid primary key,campaign_id uuid,grid_width integer,grid_height integer,is_active boolean,visible_to_players boolean);",
  "create function public.is_campaign_dm(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.test_members where campaign_id=p_id and user_id=auth.uid() and role='dm') $$;",
  "create function public.is_campaign_member(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.test_members where campaign_id=p_id and user_id=auth.uid()) $$;",
  "create function public.is_vtt_point_revealed(p_scene_id uuid,p_x double precision,p_z double precision) returns boolean language sql stable as $$ select p_x >= 0 $$;",
  "grant usage on schema auth to authenticated;",
  "grant execute on function auth.uid() to authenticated;",
  "grant select on public.vtt_scenes to authenticated;"
 ].join("\n"));
 await db.query("insert into auth.users values ($1),($2),($3)",[gm,player,hidden]);
 await db.query("insert into campaigns values ($1)",[campaign]);
 await db.query("insert into test_members values ($1,$2,'dm'),($1,$3,'player')",[campaign,gm,player]);
 await db.query("insert into vtt_scenes values ($1,$3,24,18,true,true),($2,$3,24,18,false,false)",[scene,otherScene,campaign]);
 await db.exec(sql);
});
after(async()=>await db.close());
test("GM can pin multiple colored areas; player sees only active, shared, revealed circles",async()=>{
 await asUser(gm,async()=>{
  const rows=[
   {id:uuid(12),x:4,visible:true,label:"Fire",color:"#f97316",sceneId:scene},
   {id:uuid(13),x:5,visible:true,label:"Poison",color:"#84cc16",sceneId:scene},
   {id:uuid(14),x:-5,visible:true,label:"Fog hidden",color:"#38bdf8",sceneId:scene},
   {id:uuid(15),x:4,visible:false,label:"GM secret",color:"#a78bfa",sceneId:scene},
   {id:uuid(16),x:3,visible:true,label:"Other scene",color:"#facc15",sceneId:otherScene},
  ];
  for(const row of rows){
   await db.query("insert into vtt_spell_areas(id,campaign_id,scene_id,label,color,center_x,center_z,radius,visible_to_players) values ($1,$2,$3,$4,$5,$6,0,3,$7)",
    [row.id,campaign,row.sceneId,row.label,row.color,row.x,row.visible]);
  }
  assert.equal((await db.query("select id from vtt_spell_areas")).rows.length,5);
 });
 await asUser(player,async()=>{
  const r=await db.query<{label:string}>("select label from public.vtt_spell_areas order by label");
  assert.deepEqual(r.rows.map(v=>v.label),["Fire","Poison"]);
  await assert.rejects(db.query("delete from public.vtt_spell_areas returning id"),/permission denied|row.level.security/i);
 });
 await asUser(hidden,async()=>{
  assert.equal((await db.query("select id from public.vtt_spell_areas")).rows.length,0);
 });
});
test("GM can hide a pinned area without changing the original geometry",async()=>{
 await asUser(gm,async()=>{
  await db.query("update public.vtt_spell_areas set visible_to_players=false where id=$1",[uuid(12)]);
 });
 await asUser(player,async()=>{
  const r=await db.query<{label:string}>("select label from public.vtt_spell_areas");
  assert.deepEqual(r.rows.map(v=>v.label),["Poison"]);
 });
});
test("reject invalid colors, oversized labels, coordinates and scene reassignment",async()=>{
 await asUser(gm,async()=>{
  await assert.rejects(db.query("insert into public.vtt_spell_areas(campaign_id,scene_id,label,color,center_x,center_z,radius) values ($1,$2,'a','orange',0,0,2)",[campaign,scene]),/check constraint/i);
  await assert.rejects(db.query("insert into public.vtt_spell_areas(campaign_id,scene_id,label,color,center_x,center_z,radius) values ($1,$2,'a','#112233',100,0,2)",[campaign,scene]),/scene coordinates/i);
  await assert.rejects(db.query("update public.vtt_spell_areas set scene_id=$1 where id=$2",[otherScene,uuid(13)]),/reassign/i);
 });
});
test("shared measurements validate mode and finite coordinate bounds",()=>{
 assert.equal(validSharedMeasure({mode:"ruler",start:[0,0],end:[3,4]}),true);
 assert.equal(validSharedMeasure({mode:"radius",start:[-2,3],end:[1,2]}),true);
 assert.equal(validSharedMeasure({mode:"radius",start:[0,0],end:[Infinity,1]}),false);
 assert.equal(validSharedMeasure({mode:"sword",start:[0,0],end:[1,1]}),false);
 assert.equal(safeSpellRadius([0,0],[3,4],24,18),5);
 assert.throws(()=>safeSpellRadius([0,0],[100,4],24,18),/valid radius/);
});
