-- Nattau VTT Alpha v0.4.3 — GM-controlled player scene visibility
-- Active scene selection and player visibility are intentionally separate.
-- A live scene may be hidden from players while remaining fully editable by the GM.

begin;

alter table public.vtt_scenes
  add column if not exists visible_to_players boolean not null default true;

-- Players may discover only the active scene while the GM explicitly exposes it.
drop policy if exists "VTT scene campaign read" on public.vtt_scenes;
create policy "VTT scene campaign read"
on public.vtt_scenes
for select
to authenticated
using (
  public.is_campaign_dm(campaign_id)
  or (
    is_active = true
    and visible_to_players = true
    and public.is_campaign_member(campaign_id)
  )
);

-- Direct token reads follow the same scene visibility boundary.
drop policy if exists "VTT token campaign read" on public.vtt_tokens;
create policy "VTT token campaign read"
on public.vtt_tokens
for select
to authenticated
using (
  exists (
    select 1
    from public.vtt_scenes s
    where s.id = scene_id
      and (
        public.is_campaign_dm(s.campaign_id)
        or (
          s.is_active = true
          and s.visible_to_players = true
          and vtt_tokens.visible_to_players = true
          and public.is_campaign_member(s.campaign_id)
        )
      )
  )
);

create or replace function public.can_read_vtt_map_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid := public.vtt_storage_campaign_id(object_name);
begin
  if v_campaign_id is null then return false; end if;
  if public.is_campaign_dm(v_campaign_id) then return true; end if;
  if not public.is_campaign_member(v_campaign_id) then return false; end if;

  return exists (
    select 1
    from public.vtt_scenes s
    where s.campaign_id = v_campaign_id
      and s.is_active = true
      and s.visible_to_players = true
      and s.map_storage_path = object_name
  );
end;
$$;

create or replace function public.can_read_vtt_enemy_model_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid := public.vtt_storage_campaign_id(object_name);
begin
  if v_campaign_id is null then return false; end if;
  if public.is_campaign_dm(v_campaign_id) then return true; end if;
  if not public.is_campaign_member(v_campaign_id) then return false; end if;

  return exists (
    select 1
    from public.vtt_enemy_models e
    join public.vtt_tokens t
      on t.enemy_model_id = e.id
     and t.visible_to_players = true
    join public.vtt_scenes s
      on s.id = t.scene_id
     and s.campaign_id = e.campaign_id
     and s.is_active = true
     and s.visible_to_players = true
    where e.campaign_id = v_campaign_id
      and (e.storage_path = object_name or e.web_storage_path = object_name)
  );
end;
$$;

create or replace function public.can_read_vtt_enemy_paint_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid := public.vtt_storage_campaign_id(object_name);
begin
  if v_campaign_id is null then return false; end if;
  if public.is_campaign_dm(v_campaign_id) then return true; end if;
  if not public.is_campaign_member(v_campaign_id) then return false; end if;

  return exists (
    select 1
    from public.vtt_enemy_paint_jobs p
    join public.vtt_enemy_models e on e.id = p.enemy_model_id
    join public.vtt_tokens t
      on t.enemy_model_id = e.id
     and t.visible_to_players = true
    join public.vtt_scenes s
      on s.id = t.scene_id
     and s.campaign_id = e.campaign_id
     and s.is_active = true
     and s.visible_to_players = true
    where p.storage_path = object_name
      and p.is_default = true
      and e.campaign_id = v_campaign_id
  );
end;
$$;

create or replace function public.list_vtt_scene_tokens(p_scene_id uuid)
returns table (
  id uuid,
  name text,
  source_kind text,
  x double precision,
  z double precision,
  rotation double precision,
  scale double precision,
  size_squares double precision,
  visible_to_players boolean,
  model_storage_path text,
  model_file_name text,
  model_format text,
  paint_storage_path text,
  revision bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_scene_active boolean;
  v_scene_visible boolean;
  v_is_dm boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select s.campaign_id, s.is_active, s.visible_to_players
    into v_campaign_id, v_scene_active, v_scene_visible
  from public.vtt_scenes s
  where s.id = p_scene_id;

  if v_campaign_id is null then raise exception 'Scene not found.'; end if;

  v_is_dm := public.is_campaign_dm(v_campaign_id);
  if not v_is_dm then
    if not public.is_campaign_member(v_campaign_id) then
      raise exception 'Campaign access required.';
    end if;
    if not v_scene_active or not v_scene_visible then
      raise exception 'VTT scene is not currently available to players.';
    end if;
  end if;

  return query
  select
    t.id,
    t.name,
    case when t.character_miniature_id is not null then 'character' else 'enemy' end,
    t.x,t.z,t.rotation,t.scale,t.size_squares,t.visible_to_players,
    case when t.character_miniature_id is not null
      then coalesce(cm.web_storage_path, cm.storage_path)
      else coalesce(em.web_storage_path, em.storage_path)
    end,
    case when t.character_miniature_id is not null
      then case when cm.web_storage_path is not null then regexp_replace(cm.original_name,'\\.stl$','.web.glb','i') else cm.original_name end
      else case when em.web_storage_path is not null then regexp_replace(em.original_name,'\\.stl$','.web.glb','i') else em.original_name end
    end,
    case when t.character_miniature_id is not null
      then case when cm.web_storage_path is not null then 'glb' else 'stl' end
      else case when em.web_storage_path is not null then 'glb' else 'stl' end
    end,
    case when t.character_miniature_id is not null then cp.storage_path else ep.storage_path end,
    t.revision
  from public.vtt_tokens t
  left join public.character_miniatures cm on cm.id=t.character_miniature_id
  left join public.vtt_enemy_models em on em.id=t.enemy_model_id
  left join public.character_miniature_paint_jobs cp on cp.miniature_id=cm.id and cp.is_default=true
  left join public.vtt_enemy_paint_jobs ep on ep.enemy_model_id=em.id and ep.is_default=true
  where t.scene_id=p_scene_id and (v_is_dm or t.visible_to_players=true)
  order by t.created_at,t.id;
end;
$$;

-- Persistent VTT roll history follows scene visibility too.
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
        or (
          s.is_active = true
          and s.visible_to_players = true
          and public.is_campaign_member(s.campaign_id)
        )
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
        or (
          s.is_active = true
          and s.visible_to_players = true
          and public.is_campaign_member(s.campaign_id)
        )
      )
  )
);

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
  v_scene_visible boolean;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select s.campaign_id, s.is_active, s.visible_to_players
    into v_campaign_id, v_scene_active, v_scene_visible
  from public.vtt_scenes s
  where s.id = new.scene_id;

  if v_campaign_id is null then
    raise exception 'VTT scene not found';
  end if;

  if not public.is_campaign_dm(v_campaign_id) then
    if not v_scene_active or not v_scene_visible or not public.is_campaign_member(v_campaign_id) then
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

commit;