import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  new URL("../supabase/migrations/20261022123840_nattau_fate_high_level_balance.sql", import.meta.url),
  "utf8",
);

const originals = [
  {slug:"the-magician",flipped:false,old:"Once, add 1d4 to an Arcana, Investigation, or tool check after seeing the d20 but before the outcome is declared."},
  {slug:"the-lovers",flipped:true,old:"Once, when another player you can see fails an ability check, let them add 1d4 to the result. You cannot choose yourself."},
  {slug:"the-chariot",flipped:true,old:"Once, ignore difficult terrain and increase your speed by 10 feet until the end of your turn."},
  {slug:"wheel-of-fortune",flipped:false,old:"Once, reroll one damage, healing, or random-effect die that is not a d20. You must use the new result."},
  {slug:"death",flipped:true,old:"Once after completing a short rest, regain one expended Hit Die."},
  {slug:"the-tower",flipped:true,old:"Once, when you fail a Dexterity saving throw against a trap, collapse, explosion, or area effect, reduce the damage you take by twice your proficiency bonus."},
  {slug:"the-star",flipped:true,old:"Once when you receive magical or mundane healing, maximize one healing die."},
] as const;
const battle = "00000000-0000-4000-8000-000000000006";
const past = "00000000-0000-4000-8000-000000000005";

async function prepare(db: PGlite, tampered = false) {
  await db.exec(`
    create table public.fate_cards (
      id smallint primary key,
      slug text unique not null,
      is_active boolean not null,
      is_ready boolean not null,
      upright_reward_description text not null,
      reversed_reward_description text not null,
      updated_at timestamptz not null default now()
    );
    create table public.fate_cycles (
      id uuid primary key,
      cycle_number bigint not null,
      title text not null,
      is_active boolean not null
    );
    create table public.fate_draws (
      id uuid primary key,
      cycle_id uuid not null references public.fate_cycles(id),
      card_id smallint not null references public.fate_cards(id),
      is_reversed boolean not null,
      reward_description_snapshot text not null
    );
  `);
  await db.query("insert into public.fate_cycles values ($1,6,'Battle of UĆ',true),($2,5,'Previous cycle',false)", [battle,past]);
  for (let i=0;i<originals.length;i++) {
    const entry=originals[i];
    const other="UNCHANGED opposite reward "+entry.slug;
    await db.query(`insert into public.fate_cards
      (id,slug,is_active,is_ready,upright_reward_description,reversed_reward_description)
      values($1,$2,true,true,$3,$4)`,[
        i+1,entry.slug,
        entry.flipped?other:entry.old,
        entry.flipped?(tampered&&i===0?"unexpected edit":entry.old):other,
      ]);
  }
  await db.query("insert into public.fate_cards values(19,'the-fool',true,true,'reroll d20','other skill check',now()),(20,'the-empress',false,false,'Awaiting Design','Awaiting Design',now())");
  const tower=originals.find(x=>x.slug==="the-tower")!;
  await db.query("insert into public.fate_draws values('00000000-0000-4000-8000-000000000031',$1,6,true,$2),('00000000-0000-4000-8000-000000000032',$3,6,true,$2)",[battle,tower.old,past]);
  const magic=originals.find(x=>x.slug==="the-magician")!;
  await db.query("insert into public.fate_draws values('00000000-0000-4000-8000-000000000033',$1,1,false,$2)",[battle,magic.old]);
}

test("migration upgrades only seven active reward faces; opposites and draft cards remain untouched",async()=>{
  const db=new PGlite();
  try {
    await prepare(db);
    await db.exec(migration);
    const rows=await db.query<{slug:string;upright_reward_description:string;reversed_reward_description:string}>(
      "select slug,upright_reward_description,reversed_reward_description from public.fate_cards order by id"
    );
    assert.equal(rows.rows.length,9);
    let changed=0;
    for (const expected of originals){
      const row=rows.rows.find(x=>x.slug===expected.slug)!;
      const changedFace=expected.flipped?row.reversed_reward_description:row.upright_reward_description;
      const unchangedFace=expected.flipped?row.upright_reward_description:row.reversed_reward_description;
      assert.notEqual(changedFace,expected.old,expected.slug+" must be stronger");
      assert.equal(unchangedFace,"UNCHANGED opposite reward "+expected.slug,expected.slug+" other face must not change");
      changed++;
    }
    assert.equal(changed,7);
    const fool=rows.rows.find(x=>x.slug==="the-fool")!;
    assert.equal(fool.upright_reward_description,"reroll d20");
    assert.equal(fool.reversed_reward_description,"other skill check");
    const draft=rows.rows.find(x=>x.slug==="the-empress")!;
    assert.equal(draft.upright_reward_description,"Awaiting Design");
  } finally {await db.close();}
});

test("Tower already drawn during Battle of UĆ uses level × PB, earlier Fate history keeps original",async()=>{
  const db=new PGlite();
  try {
    await prepare(db);await db.exec(migration);
    const draws=await db.query<{cycle_number:number;reward_description_snapshot:string}>(
      "select c.cycle_number,d.reward_description_snapshot from fate_draws d join fate_cycles c on c.id=d.cycle_id where d.card_id=6 order by c.cycle_number desc");
    assert.equal(draws.rows.length,2);
    assert.match(draws.rows[0].reward_description_snapshot,/character level multiplied by your proficiency bonus/);
    assert.equal(draws.rows[1].reward_description_snapshot,originals.find(x=>x.slug==="the-tower")!.old);
    const magician=await db.query<{reward_description_snapshot:string}>("select reward_description_snapshot from fate_draws where card_id=1");
    assert.match(magician.rows[0].reward_description_snapshot,/twice your proficiency bonus/);
  } finally {await db.close();}
});

test("a changed live definition aborts the entire migration rather than silently overwriting GM edits",async()=>{
  const db=new PGlite();
  try {
    await prepare(db);
    await db.query("update public.fate_cards set upright_reward_description='GM CUSTOM' where slug='the-magician'");
    await assert.rejects(db.exec(migration),/expected exactly 7 live cards|transaction is aborted/i);
    await db.exec("rollback;");
    const res=await db.query<{upright_reward_description:string}>("select upright_reward_description from public.fate_cards where slug='the-magician'");
    assert.equal(res.rows[0].upright_reward_description,"GM CUSTOM");
    const tower=await db.query<{reversed_reward_description:string}>("select reversed_reward_description from public.fate_cards where slug='the-tower'");
    assert.equal(tower.rows[0].reversed_reward_description,originals.find(x=>x.slug==="the-tower")!.old);
  } finally {await db.close();}
});

test("level-12 encounter rewards scale meaningfully without buffing everyone in an area spell",async()=>{
  const db=new PGlite();
  try {
    await prepare(db);await db.exec(migration);
    const rows=await db.query<{slug:string;upright_reward_description:string;reversed_reward_description:string}>(
      "select slug,upright_reward_description,reversed_reward_description from fate_cards");
    const get=(slug:string,reversed:boolean)=>{const c=rows.rows.find(x=>x.slug===slug)!;return reversed?c.reversed_reward_description:c.upright_reward_description;};
    assert.match(get("the-tower",true),/after applying any resistance or vulnerability/);
    assert.equal(12*4,48);
    assert.match(get("the-chariot",true),/5 feet times your proficiency bonus/);
    assert.match(get("wheel-of-fortune",false),/For that creature only/);
    assert.match(get("wheel-of-fortune",false),/one creature affected/);
    assert.match(get("death",true),/immediately spend/);
    assert.match(get("the-star",true),/without exceeding your hit point maximum/);
  } finally {await db.close();}
});
