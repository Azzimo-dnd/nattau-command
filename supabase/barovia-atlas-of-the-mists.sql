-- ============================================================
-- Beyond the Mists: Atlas of the Mists
-- Requires: supabase/multi-campaign-foundation.sql
--
-- Creates a campaign-scoped, GM-controlled map marker layer.
-- The supplied Barovia image remains a static public asset; all
-- names, visibility states and notes are stored in Supabase.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.campaign_map_locations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  slug text not null,
  name text not null,
  rumor_name text,
  category text not null default 'custom',
  visibility_status text not null default 'hidden',
  x_percent numeric(6,3) not null,
  y_percent numeric(6,3) not null,
  player_summary text not null default '',
  rumor_summary text not null default '',
  gm_notes text not null default '',
  icon_key text,
  sort_order integer not null default 500,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_map_locations_campaign_slug_key unique (campaign_id, slug),
  constraint campaign_map_locations_category_check check (
    category in (
      'settlement', 'castle', 'ruin', 'landmark', 'shrine',
      'wilderness', 'danger', 'gate', 'custom'
    )
  ),
  constraint campaign_map_locations_visibility_check check (
    visibility_status in ('hidden', 'rumored', 'discovered', 'visited')
  ),
  constraint campaign_map_locations_x_check check (x_percent between 0 and 100),
  constraint campaign_map_locations_y_check check (y_percent between 0 and 100)
);

create index if not exists campaign_map_locations_campaign_idx
  on public.campaign_map_locations(campaign_id, is_active, visibility_status);

create index if not exists campaign_map_locations_sort_idx
  on public.campaign_map_locations(campaign_id, sort_order, name);

create or replace function public.set_campaign_map_location_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campaign_map_locations_set_updated_at
  on public.campaign_map_locations;
create trigger campaign_map_locations_set_updated_at
before update on public.campaign_map_locations
for each row execute function public.set_campaign_map_location_updated_at();

alter table public.campaign_map_locations enable row level security;

revoke all on public.campaign_map_locations from anon;
grant select, insert, update, delete on public.campaign_map_locations to authenticated;

-- Members see only active locations permitted by the GM.
-- Campaign DMs see the complete marker layer, including hidden/inactive entries.
drop policy if exists "Campaign members can view permitted map locations"
  on public.campaign_map_locations;
create policy "Campaign members can view permitted map locations"
on public.campaign_map_locations
for select
to authenticated
using (
  public.is_campaign_member(campaign_id)
  and (
    public.is_campaign_dm(campaign_id)
    or (is_active = true and visibility_status <> 'hidden')
  )
);

drop policy if exists "Campaign DMs can add map locations"
  on public.campaign_map_locations;
create policy "Campaign DMs can add map locations"
on public.campaign_map_locations
for insert
to authenticated
with check (
  public.is_campaign_dm(campaign_id)
  and (created_by is null or created_by = auth.uid())
  and (updated_by is null or updated_by = auth.uid())
);

drop policy if exists "Campaign DMs can update map locations"
  on public.campaign_map_locations;
create policy "Campaign DMs can update map locations"
on public.campaign_map_locations
for update
to authenticated
using (public.is_campaign_dm(campaign_id))
with check (
  public.is_campaign_dm(campaign_id)
  and (updated_by is null or updated_by = auth.uid())
);

drop policy if exists "Campaign DMs can remove map locations"
  on public.campaign_map_locations;
create policy "Campaign DMs can remove map locations"
on public.campaign_map_locations
for delete
to authenticated
using (public.is_campaign_dm(campaign_id));

-- Seed locations from the labelled reference map. Every entry starts hidden,
-- so installing the module cannot reveal campaign information to players.
-- Coordinates use percentages and can be repositioned directly in GM mode.
insert into public.campaign_map_locations (
  campaign_id,
  slug,
  name,
  rumor_name,
  category,
  visibility_status,
  x_percent,
  y_percent,
  player_summary,
  rumor_summary,
  gm_notes,
  sort_order
)
select
  c.id,
  seed.slug,
  seed.name,
  seed.rumor_name,
  seed.category,
  'hidden',
  seed.x_percent,
  seed.y_percent,
  seed.player_summary,
  seed.rumor_summary,
  'Seeded from the labelled DM Andy reference map. Reposition or rewrite this entry as needed.',
  seed.sort_order
from public.campaigns c
cross join (
  values
    ('krezk', 'Krezk', 'A settlement beyond the western road', 'settlement', 12.000, 31.500, 'A fortified settlement in western Barovia.', 'Travelers speak of walls and guarded gates somewhere in the west.', 100),
    ('lake-baratok', 'Lake Baratok', 'The smaller northern lake', 'landmark', 21.700, 24.800, 'A cold lake surrounded by dense woodland.', 'A lonely body of water is said to lie beyond the western woods.', 110),
    ('vallaki', 'Vallaki', 'A town beside the great lake', 'settlement', 40.300, 32.600, 'A walled settlement near Lake Zarovich.', 'The road is said to lead toward a guarded town beneath the northern lake.', 120),
    ('lake-zarovich', 'Lake Zarovich', 'The great northern lake', 'landmark', 48.700, 24.200, 'The largest lake marked upon the valley map.', 'A broad sheet of dark water lies north of the central road.', 130),
    ('old-bonegrinder', 'Old Bonegrinder', 'The old mill', 'danger', 49.500, 42.000, 'An old windmill standing alone in the hills.', 'A solitary mill is whispered to stand beside the road east of Vallaki.', 140),
    ('west-gate', 'Western Gate of Barovia', 'A gate in the pass', 'gate', 56.700, 43.500, 'A monumental gate along the Old Svalich Road.', 'Stone gates are said to divide the valley roads.', 150),
    ('tser-falls', 'Tser Falls', 'The great waterfall', 'landmark', 55.300, 51.500, 'A powerful waterfall cutting through the central highlands.', 'The sound of distant water is heard beneath the cliffs.', 160),
    ('castle-ravenloft', 'Castle Ravenloft', 'The castle above the valley', 'castle', 71.100, 51.800, 'A vast castle overlooking the eastern valley.', 'A black fortress is said to watch the roads from the heights.', 170),
    ('tser-pool', 'Tser Pool', 'The pool beside the road', 'landmark', 69.700, 61.700, 'A secluded pool where several roads and waterways meet.', 'Campfire stories mention still water and wandering travelers.', 180),
    ('village-of-barovia', 'Village of Barovia', 'The village beneath the castle', 'settlement', 77.100, 62.500, 'A village in the eastern reaches of the valley.', 'A settlement lies beneath the shadow of the eastern castle.', 190),
    ('east-gate', 'Eastern Gate of Barovia', 'The eastern gate', 'gate', 93.600, 57.000, 'A monumental gate near the eastern edge of the valley.', 'The eastern road is said to end at ancient gates.', 200),
    ('argynvostholt', 'Argynvostholt', 'The manor in the hills', 'ruin', 32.800, 48.300, 'An isolated manor among the western hills.', 'Old stones are said to stand above the road south of Vallaki.', 210),
    ('berez', 'Berez', 'The drowned ruins', 'ruin', 32.400, 58.600, 'Ruins scattered among marshy ground and waterways.', 'Travelers avoid low ground where a village is said to have vanished.', 220),
    ('wizard-of-wines', 'Wizard of Wines', 'The vineyard in the west', 'landmark', 10.200, 48.200, 'A remote vineyard surrounded by western woodland.', 'Some claim vines still grow in a clearing beyond the western road.', 230),
    ('yester-hill', 'Yester Hill', 'The ring upon the hill', 'danger', 5.500, 61.200, 'A lonely hill marked by an ancient stone circle.', 'A circle of stones is rumored to stand near the western Mists.', 240),
    ('tsolenka-pass', 'Tsolenka Pass', 'The mountain pass', 'gate', 20.300, 62.000, 'A mountain route leading toward the southern peaks.', 'A narrow pass is said to cut through the western mountains.', 250),
    ('luna-lake', 'Luna Lake', 'The southern lake', 'landmark', 23.500, 79.500, 'A long lake lying beneath the western mountains.', 'A cold lake waits beyond the mountain roads.', 260),
    ('mount-ghakis', 'Mount Ghakis', 'The southern mountain', 'wilderness', 35.700, 77.200, 'A vast and dangerous mountain range in southern Barovia.', 'Snowbound peaks dominate the southern horizon.', 270),
    ('amber-temple', 'The Amber Temple', 'A temple beneath the mountain', 'shrine', 35.700, 84.300, 'An ancient temple hidden among the southern peaks.', 'A forbidden sanctuary is rumored to sleep beneath the mountain.', 280),
    ('mount-baratok', 'Mount Baratok', 'The northern mountain', 'wilderness', 67.700, 9.600, 'A towering mountain beyond the northern woods.', 'A distant peak rises above the forests north of the lake.', 290),
    ('river-ivlis-crossroads', 'River Ivlis Crossroads', 'The river crossroads', 'landmark', 68.800, 72.100, 'A meeting of road and river south of the eastern settlements.', 'Several paths are said to meet beside the river.', 300)
) as seed(
  slug,
  name,
  rumor_name,
  category,
  x_percent,
  y_percent,
  player_summary,
  rumor_summary,
  sort_order
)
where c.slug = 'barovia'
on conflict (campaign_id, slug) do nothing;

-- Realtime keeps GM visibility changes synchronized on connected player screens.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'campaign_map_locations'
  ) then
    alter publication supabase_realtime add table public.campaign_map_locations;
  end if;
end;
$$;
