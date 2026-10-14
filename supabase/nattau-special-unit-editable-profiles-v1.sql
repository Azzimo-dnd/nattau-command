-- One shared editable profile for every Nattau special unit.
-- Existing rows retain current position, visibility, mission and status.
-- An empty object means that the original War Room reference profile is used.
alter table public.campaign_strategic_special_units
  add column if not exists unit_profile jsonb not null default '{}'::jsonb;
alter table public.campaign_strategic_special_units
  add constraint special_unit_profile_object_and_size
  check (jsonb_typeof(unit_profile) = 'object' and octet_length(unit_profile::text) <= 30000);

-- Player War Room access: public profile and status, missions only for
-- units explicitly published on the map. No secret position/notes are included.
create or replace function public.get_campaign_special_unit_roster_v2(p_campaign_id uuid)
returns table (
  unit_key text,
  status text,
  mission text,
  updated_at timestamptz,
  unit_profile jsonb
)
language sql stable security definer
set search_path = ''
as $$
  select u.unit_key,u.status,
    case when u.visible_to_players then u.mission else null::text end,
    u.updated_at,u.unit_profile
  from public.campaign_strategic_special_units u
  where u.campaign_id=p_campaign_id
    and auth.uid() is not null
    and public.is_campaign_member(p_campaign_id)
  order by u.unit_key;
$$;

-- Map players only receive published and placed units, including their
-- public edited profile. Hidden units and GM notes cannot be enumerated.
create or replace function public.get_visible_strategic_special_units_v2(p_campaign_id uuid)
returns table (
  unit_key text,
  status text,
  mission text,
  location_note text,
  pos_x numeric,
  pos_y numeric,
  unit_profile jsonb
)
language sql stable security definer
set search_path = ''
as $$
  select u.unit_key,u.status,u.mission,u.location_note,
         u.pos_x,u.pos_y,u.unit_profile
  from public.campaign_strategic_special_units u
  where u.campaign_id=p_campaign_id
    and u.visible_to_players=true
    and u.pos_x is not null and u.pos_y is not null
    and auth.uid() is not null
    and public.is_campaign_member(p_campaign_id)
  order by u.unit_key;
$$;

revoke all on function public.get_campaign_special_unit_roster_v2(uuid) from public, anon;
revoke all on function public.get_visible_strategic_special_units_v2(uuid) from public, anon;
grant execute on function public.get_campaign_special_unit_roster_v2(uuid) to authenticated,service_role;
grant execute on function public.get_visible_strategic_special_units_v2(uuid) to authenticated,service_role;
