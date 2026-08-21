-- Nattau VTT Dice v0.4.2 — scene-scoped roll history
-- Branch-only migration. Do not apply to production until the VTT dice beta is approved.
-- Each roll belongs to exactly one VTT scene and is removed automatically when that scene is deleted.

begin;

create table if not exists public.vtt_dice_rolls (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.vtt_scenes(id) on delete cascade,
  roll_key text not null unique check (char_length(roll_key) between 8 and 160),
  roller_id uuid references auth.users(id) on delete set null,
  roller_name text not null default 'Campaign member' check (char_length(roller_name) between 1 and 160),
  expression text not null check (char_length(expression) between 1 and 240),
  mode text not null default 'normal' check (mode in ('normal', 'advantage', 'disadvantage')),
  modifier integer not null default 0 check (modifier between -99 and 99),
  total integer not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint vtt_dice_rolls_details_object_chk check (jsonb_typeof(details) = 'object')
);

create index if not exists vtt_dice_rolls_scene_created_idx
  on public.vtt_dice_rolls(scene_id, created_at desc);
create index if not exists vtt_dice_rolls_roller_created_idx
  on public.vtt_dice_rolls(roller_id, created_at desc)
  where roller_id is not null;

create or replace function public.prepare_vtt_dice_roll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_campaign_id uuid;
  v_scene_active boolean;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select s.campaign_id, s.is_active
    into v_campaign_id, v_scene_active
  from public.vtt_scenes s
  where s.id = new.scene_id;

  if v_campaign_id is null then
    raise exception 'VTT scene not found';
  end if;

  if not public.is_campaign_dm(v_campaign_id) then
    if not v_scene_active or not public.is_campaign_member(v_campaign_id) then
      raise exception 'VTT scene is not available to this campaign member';
    end if;
  end if;

  select nullif(trim(p.display_name), '')
    into v_display_name
  from public.profiles p
  where p.id = v_user_id;

  new.roller_id := v_user_id;
  new.roller_name := coalesce(v_display_name, 'Campaign member');
  new.created_at := now();
  new.details := coalesce(new.details, '{}'::jsonb);

  return new;
end;
$$;

drop trigger if exists vtt_dice_rolls_prepare_insert on public.vtt_dice_rolls;
create trigger vtt_dice_rolls_prepare_insert
before insert on public.vtt_dice_rolls
for each row execute function public.prepare_vtt_dice_roll();

alter table public.vtt_dice_rolls enable row level security;

revoke all on public.vtt_dice_rolls from anon;
grant select, insert, delete on public.vtt_dice_rolls to authenticated, service_role;

drop policy if exists "VTT dice scene read" on public.vtt_dice_rolls;
create policy "VTT dice scene read"
on public.vtt_dice_rolls
for select
to authenticated
using (
  exists (
    select 1
    from public.vtt_scenes s
    where s.id = scene_id
      and (
        public.is_campaign_dm(s.campaign_id)
        or (s.is_active and public.is_campaign_member(s.campaign_id))
      )
  )
);

drop policy if exists "VTT dice scene insert" on public.vtt_dice_rolls;
create policy "VTT dice scene insert"
on public.vtt_dice_rolls
for insert
to authenticated
with check (
  roller_id = auth.uid()
  and exists (
    select 1
    from public.vtt_scenes s
    where s.id = scene_id
      and (
        public.is_campaign_dm(s.campaign_id)
        or (s.is_active and public.is_campaign_member(s.campaign_id))
      )
  )
);

drop policy if exists "VTT dice owner or GM delete" on public.vtt_dice_rolls;
create policy "VTT dice owner or GM delete"
on public.vtt_dice_rolls
for delete
to authenticated
using (
  roller_id = auth.uid()
  or exists (
    select 1
    from public.vtt_scenes s
    where s.id = scene_id
      and public.is_campaign_dm(s.campaign_id)
  )
);

commit;

-- The history panel refreshes through Postgres Changes when Realtime is available.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vtt_dice_rolls'
  ) then
    execute 'alter publication supabase_realtime add table public.vtt_dice_rolls';
  end if;
end;
$$;
