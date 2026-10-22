import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { shouldPublishVttDiceRoll } from "../components/vtt/vttDiceVisibility";

const migration=readFileSync(new URL("../supabase/migrations/20261022183500_vtt_dice_roll_privacy.sql",import.meta.url),"utf8");
const uuid=(i:number)=>"00000000-0000-4000-8000-"+String(i).padStart(12,"0");
const campaign=uuid(1),gm=uuid(2),player=uuid(3),scene=uuid(4),legacy=uuid(5);
async function asUser<T>(db:PGlite,user:string,run:()=>Promise<T>):Promise<T>{
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.exec("set role authenticated");
 try{return await run();}finally{await db.exec("reset role");}
}
async function fixture(){
 const db=new PGlite();
 await db.exec(`
  create role authenticated;create role anon;
  create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table public.campaigns(id uuid primary key);
  create table public.members(campaign_id uuid,user_id uuid,role text);
  create table public.vtt_scenes(id uuid primary key,campaign_id uuid,is_active boolean,visible_to_players boolean);
  create table public.profiles(id uuid primary key,display_name text);
  create function public.is_campaign_dm(p_id uuid) returns boolean language sql stable
    security definer set search_path='' as $$
     select exists(select 1 from public.members where campaign_id=p_id and user_id=auth.uid() and role='dm')
    $$;
  create function public.is_campaign_member(p_id uuid) returns boolean language sql stable
    security definer set search_path='' as $$
     select exists(select 1 from public.members where campaign_id=p_id and user_id=auth.uid())
    $$;
  create table public.vtt_dice_rolls(
    id uuid primary key default gen_random_uuid(),scene_id uuid not null,roll_key text not null,
    roller_id uuid,roller_name text default 'Campaign member',expression text,mode text default 'normal',
    modifier integer default 0,total integer,details jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  alter table public.vtt_dice_rolls enable row level security;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  grant select on public.vtt_scenes to authenticated;
  grant select,insert on public.vtt_dice_rolls to authenticated;
  create policy "VTT dice scene read" on public.vtt_dice_rolls for select to authenticated using(
   exists(select 1 from public.vtt_scenes s where s.id=vtt_dice_rolls.scene_id
     and (public.is_campaign_dm(s.campaign_id) or (s.is_active and s.visible_to_players and public.is_campaign_member(s.campaign_id))))
  );
  create policy "VTT dice scene insert" on public.vtt_dice_rolls for insert to authenticated with check(
   exists(select 1 from public.vtt_scenes s where s.id=vtt_dice_rolls.scene_id and public.is_campaign_member(s.campaign_id))
  );
  create function public.prepare_vtt_dice_roll() returns trigger language plpgsql
    security definer set search_path=public as $$ begin
      new.roller_id:=auth.uid();return new;
    end $$;
  create trigger vtt_dice_rolls_prepare_insert before insert on public.vtt_dice_rolls
    for each row execute function public.prepare_vtt_dice_roll();
 `);
 await db.query("insert into auth.users values ($1),($2)",[gm,player]);
 await db.query("insert into campaigns values ($1)",[campaign]);
 await db.query("insert into members values ($1,$2,'dm'),($1,$3,'player')",[campaign,gm,player]);
 await db.query("insert into profiles values ($1,'GM'),($2,'Player')",[gm,player]);
 await db.query("insert into vtt_scenes values ($1,$2,true,false)",[scene,campaign]);
 await db.query("insert into vtt_dice_rolls(id,scene_id,roll_key,roller_id,expression,total) values ($1,$2,'legacy-private', $3, '1d20',13)",[legacy,scene,gm]);
 await db.exec(migration);
 return db;
}
test("Shared-scene rolls default public; unpublished-scene rolls are always secret; only GM may hide",()=>{
 assert.equal(shouldPublishVttDiceRoll(true,true,true),true);
 assert.equal(shouldPublishVttDiceRoll(true,true,false),false);
 assert.equal(shouldPublishVttDiceRoll(true,false,true),false);
 assert.equal(shouldPublishVttDiceRoll(false,true,false),true);
 assert.equal(shouldPublishVttDiceRoll(false,false,true),false);
});
test("Historic hidden-scene GM roll remains private when scene later becomes public",async()=>{
 const db=await fixture();
 try{
  await db.exec("update vtt_scenes set visible_to_players=true where id='"+scene+"'");
  await asUser(db,player,async()=>{
   const rows=await db.query("select id from vtt_dice_rolls");
   assert.equal(rows.rows.length,0);
  });
  await asUser(db,gm,async()=>{
   const rows=await db.query<{visible_to_players:boolean}>("select visible_to_players from vtt_dice_rolls");
   assert.deepEqual(rows.rows,[{visible_to_players:false}]);
  });
 }finally{await db.close();}
});
test("Player and GM both see shared rolls, player cannot create secret roll",async()=>{
 const db=await fixture();
 try{
  await db.exec("update vtt_scenes set visible_to_players=true where id='"+scene+"'");
  await asUser(db,player,async()=>{
   const result=await db.query("insert into vtt_dice_rolls(scene_id,roll_key,expression,total,visible_to_players) values ($1,'player-public','1d20',16,true) returning roller_name",[scene]);
   assert.deepEqual(result.rows,[{roller_name:"Player"}]);
   await assert.rejects(db.query("insert into vtt_dice_rolls(scene_id,roll_key,expression,total,visible_to_players) values ($1,'player-secret','1d20',1,false)",[scene]),/Only GM can roll privately/);
  });
  await asUser(db,gm,async()=>{
   await db.query("insert into vtt_dice_rolls(scene_id,roll_key,expression,total,visible_to_players) values ($1,'gm-public','1d20',17,true)",[scene]);
   await db.query("insert into vtt_dice_rolls(scene_id,roll_key,expression,total,visible_to_players) values ($1,'gm-secret','1d20',10,false)",[scene]);
   const rollList=await db.query<{roll_key:string}>("select roll_key from vtt_dice_rolls order by roll_key");
   assert.deepEqual(rollList.rows.map(x=>x.roll_key),["gm-public","gm-secret","legacy-private","player-public"]);
  });
  await asUser(db,player,async()=>{
   const rollList=await db.query<{roll_key:string}>("select roll_key from vtt_dice_rolls order by roll_key");
   assert.deepEqual(rollList.rows.map(x=>x.roll_key),["gm-public","player-public"]);
  });
 }finally{await db.close();}
});
test("GM roll made while scene is hidden cannot become public by setting a client flag",async()=>{
 const db=await fixture();
 try{
  await asUser(db,gm,async()=>{
   const insert=await db.query<{visible_to_players:boolean}>("insert into vtt_dice_rolls(scene_id,roll_key,expression,total,visible_to_players) values ($1,'secret-in-hidden-scene','1d20',7,true) returning visible_to_players",[scene]);
   assert.equal(insert.rows[0].visible_to_players,false);
  });
  await db.exec("update vtt_scenes set visible_to_players=true where id='"+scene+"'");
  await asUser(db,player,async()=>{
   const list=await db.query("select id from vtt_dice_rolls");
   assert.equal(list.rows.length,0);
  });
 }finally{await db.close();}
});
test("Secret rolls do not send roll-start/roll-result Realtime events",()=>{
 const src=readFileSync(new URL("../components/vtt/useVttDice.ts",import.meta.url),"utf8");
 assert.match(src,/if\(visibleToPlayers\)void channelRef\.current\?\.send\(\{ type: "broadcast", event: "roll-start"/);
 assert.match(src,/if\(pending\.visibleToPlayers\)void channelRef\.current\?\.send\(\{ type: "broadcast", event: "roll-result"/);
});
