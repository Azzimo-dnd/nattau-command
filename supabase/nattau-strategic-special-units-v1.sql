-- Nattau strategic special-unit markers.
-- Independent of strategic armies and the War Room's static combat sheets.
create table if not exists public.campaign_strategic_special_units (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  unit_key text not null check (char_length(unit_key) between 1 and 90),
  status text not null default 'Ready' check (char_length(status) between 1 and 80),
  mission text not null default '' check (char_length(mission) <= 1000),
  location_note text not null default '' check (char_length(location_note) <= 320),
  gm_notes text not null default '' check (char_length(gm_notes) <= 2500),
  pos_x numeric(6,3) check (pos_x between 0 and 100),
  pos_y numeric(6,3) check (pos_y between 0 and 100),
  visible_to_players boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, unit_key),
  constraint special_unit_position_pair check ((pos_x is null) = (pos_y is null))
);
alter table public.campaign_strategic_special_units enable row level security;
create policy "GM reads special units" on public.campaign_strategic_special_units
  for select to authenticated using (public.is_campaign_dm(campaign_id));
create policy "GM creates special units" on public.campaign_strategic_special_units
  for insert to authenticated with check (public.is_campaign_dm(campaign_id));
create policy "GM updates special units" on public.campaign_strategic_special_units
  for update to authenticated using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));
grant select, insert, update on public.campaign_strategic_special_units to authenticated;

-- Registered War Room units, initially unplaced and invisible: the GM selects
-- the actual positions and decides what each player is allowed to see.
insert into public.campaign_strategic_special_units (campaign_id,unit_key,status)
select c.id, seeded.unit_key, seeded.status
from public.campaigns c
cross join (values
 ('defensive-detachment','Ready'),
 ('artillery-corps','Ready'),
 ('hunters-of-ared','On Mission'),
 ('daughters-of-kain','Inactive'),
 ('pavise-brothers-of-kain','Ready'),
 ('triboar-guard','Garrisoned'),
 ('pit-stop-crew','Supporting'),
 ('azzimos-carnival','Ready')
) as seeded(unit_key,status)
where c.slug='nattau'
on conflict (campaign_id,unit_key) do nothing;

-- Player-safe projection: only individually published, placed markers.
-- The secret GM notes and hidden unit information are not returned.
create or replace function public.get_visible_strategic_special_units(p_campaign_id uuid)
returns table (
  unit_key text,
  status text,
  mission text,
  location_note text,
  pos_x numeric,
  pos_y numeric
)
language sql stable security definer
set search_path = ''
as $$
  select u.unit_key, u.status, u.mission, u.location_note, u.pos_x, u.pos_y
  from public.campaign_strategic_special_units u
  where u.campaign_id=p_campaign_id
    and u.visible_to_players=true
    and u.pos_x is not null and u.pos_y is not null
    and auth.uid() is not null
    and public.is_campaign_member(p_campaign_id)
  order by u.unit_key;
$$;
revoke all on function public.get_visible_strategic_special_units(uuid) from public, anon;
grant execute on function public.get_visible_strategic_special_units(uuid) to authenticated, service_role;
