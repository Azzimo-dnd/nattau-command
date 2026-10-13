-- Nattau Strategic Map v1 — persistent map background, province control and faction data
begin;

create table if not exists public.campaign_strategic_map_settings (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  map_storage_path text,
  map_original_name text,
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint campaign_strategic_map_settings_name_chk
    check (map_original_name is null or char_length(trim(map_original_name)) between 1 and 240)
);

create table if not exists public.campaign_strategic_factions (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  faction_key text not null,
  name text not null,
  short_name text not null,
  description text not null default '',
  status text not null default '',
  army_count integer not null default 0 check (army_count >= 0),
  relations text[] not null default '{}',
  sort_order integer not null default 100,
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, faction_key),
  constraint campaign_strategic_factions_key_chk check (char_length(trim(faction_key)) between 1 and 80),
  constraint campaign_strategic_factions_name_chk check (char_length(trim(name)) between 1 and 120),
  constraint campaign_strategic_factions_short_name_chk check (char_length(trim(short_name)) between 1 and 80),
  constraint campaign_strategic_factions_description_chk check (char_length(description) <= 2500),
  constraint campaign_strategic_factions_status_chk check (char_length(status) <= 160)
);

create table if not exists public.campaign_strategic_provinces (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  province_number integer not null check (province_number > 0),
  name text not null,
  status text not null check (status in ('controlled', 'neutral', 'hostile', 'contested')),
  threat_level text not null check (threat_level in ('low', 'medium', 'high')),
  description text not null default '',
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, province_number),
  constraint campaign_strategic_provinces_name_chk check (char_length(trim(name)) between 1 and 120),
  constraint campaign_strategic_provinces_description_chk check (char_length(description) <= 2500)
);

create table if not exists public.campaign_strategic_province_control (
  campaign_id uuid not null,
  province_number integer not null,
  faction_key text not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (campaign_id, province_number, faction_key),
  foreign key (campaign_id, province_number)
    references public.campaign_strategic_provinces(campaign_id, province_number)
    on delete cascade,
  foreign key (campaign_id, faction_key)
    references public.campaign_strategic_factions(campaign_id, faction_key)
    on delete cascade
);

alter table public.campaign_strategic_map_settings enable row level security;
alter table public.campaign_strategic_factions enable row level security;
alter table public.campaign_strategic_provinces enable row level security;
alter table public.campaign_strategic_province_control enable row level security;

drop policy if exists "Strategic map settings read" on public.campaign_strategic_map_settings;
create policy "Strategic map settings read"
on public.campaign_strategic_map_settings for select to authenticated
using (public.is_campaign_member(campaign_id));

drop policy if exists "Strategic map settings dm insert" on public.campaign_strategic_map_settings;
create policy "Strategic map settings dm insert"
on public.campaign_strategic_map_settings for insert to authenticated
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Strategic map settings dm update" on public.campaign_strategic_map_settings;
create policy "Strategic map settings dm update"
on public.campaign_strategic_map_settings for update to authenticated
using (public.is_campaign_dm(campaign_id))
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Strategic map settings dm delete" on public.campaign_strategic_map_settings;
create policy "Strategic map settings dm delete"
on public.campaign_strategic_map_settings for delete to authenticated
using (public.is_campaign_dm(campaign_id));

drop policy if exists "Strategic factions read" on public.campaign_strategic_factions;
create policy "Strategic factions read"
on public.campaign_strategic_factions for select to authenticated
using (public.is_campaign_member(campaign_id));

drop policy if exists "Strategic factions dm insert" on public.campaign_strategic_factions;
create policy "Strategic factions dm insert"
on public.campaign_strategic_factions for insert to authenticated
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Strategic factions dm update" on public.campaign_strategic_factions;
create policy "Strategic factions dm update"
on public.campaign_strategic_factions for update to authenticated
using (public.is_campaign_dm(campaign_id))
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Strategic factions dm delete" on public.campaign_strategic_factions;
create policy "Strategic factions dm delete"
on public.campaign_strategic_factions for delete to authenticated
using (public.is_campaign_dm(campaign_id));

drop policy if exists "Strategic provinces read" on public.campaign_strategic_provinces;
create policy "Strategic provinces read"
on public.campaign_strategic_provinces for select to authenticated
using (public.is_campaign_member(campaign_id));

drop policy if exists "Strategic provinces dm insert" on public.campaign_strategic_provinces;
create policy "Strategic provinces dm insert"
on public.campaign_strategic_provinces for insert to authenticated
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Strategic provinces dm update" on public.campaign_strategic_provinces;
create policy "Strategic provinces dm update"
on public.campaign_strategic_provinces for update to authenticated
using (public.is_campaign_dm(campaign_id))
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Strategic provinces dm delete" on public.campaign_strategic_provinces;
create policy "Strategic provinces dm delete"
on public.campaign_strategic_provinces for delete to authenticated
using (public.is_campaign_dm(campaign_id));

drop policy if exists "Strategic province control read" on public.campaign_strategic_province_control;
create policy "Strategic province control read"
on public.campaign_strategic_province_control for select to authenticated
using (public.is_campaign_member(campaign_id));

drop policy if exists "Strategic province control dm insert" on public.campaign_strategic_province_control;
create policy "Strategic province control dm insert"
on public.campaign_strategic_province_control for insert to authenticated
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Strategic province control dm delete" on public.campaign_strategic_province_control;
create policy "Strategic province control dm delete"
on public.campaign_strategic_province_control for delete to authenticated
using (public.is_campaign_dm(campaign_id));

create or replace function public.set_campaign_strategic_province_control(
  p_campaign_id uuid,
  p_province_number integer,
  p_faction_keys text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the campaign DM can change strategic province control.';
  end if;

  if not exists (
    select 1
    from public.campaign_strategic_provinces p
    where p.campaign_id = p_campaign_id
      and p.province_number = p_province_number
  ) then
    raise exception 'Strategic province not found.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_faction_keys, '{}'::text[])) key
    where not exists (
      select 1
      from public.campaign_strategic_factions f
      where f.campaign_id = p_campaign_id
        and f.faction_key = key
    )
  ) then
    raise exception 'Unknown faction key.';
  end if;

  delete from public.campaign_strategic_province_control
  where campaign_id = p_campaign_id
    and province_number = p_province_number;

  insert into public.campaign_strategic_province_control (
    campaign_id,
    province_number,
    faction_key
  )
  select p_campaign_id, p_province_number, key
  from (
    select distinct unnest(coalesce(p_faction_keys, '{}'::text[])) as key
  ) keys
  where key is not null and char_length(trim(key)) > 0;
end;
$$;

revoke all on function public.set_campaign_strategic_province_control(uuid, integer, text[]) from public, anon;
grant execute on function public.set_campaign_strategic_province_control(uuid, integer, text[]) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'strategic-maps',
  'strategic-maps',
  false,
  15728640,
  array['image/webp', 'image/png', 'image/jpeg']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.strategic_map_storage_campaign_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  folder text := split_part(object_name, '/', 1);
begin
  if folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return folder::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function public.strategic_map_storage_campaign_id(text) from public, anon;
grant execute on function public.strategic_map_storage_campaign_id(text) to authenticated, service_role;

drop policy if exists "Strategic map object read" on storage.objects;
create policy "Strategic map object read"
on storage.objects for select to authenticated
using (
  bucket_id = 'strategic-maps'
  and public.is_campaign_member(public.strategic_map_storage_campaign_id(name))
);

drop policy if exists "Strategic map object upload" on storage.objects;
create policy "Strategic map object upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'strategic-maps'
  and public.is_campaign_dm(public.strategic_map_storage_campaign_id(name))
);

drop policy if exists "Strategic map object update" on storage.objects;
create policy "Strategic map object update"
on storage.objects for update to authenticated
using (
  bucket_id = 'strategic-maps'
  and public.is_campaign_dm(public.strategic_map_storage_campaign_id(name))
)
with check (
  bucket_id = 'strategic-maps'
  and public.is_campaign_dm(public.strategic_map_storage_campaign_id(name))
);

drop policy if exists "Strategic map object delete" on storage.objects;
create policy "Strategic map object delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'strategic-maps'
  and public.is_campaign_dm(public.strategic_map_storage_campaign_id(name))
);

with nattau as (
  select id from public.campaigns where slug = 'nattau' limit 1
)
insert into public.campaign_strategic_factions (
  campaign_id, faction_key, name, short_name, description, status, army_count, relations, sort_order
)
select nattau.id, seed.faction_key, seed.name, seed.short_name, seed.description, seed.status, seed.army_count, seed.relations, seed.sort_order
from nattau
cross join (values
  ('kainites', 'Kainites & Allies', 'Kainites', 'The Kainite Expedition is a growing military-religious force centered around UĆ, Baldar''s faith and the survival of the settlers.', 'Expedition command', 1, array['Trade with Merrydock', 'Non-aggression with Cult of Lord Mazamundi']::text[], 10),
  ('empire', 'Jin Yan Chao', 'Empire', 'An imperial city-state force with strong military presence on Hinewai. Their long-term intentions toward the expedition remain uncertain.', 'Imperial power', 7, array['Enemy of Wild Lizardfolk', 'Enemy of Cult of Lord Mazamundi']::text[], 20),
  ('mazamundi-cult', 'Cult of Lord Mazamundi', 'Mazamundi', 'A militant cult controlling corrupted territory. Currently bound to the Kainites by a non-aggression agreement and border passage rights.', 'Dangerous allies?', 3, array['Non-aggression with Kainites', 'Enemy of Jin Yan Chao']::text[], 30),
  ('wild-lizardfolk', 'Wild Lizardfolk', 'Lizardfolk', 'Hostile tribal forces scattered across the island. Aggressive toward nearly every other faction.', 'Hostile tribes', 3, array['Enemy of everyone']::text[], 40),
  ('merrydock', 'Merrydock', 'Merrydock', 'A northern trade settlement focused on commerce, survival and profitable neutrality.', 'Trade settlement', 0, array['Trade with Kainites', 'Neutral with Jin Yan Chao']::text[], 50)
) as seed(faction_key, name, short_name, description, status, army_count, relations, sort_order)
on conflict (campaign_id, faction_key) do nothing;

with nattau as (
  select id from public.campaigns where slug = 'nattau' limit 1
)
insert into public.campaign_strategic_provinces (
  campaign_id, province_number, name, status, threat_level, description
)
select nattau.id, seed.province_number, seed.name, seed.status, seed.threat_level, seed.description
from nattau
cross join (values
  (1, 'UĆ', 'controlled', 'low', 'Central province of the Kainite Expedition and the heartland around UĆ.'),
  (2, 'Whangaroa', 'hostile', 'high', 'Imperial province centered around Whangaroa, a major city of the Jin Yan Chao.'),
  (3, 'Guardian House', 'controlled', 'medium', 'Strategic fortress province guarding the northern approaches and mountain passes.'),
  (4, 'Northwestern Wilds', 'neutral', 'medium', 'Remote jungle and coastal wilderness west of the northern mountains.'),
  (5, 'Northern Road', 'neutral', 'low', 'Northern inland province connecting Merrydock, the mountains and the western wilds.'),
  (6, 'Merrydock', 'neutral', 'low', 'Northern trade province controlled by Merrydock, known for halflings, trade and suspiciously practical cabbage logistics.'),
  (7, 'Pipdock', 'controlled', 'medium', 'Eastern coastal province around Pipdock, important for sea access and supply routes.'),
  (8, 'Western Jungle', 'contested', 'medium', 'Dense jungle province between Whangaroa, UĆ and the southern lands.'),
  (9, 'Central Hills', 'hostile', 'high', 'Central highland and jungle region, difficult to cross and dangerous to control.'),
  (10, 'Eastern Corridor', 'hostile', 'high', 'Eastern jungle corridor between Pipdock and the southern temple lands.'),
  (11, 'Southern Ruins', 'hostile', 'high', 'Southern jungle province marked by ruins, old stonework and hostile wilderness.'),
  (12, 'Main Temple', 'hostile', 'high', 'Southern temple province dominated by ancient structures and cult influence.')
) as seed(province_number, name, status, threat_level, description)
on conflict (campaign_id, province_number) do nothing;

with nattau as (
  select id from public.campaigns where slug = 'nattau' limit 1
)
insert into public.campaign_strategic_province_control (campaign_id, province_number, faction_key)
select nattau.id, seed.province_number, seed.faction_key
from nattau
cross join (values
  (1, 'kainites'),
  (2, 'empire'),
  (3, 'kainites'),
  (6, 'merrydock'),
  (7, 'kainites'),
  (7, 'mazamundi-cult'),
  (8, 'empire'),
  (9, 'mazamundi-cult'),
  (10, 'mazamundi-cult'),
  (11, 'mazamundi-cult'),
  (12, 'wild-lizardfolk')
) as seed(province_number, faction_key)
on conflict do nothing;

commit;
