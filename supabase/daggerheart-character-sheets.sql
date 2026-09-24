-- Barovia / Daggerheart character sheets
-- Applied to project fparllzmwejvcbvayquv on 2026-09-23.
-- Character rules/content are kept data-driven; this table stores character state,
-- while source-book catalogs live separately from the public repository.

create table if not exists public.daggerheart_characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  player_id uuid references public.profiles(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  name text not null default '',
  pronouns text not null default '',
  level integer not null default 1 check (level between 1 and 10),
  class_key text,
  subclass_key text,
  ancestry_key text,
  community_key text,
  heritage_state jsonb not null default '{}'::jsonb,
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
  base_stats jsonb not null default '{"evasion":10,"proficiency":1,"hope_max":6,"hp_max":0,"stress_max":6,"armor_score":0,"major_threshold":0,"severe_threshold":0,"domain_loadout_max":5,"consumable_clear_bonus":0}'::jsonb,
  manual_stat_modifiers jsonb not null default '{}'::jsonb,
  effect_state jsonb not null default '{"active_effect_ids":[],"active_effect_values":{},"action_uses":{},"action_resets":{},"effect_resets":{}}'::jsonb,
  state_revision bigint not null default 0 check (state_revision >= 0),
  schema_version integer not null default 2,
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
create index if not exists daggerheart_characters_created_by_idx on public.daggerheart_characters(created_by);

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
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.state_revision = old.state_revision + 1;
  return new;
end;
$$;

drop trigger if exists daggerheart_characters_set_updated_at on public.daggerheart_characters;
create trigger daggerheart_characters_set_updated_at
before update on public.daggerheart_characters
for each row execute function public.set_daggerheart_character_updated_at();

revoke all on function public.set_daggerheart_character_updated_at()
  from public, anon, authenticated;

create or replace function public.list_daggerheart_character_roster(p_campaign_id uuid)
returns table (
  player_id uuid, display_name text, member_role text, character_id uuid,
  character_name text, character_level integer, character_class text
)
language plpgsql security definer set search_path = '' as $$
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
  where cm.campaign_id = p_campaign_id
    and cm.is_active = true
    and cm.role = 'player'
    and (
      public.is_campaign_dm(p_campaign_id)
      or cm.user_id = (select auth.uid())
    )
  order by lower(coalesce(p.display_name, ''));
end;
$$;

revoke all on function public.list_daggerheart_character_roster(uuid) from public;
revoke execute on function public.list_daggerheart_character_roster(uuid) from anon;
grant execute on function public.list_daggerheart_character_roster(uuid) to authenticated;


-- Keep reapplication safe for databases created before mixed ancestry support.
alter table public.daggerheart_characters
  add column if not exists heritage_state jsonb not null default '{}'::jsonb;


-- Effects engine state for dynamically derived character sheets.
alter table public.daggerheart_characters
  add column if not exists base_stats jsonb not null default
    '{"evasion":10,"proficiency":1,"hope_max":6,"hp_max":0,"stress_max":6,"armor_score":0,"major_threshold":0,"severe_threshold":0,"domain_loadout_max":5,"consumable_clear_bonus":0}'::jsonb,
  add column if not exists manual_stat_modifiers jsonb not null default '{}'::jsonb,
  add column if not exists effect_state jsonb not null default '{"active_effect_ids":[],"active_effect_values":{},"action_uses":{},"action_resets":{},"effect_resets":{}}'::jsonb,
  add column if not exists state_revision bigint not null default 0;

alter table public.daggerheart_characters
  drop constraint if exists daggerheart_character_base_stats_object,
  drop constraint if exists daggerheart_character_manual_modifiers_object,
  drop constraint if exists daggerheart_character_effect_state_object,
  drop constraint if exists daggerheart_character_state_revision_nonnegative,
  drop constraint if exists daggerheart_character_heritage_object,
  drop constraint if exists daggerheart_character_traits_object,
  drop constraint if exists daggerheart_character_experiences_array,
  drop constraint if exists daggerheart_character_domain_cards_array,
  drop constraint if exists daggerheart_character_weapons_array,
  drop constraint if exists daggerheart_character_armor_array,
  drop constraint if exists daggerheart_character_inventory_array,
  drop constraint if exists daggerheart_character_gold_object,
  drop constraint if exists daggerheart_character_background_array,
  drop constraint if exists daggerheart_character_connections_array,
  drop constraint if exists daggerheart_character_advancements_array,
  drop constraint if exists daggerheart_character_resources_array,
  drop constraint if exists daggerheart_character_class_state_object,
  drop constraint if exists daggerheart_character_subclass_state_object;

alter table public.daggerheart_characters
  add constraint daggerheart_character_base_stats_object check (jsonb_typeof(base_stats) = 'object'),
  add constraint daggerheart_character_manual_modifiers_object check (jsonb_typeof(manual_stat_modifiers) = 'object'),
  add constraint daggerheart_character_effect_state_object check (jsonb_typeof(effect_state) = 'object'),
  add constraint daggerheart_character_state_revision_nonnegative check (state_revision >= 0),
  add constraint daggerheart_character_heritage_object check (jsonb_typeof(heritage_state) = 'object'),
  add constraint daggerheart_character_traits_object check (jsonb_typeof(traits) = 'object'),
  add constraint daggerheart_character_experiences_array check (jsonb_typeof(experiences) = 'array'),
  add constraint daggerheart_character_domain_cards_array check (jsonb_typeof(domain_cards) = 'array'),
  add constraint daggerheart_character_weapons_array check (jsonb_typeof(weapons) = 'array'),
  add constraint daggerheart_character_armor_array check (jsonb_typeof(armor) = 'array'),
  add constraint daggerheart_character_inventory_array check (jsonb_typeof(inventory) = 'array'),
  add constraint daggerheart_character_gold_object check (jsonb_typeof(gold) = 'object'),
  add constraint daggerheart_character_background_array check (jsonb_typeof(background_answers) = 'array'),
  add constraint daggerheart_character_connections_array check (jsonb_typeof(connections) = 'array'),
  add constraint daggerheart_character_advancements_array check (jsonb_typeof(advancements) = 'array'),
  add constraint daggerheart_character_resources_array check (jsonb_typeof(special_resources) = 'array'),
  add constraint daggerheart_character_class_state_object check (jsonb_typeof(class_state) = 'object'),
  add constraint daggerheart_character_subclass_state_object check (jsonb_typeof(subclass_state) = 'object');

alter table public.daggerheart_characters
  alter column schema_version set default 2;


-- Final access hardening: character sheets exist only inside active Daggerheart campaigns.
-- DMs may keep character sheets unassigned until the intended player is known.
alter table public.daggerheart_characters
  alter column player_id drop not null;

create schema if not exists private;

create or replace function private.is_active_daggerheart_campaign_member(
  target_campaign_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members cm
    join public.campaigns c on c.id = cm.campaign_id
    where cm.campaign_id = target_campaign_id
      and cm.user_id = (select auth.uid())
      and cm.is_active = true
      and c.is_active = true
      and c.system_key = 'daggerheart'
  );
$$;

revoke all on function private.is_active_daggerheart_campaign_member(uuid) from public;
revoke all on function private.is_active_daggerheart_campaign_member(uuid) from anon;
grant execute on function private.is_active_daggerheart_campaign_member(uuid) to authenticated;

drop policy if exists "Daggerheart campaign members can view characters" on public.daggerheart_characters;
drop policy if exists "Daggerheart players and DMs can create characters" on public.daggerheart_characters;
drop policy if exists "Daggerheart players and DMs can update characters" on public.daggerheart_characters;
drop policy if exists "Daggerheart players and DMs can delete characters" on public.daggerheart_characters;
drop policy if exists "Active Daggerheart campaign members can view characters" on public.daggerheart_characters;
drop policy if exists "Active Daggerheart players and DMs can create characters" on public.daggerheart_characters;
drop policy if exists "Active Daggerheart players and DMs can update characters" on public.daggerheart_characters;
drop policy if exists "Active Daggerheart players and DMs can delete characters" on public.daggerheart_characters;

create policy "Active Daggerheart campaign members can view characters"
on public.daggerheart_characters for select to authenticated
using (
  (select private.is_active_daggerheart_campaign_member(campaign_id))
  and (
    player_id = (select auth.uid())
    or public.is_campaign_dm(campaign_id)
  )
);

create policy "Active Daggerheart players and DMs can create characters"
on public.daggerheart_characters for insert to authenticated
with check (
  (select private.is_active_daggerheart_campaign_member(campaign_id))
  and (
    (
      player_id is null
      and public.is_campaign_dm(campaign_id)
    )
    or (
      player_id is not null
      and public.is_active_campaign_player(campaign_id, player_id)
      and (player_id = (select auth.uid()) or public.is_campaign_dm(campaign_id))
    )
  )
);

create policy "Active Daggerheart players and DMs can update characters"
on public.daggerheart_characters for update to authenticated
using (
  (select private.is_active_daggerheart_campaign_member(campaign_id))
  and (player_id = (select auth.uid()) or public.is_campaign_dm(campaign_id))
)
with check (
  (select private.is_active_daggerheart_campaign_member(campaign_id))
  and (
    (
      player_id is null
      and public.is_campaign_dm(campaign_id)
    )
    or (
      player_id is not null
      and public.is_active_campaign_player(campaign_id, player_id)
      and (player_id = (select auth.uid()) or public.is_campaign_dm(campaign_id))
    )
  )
);

create policy "Active Daggerheart players and DMs can delete characters"
on public.daggerheart_characters for delete to authenticated
using (
  (select private.is_active_daggerheart_campaign_member(campaign_id))
  and (player_id = (select auth.uid()) or public.is_campaign_dm(campaign_id))
);

create or replace function public.prevent_daggerheart_character_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.campaign_id is distinct from old.campaign_id then
    raise exception 'Character campaign cannot be changed by UPDATE';
  end if;

  if new.player_id is distinct from old.player_id
     and not public.is_campaign_dm(old.campaign_id) then
    raise exception 'Only the campaign DM can assign or reassign a character sheet';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_daggerheart_character_reassignment on public.daggerheart_characters;
create trigger prevent_daggerheart_character_reassignment
before update on public.daggerheart_characters
for each row execute function public.prevent_daggerheart_character_reassignment();

revoke all on function public.prevent_daggerheart_character_reassignment()
  from public, anon, authenticated;

create or replace function public.list_daggerheart_character_roster(p_campaign_id uuid)
returns table (
  player_id uuid, display_name text, member_role text, character_id uuid,
  character_name text, character_level integer, character_class text
)
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_active_daggerheart_campaign_member(p_campaign_id)) then
    raise exception 'Active Daggerheart campaign membership required';
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

revoke all on table public.daggerheart_characters from anon;
revoke all on table public.daggerheart_characters from authenticated;
grant select, insert, update, delete on table public.daggerheart_characters to authenticated;

revoke all on function public.list_daggerheart_character_roster(uuid) from public;
revoke all on function public.list_daggerheart_character_roster(uuid) from anon;
grant execute on function public.list_daggerheart_character_roster(uuid) to authenticated;
