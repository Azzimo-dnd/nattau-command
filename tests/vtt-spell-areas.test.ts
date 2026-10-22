import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {before,after,test} from "node:test";
import {PGlite} from "@electric-sql/pglite";
import {safeSpellRadius,validSharedMeasure} from "../components/vtt/vttSpellAreas";
import {coneCorners,coneDirection,isInsideCone,safeConeTemplate} from "../components/vtt/vttConeMath";

const db=new PGlite();
const uuid=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const [campaign,scene,gm,player,hidden,otherScene]=Array.from({length:6},(_,i)=>uuid(i+1));
const sql=readFileSync(new URL("../supabase/migrations/20261022115551_vtt_spell_areas.sql",import.meta.url),"utf8");
const coneMigration=readFileSync(new URL("../supabase/migrations/20261022155708_vtt_cone_spell_areas.sql",import.meta.url),"utf8");
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
 await db.exec(coneMigration);
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
  assert.equal((await db.query("delete from public.vtt_spell_areas returning id")).rows.length,0);
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

test("legacy saved circles stay circles after additive cone migration",async()=>{
 const rows=await asUser(gm,()=>db.query<{shape_type:string;direction_rad:number;radius:number}>(
  "select shape_type,direction_rad,radius from vtt_spell_areas where id=$1",[uuid(13)]));
 assert.deepEqual(rows.rows,[{shape_type:"circle",direction_rad:0,radius:3}]);
});
test("GM pins an angled 5e cone and player sees only visible shared geometry",async()=>{
 const template=safeConeTemplate([2,0],[2,3],24,18);
 assert.equal(template.length,3);
 assert.ok(Math.abs(template.direction-Math.PI/2)<1e-10);
 await asUser(gm,async()=>{
  await db.query("insert into vtt_spell_areas(id,campaign_id,scene_id,label,color,center_x,center_z,radius,shape_type,direction_rad,visible_to_players) values($1,$2,$3,'Dragon breath','#f97316',2,0,$4,'cone',$5,true)",[uuid(28),campaign,scene,template.length,template.direction]);
 });
 await asUser(player,async()=>{
  const r=await db.query<{shape_type:string;radius:number;direction_rad:number}>("select shape_type,radius,direction_rad from vtt_spell_areas where id=$1",[uuid(28)]);
  assert.equal(r.rows[0].shape_type,"cone");
  assert.equal(r.rows[0].radius,3);
 });
 await asUser(gm,async()=>{
  await db.query("update vtt_spell_areas set radius=6,direction_rad=0 where id=$1",[uuid(28)]);
  const r=await db.query<{radius:number;direction_rad:number}>("select radius,direction_rad from vtt_spell_areas where id=$1",[uuid(28)]);
  assert.deepEqual(r.rows,[{radius:6,direction_rad:0}]);
 });
});
test("invalid persisted cone geometry rejected by database constraints",async()=>{
 await asUser(gm,async()=>{
  await assert.rejects(db.query("insert into vtt_spell_areas(campaign_id,scene_id,label,color,center_x,center_z,radius,shape_type) values($1,$2,'invalid','#112233',0,0,3,'triangle')",[campaign,scene]),/check constraint/i);
  await assert.rejects(db.query("insert into vtt_spell_areas(campaign_id,scene_id,label,color,center_x,center_z,radius,shape_type,direction_rad) values($1,$2,'invalid','#112233',0,0,3,'cone',4)",[campaign,scene]),/check constraint/i);
 });
});
test("5e cone footprint and direction match a flat ended triangle",()=>{
 const [origin,left,right]=coneCorners(6,0);
 assert.deepEqual(origin,[0,0]);
 assert.deepEqual(left,[6,3]);
 assert.deepEqual(right,[6,-3]);
 assert.equal(coneDirection([0,0],[0,2]),Math.PI/2);
 assert.equal(isInsideCone([3,1],[0,0],6,0),true);
 assert.equal(isInsideCone([3,2],[0,0],6,0),false);
 assert.equal(isInsideCone([7,0],[0,0],6,0),false);
 assert.equal(isInsideCone([-1,0],[0,0],6,0),false);
 assert.equal(validSharedMeasure({mode:"cone",start:[1,1],end:[6,1]}),true);
 assert.equal(validSharedMeasure({mode:"cone",start:[1,1],end:[Infinity,1]}),false);
 assert.throws(()=>safeConeTemplate([0,0],[200,0],24,18));
});
