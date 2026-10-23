import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {PGlite} from "@electric-sql/pglite";
import {militaryUnits,formatDeploymentCost} from "../components/military/militaryData";
import {specialUnitByKey,resolveSpecialUnitProfile,validateSpecialUnitProfile,specialUnitDefaults} from "../lib/strategic-map/specialUnits";

const sql=readFileSync(new URL("../supabase/migrations/20261023095829_nattau_vengeful_thirteen.sql",import.meta.url),"utf8");
const key="vengeful-thirteen";

test("Thirteen Avengers are one distinct War Room and Strategic Map special unit",()=>{
 const def=specialUnitByKey(key);
 assert.ok(def);
 assert.equal(def?.unit.name,"The Vengeful Thirteen");
 assert.equal(def?.unit.commander,"Kevin — Avenger of Nithis");
 assert.match(def?.unit.size??"",/13 warriors \(Kevin \+ 12 veterans\)/);
 assert.equal(militaryUnits.length,9);
 assert.equal(new Set(militaryUnits.map(x=>x.name)).size,militaryUnits.length);
 assert.equal(specialUnitDefaults("campaign-1").filter(x=>x.unit_key===key).length,1);
});
test("Avengers have two durability, no RP deployment expense and no upkeep",()=>{
 const profile=resolveSpecialUnitProfile(key,null);
 assert.ok(profile);
 assert.deepEqual(profile?.durability,{type:"finite",current:2,max:2});
 assert.deepEqual(profile?.cost,{type:"resource",resource:"RP",options:[{amount:0}]});
 assert.equal(formatDeploymentCost(profile!.cost),"Free · no upkeep");
 assert.equal(validateSpecialUnitProfile(profile!),null);
 assert.match(profile!.detail,/brutal, dirty fighting and swift elimination/i);
 assert.match(profile!.detail,/captured Imperial armor and weapons/);
});
test("Roster data seed creates only Nattau's unit and never overwrites a revised unit",async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create table campaigns(id uuid primary key,slug text unique not null);
   create table campaign_strategic_special_units(
      campaign_id uuid not null,unit_key text not null,status text not null,
      mission text not null,location_note text not null,gm_notes text not null,
      pos_x numeric,pos_y numeric,visible_to_players boolean not null,
      unit_profile jsonb not null,primary key(campaign_id,unit_key));
  `);
  await db.query("insert into campaigns(id,slug) values ('00000000-0000-4000-8000-000000000001','nattau'),('00000000-0000-4000-8000-000000000002','barovia')");
  await db.exec(sql);
  const rows=await db.query<{slug:string;unit_key:string;unit_profile:Record<string,unknown>;visible_to_players:boolean}>(
   "select c.slug,u.unit_key,u.unit_profile,u.visible_to_players from campaign_strategic_special_units u join campaigns c on c.id=u.campaign_id");
  assert.equal(rows.rows.length,1);
  assert.equal(rows.rows[0].slug,"nattau");
  assert.equal(rows.rows[0].unit_key,key);
  assert.equal(rows.rows[0].visible_to_players,false);
  const seeded=resolveSpecialUnitProfile(key,rows.rows[0].unit_profile);
  assert.ok(seeded);
  assert.equal(validateSpecialUnitProfile(seeded!),null);
  assert.deepEqual(seeded?.durability,{type:"finite",current:2,max:2});
  await db.exec("update campaign_strategic_special_units set status='On Mission' where unit_key='vengeful-thirteen'");
  await db.exec(sql);
  const state=await db.query<{status:string}>("select status from campaign_strategic_special_units where unit_key=$1",[key]);
  assert.equal(state.rows.length,1);
  assert.equal(state.rows[0].status,"On Mission");
 } finally {await db.close();}
});
test("Chronicle proposals use existing public tag values and short factual entries",()=>{
 const content=readFileSync(new URL("../docs/nattau-siege-of-uc-chronicle-proposals.md",import.meta.url),"utf8");
 const matches=[...content.matchAll(/^\| (Military|Settlement|Intelligence|Arcane Incident) \| ([^|]+) \| ([^|]+) \|$/gm)];
 assert.equal(matches.length,10);
 for(const match of matches){assert.ok(match[2].length<=140);assert.ok(match[3].length<=2500);}
 assert.match(content,/Mira.*missing/i);
 assert.match(content,/Torsten.*morale/i);
});
