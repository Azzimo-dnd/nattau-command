-- Barovia / Daggerheart character sheets
-- Applied to project fparllzmwejvcbvayquv on 2026-09-23.
-- Character rules/content are kept data-driven; this table stores character state,
-- while source-book catalogs live separately from the public repository.

create table if not exists public.daggerheart_characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  name text not null default '',
  pronouns text not null default '',
  level integer not null default 1 check (level between 1 and 10),
  class_key text,
  subclass_key text,
  ancestry_key text,
  community_key text,
  transformations text[] not null default '{}',
  traits jsonb not null default '{"agility":0,"strength":0,"finesse":0,"instinct":0,"presence":0,"knowledge":0}'::jsonb,
  evasion integer not null default 10,
  proficiency integer not null default 1 check (proficiency between 0 and 10),
  hope_current integer not null default 2 check (hope_current >= 0),
  hope_max integer not null default 6 check (hope_max >= 0),
  hp_current integer not null default 0 check (hp_current >= 0),
  hp_max integer not null default 0 check (hp_max >= 0),
  stress_current integer not null default 0 check (stress_current >= 0),
  stress_max integer not null default 6 check (stress_max >= 0),
  armor_score integer not null default 0 check (armor_score >= 0),
  armor_slots_current integer not null default 0 check (armor_slots_current >= 0),
  armor_slots_max integer not null default 0 check (armor_slots_max >= 0),
  major_threshold integer not null default 0 check (major_threshold >= 0),
  severe_threshold integer not null default 0 check (severe_threshold >= 0),
  experiences jsonb not null default '[]'::jsonb,
  domain_cards jsonb not null default '[]'::jsonb,
  weapons jsonb not null default '[]'::jsonb,
  armor jsonb not null default '[]'::jsonb,
  inventory jsonb not null default '[]'::jsonb,
  gold jsonb not null default '{"handfuls":0,"bags":0,"chests":0}'::jsonb,
  background_answers jsonb not null default '[]'::jsonb,
  connections jsonb not null default '[]'::jsonb,
  advancements jsonb not null default '[]'::jsonb,
  special_resources jsonb not null default '[]'::jsonb,
  class_state jsonb not null default '{}'::jsonb,
  subclass_state jsonb not null default '{}'::jsonb,
  transformation_notes text not null default '',
  description text not null default '',
  notes text not null default '',
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daggerheart_character_threshold_order check (major_threshold <= severe_threshold),
  constraint daggerheart_character_hope_bounds check (hope_current <= hope_max),
  constraint daggerheart_character_hp_bounds check (hp_current <= hp_max or hp_max = 0),
  constraint daggerheart_character_stress_bounds check (stress_current <= stress_max),
  constraint daggerheart_character_armor_bounds check (armor_slots_current <= armor_slots_max or armor_slots_max = 0)
);

create unique index if not exists daggerheart_one_active_character_per_player
  on public.daggerheart_characters(campaign_id, player_id) where is_active;
create index if not exists daggerheart_characters_campaign_idx on public.daggerheart_characters(campaign_id);
create index if not exists daggerheart_characters_player_idx on public.daggerheart_characters(player_id);

alter table public.daggerheart_characters enable row level security;

drop policy if exists "Daggerheart campaign members can view characters" on public.daggerheart_characters;
drop policy if exists "Daggerheart players and DMs can create characters" on public.daggerheart_characters;
drop policy if exists "Daggerheart players and DMs can update characters" on public.daggerheart_characters;
drop policy if exists "Daggerheart players and DMs can delete characters" on public.daggerheart_characters;

create policy "Daggerheart campaign members can view characters"
on public.daggerheart_characters for select to authenticated
using (public.is_campaign_member(campaign_id));

create policy "Daggerheart players and DMs can create characters"
on public.daggerheart_characters for insert to authenticated
with check (
  public.is_active_campaign_player(campaign_id, player_id)
  and (player_id = (select auth.uid()) or public.is_campaign_dm(campaign_id))
);

create policy "Daggerheart players and DMs can update characters"
on public.daggerheart_characters for update to authenticated
using (player_id = (select auth.uid()) or public.is_campaign_dm(campaign_id))
with check (
  public.is_active_campaign_player(campaign_id, player_id)
  and (player_id = (select auth.uid()) or public.is_campaign_dm(campaign_id))
);

create policy "Daggerheart players and DMs can delete characters"
on public.daggerheart_characters for delete to authenticated
using (player_id = (select auth.uid()) or public.is_campaign_dm(campaign_id));

grant select, insert, update, delete on public.daggerheart_characters to authenticated;

create or replace function public.set_daggerheart_character_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists daggerheart_characters_set_updated_at on public.daggerheart_characters;
create trigger daggerheart_characters_set_updated_at
before update on public.daggerheart_characters
for each row execute function public.set_daggerheart_character_updated_at();

create or replace function public.list_daggerheart_character_roster(p_campaign_id uuid)
returns table (
  player_id uuid, display_name text, member_role text, character_id uuid,
  character_name text, character_level integer, character_class text
)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_campaign_member(p_campaign_id) then
    raise exception 'Campaign membership required';
  end if;
  return query
  select cm.user_id, coalesce(p.display_name, 'Unknown wanderer')::text, cm.role::text,
         dc.id, nullif(dc.name, '')::text, dc.level, dc.class_key::text
  from public.campaign_members cm
  join public.profiles p on p.id = cm.user_id
  left join public.daggerheart_characters dc
    on dc.campaign_id = cm.campaign_id and dc.player_id = cm.user_id and dc.is_active = true
  where cm.campaign_id = p_campaign_id and cm.is_active = true and cm.role = 'player'
  order by lower(coalesce(p.display_name, ''));
end;
$$;

revoke all on function public.list_daggerheart_character_roster(uuid) from public;
grant execute on function public.list_daggerheart_character_roster(uuid) to authenticated;
