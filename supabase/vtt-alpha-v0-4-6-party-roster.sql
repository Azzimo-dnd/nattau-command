-- Nattau VTT Alpha v0.4.6 — scene-specific party roster
begin;

alter table public.vtt_scenes
  add column if not exists party_roster_configured boolean not null default false;

create table if not exists public.vtt_scene_party_members (
  scene_id uuid not null references public.vtt_scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (scene_id, user_id)
);

create index if not exists vtt_scene_party_members_user_idx
  on public.vtt_scene_party_members(user_id, scene_id);

alter table public.vtt_scene_party_members enable row level security;
revoke all on public.vtt_scene_party_members from anon;
grant select, insert, delete on public.vtt_scene_party_members to authenticated, service_role;

drop policy if exists "VTT party roster GM read" on public.vtt_scene_party_members;
create policy "VTT party roster GM read"
on public.vtt_scene_party_members
for select
to authenticated
using (
  exists (
    select 1 from public.vtt_scenes s
    where s.id = scene_id
      and public.is_campaign_dm(s.campaign_id)
  )
);

drop policy if exists "VTT party roster GM insert" on public.vtt_scene_party_members;
create policy "VTT party roster GM insert"
on public.vtt_scene_party_members
for insert
to authenticated
with check (
  exists (
    select 1 from public.vtt_scenes s
    where s.id = scene_id
      and public.is_campaign_dm(s.campaign_id)
  )
);

drop policy if exists "VTT party roster GM delete" on public.vtt_scene_party_members;
create policy "VTT party roster GM delete"
on public.vtt_scene_party_members
for delete
to authenticated
using (
  exists (
    select 1 from public.vtt_scenes s
    where s.id = scene_id
      and public.is_campaign_dm(s.campaign_id)
  )
);

create or replace function public.list_vtt_party_roster(p_scene_id uuid)
returns table (
  user_id uuid,
  display_name text,
  has_miniature boolean,
  included boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_configured boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select s.campaign_id, s.party_roster_configured
    into v_campaign_id, v_configured
  from public.vtt_scenes s
  where s.id = p_scene_id;

  if v_campaign_id is null then raise exception 'Scene not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Game Master access required.'; end if;

  return query
  select
    cm.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Adventurer') as display_name,
    exists (
      select 1 from public.character_miniatures m
      where m.campaign_id = v_campaign_id
        and m.player_id = cm.user_id
        and m.is_current = true
    ) as has_miniature,
    case
      when not v_configured then true
      else exists (
        select 1 from public.vtt_scene_party_members rpm
        where rpm.scene_id = p_scene_id
          and rpm.user_id = cm.user_id
      )
    end as included
  from public.campaign_members cm
  left join public.profiles p on p.id = cm.user_id
  where cm.campaign_id = v_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
  order by lower(coalesce(nullif(trim(p.display_name), ''), 'Adventurer')), cm.user_id;
end;
$$;

create or replace function public.set_vtt_party_roster(p_scene_id uuid, p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select s.campaign_id into v_campaign_id
  from public.vtt_scenes s
  where s.id = p_scene_id;

  if v_campaign_id is null then raise exception 'Scene not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Game Master access required.'; end if;

  delete from public.vtt_scene_party_members where scene_id = p_scene_id;

  insert into public.vtt_scene_party_members(scene_id, user_id)
  select p_scene_id, cm.user_id
  from public.campaign_members cm
  where cm.campaign_id = v_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
    and cm.user_id = any(coalesce(p_user_ids, '{}'::uuid[]))
    and exists (
      select 1 from public.character_miniatures m
      where m.campaign_id = v_campaign_id
        and m.player_id = cm.user_id
        and m.is_current = true
    )
  on conflict do nothing;

  get diagnostics v_count = row_count;

  update public.vtt_scenes
  set party_roster_configured = true,
      updated_at = now()
  where id = p_scene_id;

  return v_count;
end;
$$;

-- Reconcile scene character tokens against the selected roster. Enemy tokens are untouched.
create or replace function public.seed_vtt_party(p_scene_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_configured boolean;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select s.campaign_id, s.party_roster_configured
    into v_campaign_id, v_configured
  from public.vtt_scenes s
  where s.id = p_scene_id;

  if v_campaign_id is null then raise exception 'Scene not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Game Master access required.'; end if;

  -- Remove character tokens that are no longer selected, inactive, or no longer use the current miniature.
  delete from public.vtt_tokens t
  using public.character_miniatures old_m
  where t.scene_id = p_scene_id
    and t.character_miniature_id = old_m.id
    and not exists (
      select 1
      from public.campaign_members cm
      join public.character_miniatures current_m
        on current_m.campaign_id = cm.campaign_id
       and current_m.player_id = cm.user_id
       and current_m.is_current = true
      where cm.campaign_id = v_campaign_id
        and cm.user_id = old_m.player_id
        and cm.role = 'player'
        and cm.is_active = true
        and current_m.id = old_m.id
        and (
          not v_configured
          or exists (
            select 1 from public.vtt_scene_party_members rpm
            where rpm.scene_id = p_scene_id
              and rpm.user_id = cm.user_id
          )
        )
    );

  with party as (
    select
      m.id as miniature_id,
      coalesce(nullif(trim(p.display_name), ''), 'Adventurer') as display_name,
      row_number() over(order by lower(coalesce(nullif(trim(p.display_name), ''), 'Adventurer')), cm.user_id) as rn
    from public.campaign_members cm
    join public.character_miniatures m
      on m.campaign_id = cm.campaign_id
     and m.player_id = cm.user_id
     and m.is_current = true
    left join public.profiles p on p.id = cm.user_id
    where cm.campaign_id = v_campaign_id
      and cm.role = 'player'
      and cm.is_active = true
      and (
        not v_configured
        or exists (
          select 1 from public.vtt_scene_party_members rpm
          where rpm.scene_id = p_scene_id
            and rpm.user_id = cm.user_id
        )
      )
  ), inserted as (
    insert into public.vtt_tokens(
      scene_id, character_miniature_id, name, x, z, visible_to_players, created_by
    )
    select
      p_scene_id,
      miniature_id,
      display_name,
      (rn - 3) * 2,
      6,
      true,
      auth.uid()
    from party
    on conflict (scene_id, character_miniature_id)
      where character_miniature_id is not null
    do nothing
    returning 1
  )
  select count(*) into v_count
  from public.vtt_tokens t
  where t.scene_id = p_scene_id
    and t.character_miniature_id is not null;

  return v_count;
end;
$$;

revoke all on function public.list_vtt_party_roster(uuid) from public, anon;
revoke all on function public.set_vtt_party_roster(uuid, uuid[]) from public, anon;
revoke all on function public.seed_vtt_party(uuid) from public, anon;
grant execute on function public.list_vtt_party_roster(uuid) to authenticated, service_role;
grant execute on function public.set_vtt_party_roster(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.seed_vtt_party(uuid) to authenticated, service_role;

commit;
