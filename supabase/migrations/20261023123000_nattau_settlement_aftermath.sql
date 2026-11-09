-- Nattau settlement aftermath: campaign-scoped live building states and overview.
-- Safe/additive: no existing strategic-map, resource or Chronicle rows are modified.
create table if not exists public.campaign_settlement_buildings (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  building_key text not null check (char_length(building_key) between 1 and 100),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in ('food','military','civic','housing','special','infrastructure')),
  status text not null check (status in ('active','stable','damaged','destroyed','rebuilding','inactive','planned')),
  x numeric(6,3) not null check (x between 0 and 100),
  y numeric(6,3) not null check (y between 0 and 100),
  icon text not null default '🏠' check (char_length(icon) between 1 and 24),
  summary text not null check (char_length(btrim(summary)) between 1 and 2000),
  output text not null default '' check (char_length(output) <= 500),
  notes text[] not null default '{}'::text[] check (cardinality(notes) <= 15),
  rebuild_progress integer not null default 0 check (rebuild_progress between 0 and 100),
  rebuild_note text not null default '' check (char_length(rebuild_note) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, building_key)
);
create index if not exists campaign_settlement_buildings_status_idx
  on public.campaign_settlement_buildings(campaign_id,status);

create table if not exists public.campaign_settlement_overview (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  population text not null check (char_length(population) between 1 and 120),
  morale text not null check (char_length(morale) between 1 and 120),
  food text not null check (char_length(food) between 1 and 120),
  defense text not null check (char_length(defense) between 1 and 120),
  civilian_casualties text not null check (char_length(civilian_casualties) between 1 and 120),
  galleon_casualties text not null check (char_length(galleon_casualties) between 1 and 120),
  military_casualties text not null check (char_length(military_casualties) between 1 and 120),
  recovery text not null check (char_length(recovery) between 1 and 120),
  updated_at timestamptz not null default now()
);

create or replace function public.update_campaign_settlement_timestamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists campaign_settlement_building_timestamp on public.campaign_settlement_buildings;
create trigger campaign_settlement_building_timestamp
  before update on public.campaign_settlement_buildings
  for each row execute function public.update_campaign_settlement_timestamp();
drop trigger if exists campaign_settlement_overview_timestamp on public.campaign_settlement_overview;
create trigger campaign_settlement_overview_timestamp
  before update on public.campaign_settlement_overview
  for each row execute function public.update_campaign_settlement_timestamp();

alter table public.campaign_settlement_buildings enable row level security;
alter table public.campaign_settlement_overview enable row level security;
revoke all on public.campaign_settlement_buildings from anon;
revoke all on public.campaign_settlement_overview from anon;
grant select,insert,update on public.campaign_settlement_buildings to authenticated;
grant select,insert,update on public.campaign_settlement_overview to authenticated;

create policy "Members view settlement buildings" on public.campaign_settlement_buildings
  for select to authenticated using (public.is_campaign_member(campaign_id));
create policy "GM creates settlement buildings" on public.campaign_settlement_buildings
  for insert to authenticated with check (public.is_campaign_dm(campaign_id));
create policy "GM edits settlement buildings" on public.campaign_settlement_buildings
  for update to authenticated
  using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));
create policy "Members view settlement overview" on public.campaign_settlement_overview
  for select to authenticated using (public.is_campaign_member(campaign_id));
create policy "GM creates settlement overview" on public.campaign_settlement_overview
  for insert to authenticated with check (public.is_campaign_dm(campaign_id));
create policy "GM edits settlement overview" on public.campaign_settlement_overview
  for update to authenticated
  using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

-- Only verified siege consequences are changed. Other landmarks retain historical
-- status until the GM confirms their current condition.
insert into public.campaign_settlement_overview
  (campaign_id,population,morale,food,defense,civilian_casualties,galleon_casualties,military_casualties,recovery)
select id,'Count pending','High','Supplies damaged','Under assessment','About 40 civilians','60 galleon crew','5 soldiers','Mobilizing'
from public.campaigns where slug='nattau'
on conflict(campaign_id) do nothing;

insert into public.campaign_settlement_buildings
(campaign_id,building_key,name,category,status,x,y,icon,summary,output,notes,rebuild_progress,rebuild_note)
select c.id,v.building_key,v.name,v.category,v.status,v.x,v.y,v.icon,v.summary,v.output,v.notes,v.rebuild_progress,v.rebuild_note
from public.campaigns c cross join (values
 ('flying-galleon','Flying Galleon','special','destroyed',48,51,'⛵','The flying galleon exploded when its core was struck during the siege. The entire 60-person crew perished.','',
  array['The wreck marks the site of a catastrophic Imperial strike.','The old settlement map shows the galleon before its destruction.'],0,'Destroyed; no reconstruction project agreed.'),
 ('warehouse-stables','Warehouse & Stables','infrastructure','damaged',31,44,'📦','The warehouse was set ablaze. Part of UĆ''s stores and supplies were lost.','',
  array['The extent of the remaining stores is still being assessed.','The status of the stables has not been separately confirmed.'],0,'Assess structural damage and salvage supplies.'),
 ('residential-district','Residential District','housing','destroyed',25,86,'🏠','Most residential buildings were burned during the Imperial siege. Survivors face an urgent housing shortage.','',
  array['Destruction applies to most houses, not necessarily every structure.','Pippo pledged workers and materials for rebuilding.'],0,'Organize housing reconstruction; exact costs and milestones are not yet agreed.')
) as v(building_key,name,category,status,x,y,icon,summary,output,notes,rebuild_progress,rebuild_note)
where c.slug='nattau'
on conflict(campaign_id,building_key) do nothing;
