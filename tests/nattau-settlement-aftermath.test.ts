import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  isSettlementBuilding, mergeSettlementBuildings, settlementBuildings,
  settlementSummary, settlementStatuses,
} from "../components/settlement/settlementData";

const migration = readFileSync(new URL("../supabase/migrations/20261023123000_nattau_settlement_aftermath.sql",import.meta.url),"utf8");

test("historical UĆ layout survives while verified aftermath becomes visible", () => {
  assert.equal(settlementBuildings.length,17);
  assert.equal(new Set(settlementBuildings.map(b=>b.id)).size,17);
  const byId = (id:string) => settlementBuildings.find(b=>b.id===id);
  assert.equal(byId("flying-galleon")?.status,"destroyed");
  assert.equal(byId("residential-district")?.status,"destroyed");
  assert.equal(byId("warehouse-stables")?.status,"damaged");
  assert.equal(byId("temple-of-baldar")?.status,"active");
  assert.equal(settlementSummary.morale,"High");
  assert.equal(settlementSummary.population,"Count pending");
  assert.ok(settlementStatuses.includes("rebuilding"));
  assert.ok(settlementStatuses.includes("destroyed"));
});
test("validated live overrides replace a single landmark without removing others", () => {
  const existing=settlementBuildings.find(b=>b.id==="flying-galleon")!;
  const live={...existing,status:"rebuilding" as const,rebuildProgress:45,rebuildNote:"Construction underway"};
  assert.equal(isSettlementBuilding(live),true);
  const rows=mergeSettlementBuildings([live]);
  assert.equal(rows.length,settlementBuildings.length);
  assert.equal(rows.find(x=>x.id==="flying-galleon")?.rebuildProgress,45);
  assert.equal(mergeSettlementBuildings([{...existing,x:999}]).find(x=>x.id==="flying-galleon")?.x,48);
});
test("settlement stores are campaign restricted and seed only approved Nattau damage", async () => {
  const db=new PGlite();
  try {
    await db.exec([
      "create role anon;",
      "create role authenticated;",
      "create table public.campaigns(id uuid primary key,slug text unique not null);",
      "create function public.is_campaign_member(uuid) returns boolean language sql stable as $$ select true $$;",
      "create function public.is_campaign_dm(uuid) returns boolean language sql stable as $$ select true $$;",
      "insert into public.campaigns(id,slug) values ('00000000-0000-4000-8000-000000000001','nattau'),('00000000-0000-4000-8000-000000000002','barovia');"
    ].join("\n"));
    await db.exec(migration);
    const buildings=await db.query<{slug:string;building_key:string;status:string}>(
      "select c.slug,b.building_key,b.status from public.campaign_settlement_buildings b join public.campaigns c on b.campaign_id=c.id order by building_key"
    );
    assert.deepEqual(buildings.rows.map(r=>r.slug),["nattau","nattau","nattau"]);
    assert.deepEqual(buildings.rows.map(r=>r.building_key),["flying-galleon","residential-district","warehouse-stables"]);
    assert.deepEqual(buildings.rows.map(r=>r.status),["destroyed","destroyed","damaged"]);
    const overview=await db.query<{slug:string;morale:string}>(
      "select c.slug,o.morale from public.campaign_settlement_overview o join public.campaigns c on c.id=o.campaign_id"
    );
    assert.deepEqual(overview.rows,[{slug:"nattau",morale:"High"}]);
    const policies=await db.query<{tablename:string;cmd:string}>(
      "select tablename,cmd from pg_policies where schemaname='public' and tablename like 'campaign_settlement_%'"
    );
    assert.equal(policies.rows.length,6);
    const rowLevel=await db.query<{relname:string;relrowsecurity:boolean}>(
      "select relname,relrowsecurity from pg_class where relname in ('campaign_settlement_buildings','campaign_settlement_overview') order by relname"
    );
    assert.equal(rowLevel.rows.length,2);
    assert.ok(rowLevel.rows.every(r=>r.relrowsecurity));
  } finally {await db.close();}
});
