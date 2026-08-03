-- ============================================================
-- Campaign Companion — Multi-Campaign Foundation v1
--
-- This migration creates the campaign registry and campaign-specific
-- memberships. It does NOT yet move Nattau planner, fate or session data
-- into campaign-specific tables. That separation belongs to Phase 2.
--
-- Initial assignment rules:
--   * every existing profile receives access to Nattau;
--   * every existing global DM receives access to Barovia as DM;
--   * the profile named Pippo receives access to Barovia as a test player;
--   * Pippo is excluded from planning calculations in both campaigns.
-- ============================================================

begin;

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists planning_enabled boolean not null default true;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  companion_name text not null,
  subtitle text not null default 'Campaign Companion',
  system_key text not null,
  theme_key text not null,
  enabled_modules text[] not null default '{}',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'player',
  planning_enabled boolean not null default true,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, user_id),
  constraint campaign_members_role_check check (role in ('dm', 'player'))
);

create index if not exists campaign_members_user_id_idx
  on public.campaign_members(user_id);

create index if not exists campaign_members_campaign_active_idx
  on public.campaign_members(campaign_id, is_active);

create or replace function public.set_campaign_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_campaign_updated_at();

drop trigger if exists campaign_members_set_updated_at on public.campaign_members;
create trigger campaign_members_set_updated_at
before update on public.campaign_members
for each row execute function public.set_campaign_updated_at();

-- SECURITY DEFINER helpers prevent recursive RLS checks on campaign_members.
create or replace function public.is_campaign_member(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
  );
$$;

create or replace function public.is_campaign_dm(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role = 'dm'
      and cm.is_active = true
  );
$$;

grant execute on function public.is_campaign_member(uuid) to authenticated;
grant execute on function public.is_campaign_dm(uuid) to authenticated;

alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;

revoke all on public.campaigns from anon;
revoke all on public.campaign_members from anon;

grant select, update on public.campaigns to authenticated;
grant select, insert, update, delete on public.campaign_members to authenticated;

drop policy if exists "Campaign members can view campaigns" on public.campaigns;
create policy "Campaign members can view campaigns"
on public.campaigns
for select
to authenticated
using (public.is_campaign_member(id));

drop policy if exists "Campaign DMs can update campaigns" on public.campaigns;
create policy "Campaign DMs can update campaigns"
on public.campaigns
for update
to authenticated
using (public.is_campaign_dm(id))
with check (public.is_campaign_dm(id));

drop policy if exists "Users can view own campaign memberships" on public.campaign_members;
create policy "Users can view own campaign memberships"
on public.campaign_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_campaign_dm(campaign_id)
);

drop policy if exists "Campaign DMs can add members" on public.campaign_members;
create policy "Campaign DMs can add members"
on public.campaign_members
for insert
to authenticated
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Campaign DMs can update members" on public.campaign_members;
create policy "Campaign DMs can update members"
on public.campaign_members
for update
to authenticated
using (public.is_campaign_dm(campaign_id))
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Campaign DMs can remove members" on public.campaign_members;
create policy "Campaign DMs can remove members"
on public.campaign_members
for delete
to authenticated
using (public.is_campaign_dm(campaign_id));

-- ------------------------------------------------------------
-- Seed the two campaign records.
-- ------------------------------------------------------------
insert into public.campaigns (
  slug,
  name,
  companion_name,
  subtitle,
  system_key,
  theme_key,
  enabled_modules,
  sort_order,
  is_active
)
values
  (
    'nattau',
    'Nattau Expedition',
    'Nattau Command',
    'Kainite Expedition',
    'dnd5e',
    'nattau',
    array[
      'dashboard',
      'session-planner',
      'fate',
      'council',
      'world-map',
      'settlement',
      'resources',
      'war-room',
      'gm-chat',
      'dice'
    ]::text[],
    10,
    true
  ),
  (
    'barovia',
    'Barovia',
    'Beyond the Mists',
    'Daggerheart in Barovia',
    'daggerheart',
    'barovia',
    array[
      'dashboard',
      'session-planner',
      'tarokka',
      'characters',
      'world-map'
    ]::text[],
    20,
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  companion_name = excluded.companion_name,
  subtitle = excluded.subtitle,
  system_key = excluded.system_key,
  theme_key = excluded.theme_key,
  enabled_modules = excluded.enabled_modules,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- ------------------------------------------------------------
-- Existing profiles keep Nattau access.
-- Their current global role and planning flag are copied.
-- ------------------------------------------------------------
insert into public.campaign_members (
  campaign_id,
  user_id,
  role,
  planning_enabled,
  is_active
)
select
  c.id,
  p.id,
  case when p.role = 'dm' then 'dm' else 'player' end,
  coalesce(p.planning_enabled, true),
  true
from public.profiles p
cross join public.campaigns c
where c.slug = 'nattau'
on conflict (campaign_id, user_id) do update
set
  role = excluded.role,
  planning_enabled = excluded.planning_enabled,
  is_active = true,
  updated_at = now();

-- Every current DM becomes a DM in Barovia.
insert into public.campaign_members (
  campaign_id,
  user_id,
  role,
  planning_enabled,
  is_active
)
select
  c.id,
  p.id,
  'dm',
  true,
  true
from public.profiles p
cross join public.campaigns c
where c.slug = 'barovia'
  and p.role = 'dm'
on conflict (campaign_id, user_id) do update
set
  role = 'dm',
  planning_enabled = true,
  is_active = true,
  updated_at = now();

-- Pippo becomes a test player in Barovia and remains excluded from planning.
insert into public.campaign_members (
  campaign_id,
  user_id,
  role,
  planning_enabled,
  is_active
)
select
  c.id,
  p.id,
  'player',
  false,
  true
from public.profiles p
cross join public.campaigns c
where c.slug = 'barovia'
  and lower(trim(coalesce(p.display_name, ''))) = 'pippo'
on conflict (campaign_id, user_id) do update
set
  role = 'player',
  planning_enabled = false,
  is_active = true,
  updated_at = now();

-- Ensure Pippo is excluded from Nattau planning as well.
update public.campaign_members cm
set planning_enabled = false,
    updated_at = now()
from public.campaigns c,
     public.profiles p
where cm.campaign_id = c.id
  and cm.user_id = p.id
  and c.slug = 'nattau'
  and lower(trim(coalesce(p.display_name, ''))) = 'pippo';

commit;

-- ------------------------------------------------------------
-- Verification output shown after the migration finishes.
-- ------------------------------------------------------------
select
  c.slug,
  c.companion_name,
  p.display_name,
  cm.role,
  cm.planning_enabled,
  cm.is_active
from public.campaign_members cm
join public.campaigns c on c.id = cm.campaign_id
left join public.profiles p on p.id = cm.user_id
order by c.sort_order, cm.role, p.display_name;
