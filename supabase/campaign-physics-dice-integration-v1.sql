-- ============================================================
-- Campaign Companion — Player Physics Dice Integration v1
--
-- Adds:
--   * one GM-controlled physics preset per campaign;
--   * one personal dice appearance preference per player/campaign;
--   * RLS protection for both tables;
--   * approved Balanced Table Roll defaults for Nattau and Barovia.
--
-- Prerequisite:
--   public.campaigns, public.campaign_members,
--   public.is_campaign_member(uuid), public.is_campaign_dm(uuid)
-- ============================================================

begin;

create table if not exists public.campaign_dice_physics_settings (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  throw_force double precision not null default 10.0,
  spin_force double precision not null default 7.2,
  die_friction double precision not null default 0.64,
  tray_friction double precision not null default 1.0,
  restitution double precision not null default 0.6,
  linear_damping double precision not null default 0.12,
  angular_damping double precision not null default 0.18,
  gravity double precision not null default -9.81,
  cocked_threshold double precision not null default 0.925,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_dice_physics_throw_check
    check (throw_force between 2.8 and 14.0),
  constraint campaign_dice_physics_spin_check
    check (spin_force between 1.0 and 18.0),
  constraint campaign_dice_physics_die_friction_check
    check (die_friction between 0.05 and 1.5),
  constraint campaign_dice_physics_tray_friction_check
    check (tray_friction between 0.05 and 1.6),
  constraint campaign_dice_physics_restitution_check
    check (restitution between 0.0 and 0.8),
  constraint campaign_dice_physics_linear_damping_check
    check (linear_damping between 0.0 and 1.5),
  constraint campaign_dice_physics_angular_damping_check
    check (angular_damping between 0.0 and 2.0),
  constraint campaign_dice_physics_gravity_check
    check (gravity between -20.0 and -3.0),
  constraint campaign_dice_physics_cocked_threshold_check
    check (cocked_threshold between 0.78 and 0.995)
);

create table if not exists public.campaign_dice_preferences (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cosmetic_id text not null default 'ivory',
  number_size text not null default 'large',
  sound_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, user_id),
  constraint campaign_dice_preferences_number_size_check
    check (number_size in ('standard', 'large', 'extra-large')),
  constraint campaign_dice_preferences_cosmetic_id_check
    check (char_length(cosmetic_id) between 1 and 80)
);

create index if not exists campaign_dice_preferences_user_idx
  on public.campaign_dice_preferences(user_id);

create or replace function public.set_campaign_dice_physics_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
  end if;
  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create or replace function public.set_campaign_dice_preference_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campaign_dice_physics_set_audit_fields
  on public.campaign_dice_physics_settings;
create trigger campaign_dice_physics_set_audit_fields
before insert or update on public.campaign_dice_physics_settings
for each row execute function public.set_campaign_dice_physics_audit_fields();

drop trigger if exists campaign_dice_preferences_set_updated_at
  on public.campaign_dice_preferences;
create trigger campaign_dice_preferences_set_updated_at
before insert or update on public.campaign_dice_preferences
for each row execute function public.set_campaign_dice_preference_updated_at();

alter table public.campaign_dice_physics_settings enable row level security;
alter table public.campaign_dice_preferences enable row level security;

revoke all on public.campaign_dice_physics_settings from anon;
revoke all on public.campaign_dice_preferences from anon;

grant select, insert, update on public.campaign_dice_physics_settings to authenticated;
grant select, insert, update, delete on public.campaign_dice_preferences to authenticated;

drop policy if exists "Campaign members can read dice physics" on public.campaign_dice_physics_settings;
create policy "Campaign members can read dice physics"
on public.campaign_dice_physics_settings
for select
to authenticated
using (public.is_campaign_member(campaign_id));

drop policy if exists "Campaign DMs can create dice physics" on public.campaign_dice_physics_settings;
create policy "Campaign DMs can create dice physics"
on public.campaign_dice_physics_settings
for insert
to authenticated
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Campaign DMs can update dice physics" on public.campaign_dice_physics_settings;
create policy "Campaign DMs can update dice physics"
on public.campaign_dice_physics_settings
for update
to authenticated
using (public.is_campaign_dm(campaign_id))
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Users can read own dice preferences" on public.campaign_dice_preferences;
create policy "Users can read own dice preferences"
on public.campaign_dice_preferences
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_campaign_member(campaign_id)
);

drop policy if exists "Users can create own dice preferences" on public.campaign_dice_preferences;
create policy "Users can create own dice preferences"
on public.campaign_dice_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_campaign_member(campaign_id)
);

drop policy if exists "Users can update own dice preferences" on public.campaign_dice_preferences;
create policy "Users can update own dice preferences"
on public.campaign_dice_preferences
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_campaign_member(campaign_id)
)
with check (
  user_id = auth.uid()
  and public.is_campaign_member(campaign_id)
);

drop policy if exists "Users can delete own dice preferences" on public.campaign_dice_preferences;
create policy "Users can delete own dice preferences"
on public.campaign_dice_preferences
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_campaign_member(campaign_id)
);

-- Keep open player rollers synchronized when the GM updates physics.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'campaign_dice_physics_settings'
    ) then
      alter publication supabase_realtime
        add table public.campaign_dice_physics_settings;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'campaign_dice_preferences'
    ) then
      alter publication supabase_realtime
        add table public.campaign_dice_preferences;
    end if;
  end if;
end;
$$;

-- Approved Balanced Table Roll preset. Existing campaign settings are retained.
insert into public.campaign_dice_physics_settings (
  campaign_id,
  throw_force,
  spin_force,
  die_friction,
  tray_friction,
  restitution,
  linear_damping,
  angular_damping,
  gravity,
  cocked_threshold
)
select
  c.id,
  10.0,
  7.2,
  0.64,
  1.0,
  0.6,
  0.12,
  0.18,
  -9.81,
  0.925
from public.campaigns c
where c.slug in ('nattau', 'barovia')
on conflict (campaign_id) do nothing;

commit;

select
  c.slug,
  s.throw_force,
  s.spin_force,
  s.restitution,
  s.die_friction,
  s.tray_friction,
  s.gravity,
  s.cocked_threshold,
  s.updated_at
from public.campaign_dice_physics_settings s
join public.campaigns c on c.id = s.campaign_id
order by c.sort_order;
