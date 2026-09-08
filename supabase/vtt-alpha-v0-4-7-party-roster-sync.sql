-- Nattau VTT Alpha v0.4.7 — preserve scene roster semantics for existing/duplicated scenes
begin;

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
  v_has_character_tokens boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select s.campaign_id, s.party_roster_configured
    into v_campaign_id, v_configured
  from public.vtt_scenes s
  where s.id = p_scene_id;

  if v_campaign_id is null then raise exception 'Scene not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Game Master access required.'; end if;

  select exists (
    select 1 from public.vtt_tokens t
    where t.scene_id = p_scene_id
      and t.character_miniature_id is not null
  ) into v_has_character_tokens;

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
      when v_configured then exists (
        select 1 from public.vtt_scene_party_members rpm
        where rpm.scene_id = p_scene_id
          and rpm.user_id = cm.user_id
      )
      when v_has_character_tokens then exists (
        select 1
        from public.vtt_tokens t
        join public.character_miniatures m on m.id = t.character_miniature_id
        where t.scene_id = p_scene_id
          and m.player_id = cm.user_id
      )
      else true
    end as included
  from public.campaign_members cm
  left join public.profiles p on p.id = cm.user_id
  where cm.campaign_id = v_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
  order by lower(coalesce(nullif(trim(p.display_name), ''), 'Adventurer')), cm.user_id;
end;
$$;

create or replace function public.seed_vtt_party(p_scene_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_configured boolean;
  v_effective_user_ids uuid[] := '{}'::uuid[];
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select s.campaign_id, s.party_roster_configured
    into v_campaign_id, v_configured
  from public.vtt_scenes s
  where s.id = p_scene_id;

  if v_campaign_id is null then raise exception 'Scene not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Game Master access required.'; end if;

  if v_configured then
    select coalesce(array_agg(rpm.user_id), '{}'::uuid[])
      into v_effective_user_ids
    from public.vtt_scene_party_members rpm
    where rpm.scene_id = p_scene_id;
  elsif exists (
    select 1 from public.vtt_tokens t
    where t.scene_id = p_scene_id
      and t.character_miniature_id is not null
  ) then
    select coalesce(array_agg(distinct m.player_id), '{}'::uuid[])
      into v_effective_user_ids
    from public.vtt_tokens t
    join public.character_miniatures m on m.id = t.character_miniature_id
    where t.scene_id = p_scene_id
      and t.character_miniature_id is not null;
  else
    select coalesce(array_agg(cm.user_id), '{}'::uuid[])
      into v_effective_user_ids
    from public.campaign_members cm
    where cm.campaign_id = v_campaign_id
      and cm.role = 'player'
      and cm.is_active = true
      and exists (
        select 1 from public.character_miniatures m
        where m.campaign_id = v_campaign_id
          and m.player_id = cm.user_id
          and m.is_current = true
      );
  end if;

  -- Remove only character tokens that no longer belong to the effective roster,
  -- or whose miniature is no longer the player's current miniature.
  delete from public.vtt_tokens t
  using public.character_miniatures old_m
  where t.scene_id = p_scene_id
    and t.character_miniature_id = old_m.id
    and (
      not (old_m.player_id = any(v_effective_user_ids))
      or old_m.is_current = false
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
      and cm.user_id = any(v_effective_user_ids)
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
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

revoke all on function public.list_vtt_party_roster(uuid) from public, anon;
revoke all on function public.seed_vtt_party(uuid) from public, anon;
grant execute on function public.list_vtt_party_roster(uuid) to authenticated, service_role;
grant execute on function public.seed_vtt_party(uuid) to authenticated, service_role;

commit;
