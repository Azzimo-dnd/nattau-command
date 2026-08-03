-- ============================================================
-- Campaign Companion — Multi-Campaign Dice Rolls v1
--
-- Adds a campaign-specific dice log shared by Nattau and Barovia.
-- Nattau keeps its standard polyhedral roller.
-- Barovia uses Daggerheart Duality Dice, reaction rolls,
-- adversary attack rolls and damage rolls.
--
-- Requirements:
--   1. supabase/multi-campaign-foundation.sql
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.campaign_dice_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  roller_name text not null default 'Campaign member',
  system_key text not null default 'unknown',
  roll_kind text not null,
  title text not null,
  expression text,
  total integer,
  outcome text,
  visibility text not null default 'campaign',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint campaign_dice_rolls_visibility_check
    check (visibility in ('campaign', 'private')),
  constraint campaign_dice_rolls_kind_check
    check (
      roll_kind in (
        'generic',
        'daggerheart_action',
        'daggerheart_reaction',
        'daggerheart_gm',
        'daggerheart_damage'
      )
    ),
  constraint campaign_dice_rolls_details_object_check
    check (jsonb_typeof(details) = 'object')
);

create index if not exists campaign_dice_rolls_campaign_created_idx
  on public.campaign_dice_rolls(campaign_id, created_at desc);

create index if not exists campaign_dice_rolls_user_created_idx
  on public.campaign_dice_rolls(user_id, created_at desc);

-- Always derive the user identity and campaign system on the server.
create or replace function public.prepare_campaign_dice_roll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_user_id uuid;
  resolved_name text;
  resolved_system text;
begin
  resolved_user_id := auth.uid();

  if resolved_user_id is null then
    raise exception 'Authentication required';
  end if;

  select nullif(trim(p.display_name), '')
    into resolved_name
  from public.profiles p
  where p.id = resolved_user_id;

  select c.system_key
    into resolved_system
  from public.campaigns c
  where c.id = new.campaign_id
    and c.is_active = true;

  if resolved_system is null then
    raise exception 'Campaign not found or inactive';
  end if;

  new.user_id := resolved_user_id;
  new.roller_name := coalesce(resolved_name, 'Campaign member');
  new.system_key := resolved_system;
  new.created_at := coalesce(new.created_at, now());
  new.details := coalesce(new.details, '{}'::jsonb);

  return new;
end;
$$;

drop trigger if exists campaign_dice_rolls_prepare_insert
  on public.campaign_dice_rolls;
create trigger campaign_dice_rolls_prepare_insert
before insert on public.campaign_dice_rolls
for each row execute function public.prepare_campaign_dice_roll();

alter table public.campaign_dice_rolls enable row level security;

revoke all on public.campaign_dice_rolls from anon;
grant select, insert, delete on public.campaign_dice_rolls to authenticated;

drop policy if exists "Campaign members can read visible dice rolls"
  on public.campaign_dice_rolls;
create policy "Campaign members can read visible dice rolls"
on public.campaign_dice_rolls
for select
to authenticated
using (
  public.is_campaign_member(campaign_id)
  and (
    visibility = 'campaign'
    or user_id = auth.uid()
  )
);

drop policy if exists "Campaign members can record dice rolls"
  on public.campaign_dice_rolls;
create policy "Campaign members can record dice rolls"
on public.campaign_dice_rolls
for insert
to authenticated
with check (
  public.is_campaign_member(campaign_id)
  and user_id = auth.uid()
);

drop policy if exists "Roll owners and campaign DMs can delete dice rolls"
  on public.campaign_dice_rolls;
create policy "Roll owners and campaign DMs can delete dice rolls"
on public.campaign_dice_rolls
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_campaign_dm(campaign_id)
);

-- Add the dice module to Barovia without removing any existing modules.
update public.campaigns
set enabled_modules =
      case
        when 'dice' = any(enabled_modules) then enabled_modules
        else array_append(enabled_modules, 'dice')
      end,
    updated_at = now()
where slug = 'barovia';

commit;

-- Enable live campaign log updates when the default Supabase publication exists.
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'campaign_dice_rolls'
  ) then
    execute 'alter publication supabase_realtime add table public.campaign_dice_rolls';
  end if;
end;
$$;

-- Verification output.
select
  c.slug,
  c.system_key,
  c.enabled_modules,
  count(r.id) as saved_rolls
from public.campaigns c
left join public.campaign_dice_rolls r on r.campaign_id = c.id
where c.slug in ('nattau', 'barovia')
group by c.id, c.slug, c.system_key, c.enabled_modules
order by c.slug;
