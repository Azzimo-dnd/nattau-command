-- Nattau flying galleon: one vessel per campaign, GM writes, safe player projection.
create table if not exists public.campaign_strategic_galleon (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  name text not null default 'Latający Galeon Kainitów'
    check (char_length(btrim(name)) between 1 and 120),
  pos_x numeric(6,3) check (pos_x between 0 and 100),
  pos_y numeric(6,3) check (pos_y between 0 and 100),
  visible_to_players boolean not null default true,
  status text not null default 'landed'
    check (status in ('airborne','anchored','landed','under_repair')),
  flight_ready boolean not null default true,
  hull_hp integer not null default 400 check (hull_hp between 0 and 400),
  core_hp integer not null default 120 check (core_hp between 0 and 120),
  sails_hp integer not null default 100 check (sails_hp between 0 and 100),
  crew_status text not null default 'Ready'
    check (char_length(crew_status) <= 160),
  condition_notes text not null default ''
    check (char_length(condition_notes) <= 1200),
  gm_notes text not null default ''
    check (char_length(gm_notes) <= 2500),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint strategic_galleon_position_pair_check
    check ((pos_x is null) = (pos_y is null))
);

alter table public.campaign_strategic_galleon enable row level security;

create policy "Galleon GM read" on public.campaign_strategic_galleon
  for select to authenticated using (public.is_campaign_dm(campaign_id));
create policy "Galleon GM insert" on public.campaign_strategic_galleon
  for insert to authenticated with check (public.is_campaign_dm(campaign_id));
create policy "Galleon GM update" on public.campaign_strategic_galleon
  for update to authenticated using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

grant select, insert, update on public.campaign_strategic_galleon to authenticated;

-- A public-facing Data API projection. No direct SELECT access to raw rows for non-GMs.
-- Never return gm_notes, updated_by or hidden/unplaced coordinates to players.
create or replace function public.get_visible_strategic_galleon(p_campaign_id uuid)
returns table (
  campaign_id uuid,
  name text,
  pos_x numeric,
  pos_y numeric,
  status text,
  flight_ready boolean,
  hull_hp integer,
  core_hp integer,
  sails_hp integer,
  crew_status text,
  condition_notes text
)
language sql stable security definer
set search_path = ''
as $$
  select g.campaign_id, g.name, g.pos_x, g.pos_y, g.status,
         g.flight_ready, g.hull_hp, g.core_hp, g.sails_hp,
         g.crew_status, g.condition_notes
  from public.campaign_strategic_galleon g
  where g.campaign_id = p_campaign_id
    and g.visible_to_players = true
    and g.pos_x is not null and g.pos_y is not null
    and auth.uid() is not null
    and public.is_campaign_member(p_campaign_id)
  limit 1;
$$;

revoke all on function public.get_visible_strategic_galleon(uuid) from public, anon;
grant execute on function public.get_visible_strategic_galleon(uuid) to authenticated, service_role;
