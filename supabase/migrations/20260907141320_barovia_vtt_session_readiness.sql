-- Requires the existing VTT v0.4.8 schema. Apply before the companion client update.
-- No campaign content, memberships, or active scenes are changed.
begin;

create or replace function public.vtt_snap_token_coordinate(
  p_value double precision, p_squares double precision, p_size double precision
)
returns double precision
language sql immutable strict
set search_path = ''
as $$
  select greatest(first_center, least(-first_center, first_center + floor(p_value - first_center + 0.5)))
  from (select -p_squares / 2 + least(p_squares, greatest(1, p_size)) / 2 as first_center) centers;
$$;

create or replace function public.is_vtt_point_revealed(
  p_scene_id uuid, p_x double precision, p_z double precision
)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_scene public.vtt_scenes%rowtype;
  v_revealed boolean;
  v_region record;
begin
  if auth.uid() is null then return false; end if;
  if p_x is null or p_z is null
    or p_x in ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
    or p_z in ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8) then return false; end if;
  select * into v_scene from public.vtt_scenes where id = p_scene_id;
  if not found then return false; end if;
  if not public.is_campaign_dm(v_scene.campaign_id) then
    if not public.is_campaign_member(v_scene.campaign_id)
      or not v_scene.is_active or not v_scene.visible_to_players then return false; end if;
  end if;
  if not v_scene.fog_enabled then return true; end if;
  v_revealed := v_scene.fog_base_state = 'revealed';
  for v_region in
    select operation, shape, points from public.vtt_fog_regions where scene_id = p_scene_id order by id
  loop
    if public.vtt_fog_region_contains(v_region.shape, v_region.points, p_x, p_z) then
      v_revealed := v_region.operation = 'reveal';
    end if;
  end loop;
  return v_revealed;
end;
$$;

-- Token rendering snaps its center to the grid. All access paths must evaluate
-- fog at that same rendered center, including legacy tokens stored at (0, 0).
create or replace function public.is_vtt_token_position_revealed(
  p_scene_id uuid, p_x double precision, p_z double precision, p_size double precision
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select public.is_vtt_point_revealed(s.id,
    public.vtt_snap_token_coordinate(p_x, s.grid_width, p_size),
    public.vtt_snap_token_coordinate(p_z, s.grid_height, p_size))
    from public.vtt_scenes s where s.id = p_scene_id), false);
$$;

drop policy if exists "VTT token campaign read" on public.vtt_tokens;
create policy "VTT token campaign read" on public.vtt_tokens for select to authenticated
using (exists (
  select 1 from public.vtt_scenes s where s.id = scene_id and (
    public.is_campaign_dm(s.campaign_id)
    or (s.is_active and s.visible_to_players and vtt_tokens.visible_to_players
      and public.is_campaign_member(s.campaign_id)
      and public.is_vtt_token_position_revealed(s.id, vtt_tokens.x, vtt_tokens.z, vtt_tokens.size_squares))
  )
));

create or replace function public.can_read_vtt_enemy_model_object(object_name text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare v_campaign_id uuid := public.vtt_storage_campaign_id(object_name);
begin
  if auth.uid() is null or v_campaign_id is null then return false; end if;
  if public.is_campaign_dm(v_campaign_id) then return true; end if;
  if not public.is_campaign_member(v_campaign_id) then return false; end if;
  return exists (
    select 1 from public.vtt_enemy_models e
    join public.vtt_tokens t on t.enemy_model_id = e.id and t.visible_to_players
    join public.vtt_scenes s on s.id = t.scene_id and s.campaign_id = e.campaign_id
      and s.is_active and s.visible_to_players
    where e.campaign_id = v_campaign_id and (e.storage_path = object_name or e.web_storage_path = object_name)
      and public.is_vtt_token_position_revealed(s.id, t.x, t.z, t.size_squares)
  );
end;
$$;

create or replace function public.can_read_vtt_enemy_paint_object(object_name text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare v_campaign_id uuid := public.vtt_storage_campaign_id(object_name);
begin
  if auth.uid() is null or v_campaign_id is null then return false; end if;
  if public.is_campaign_dm(v_campaign_id) then return true; end if;
  if not public.is_campaign_member(v_campaign_id) then return false; end if;
  return exists (
    select 1 from public.vtt_enemy_paint_jobs p
    join public.vtt_enemy_models e on e.id = p.enemy_model_id
    join public.vtt_tokens t on t.enemy_model_id = e.id and t.visible_to_players
    join public.vtt_scenes s on s.id = t.scene_id and s.campaign_id = e.campaign_id
      and s.is_active and s.visible_to_players
    where e.campaign_id = v_campaign_id and p.storage_path = object_name and p.is_default
      and public.is_vtt_token_position_revealed(s.id, t.x, t.z, t.size_squares)
  );
end;
$$;

create or replace function public.list_vtt_scene_tokens(p_scene_id uuid)
returns table(
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
  revision bigint,
  initiative integer
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
      then case when cm.web_storage_path is not null then regexp_replace(cm.original_name,'\.stl$','.web.glb','i') else cm.original_name end
      else case when em.web_storage_path is not null then regexp_replace(em.original_name,'\.stl$','.web.glb','i') else em.original_name end
    end,
    case when t.character_miniature_id is not null
      then case when cm.web_storage_path is not null then 'glb' else 'stl' end
      else case when em.web_storage_path is not null then 'glb' else 'stl' end
    end,
    case when t.character_miniature_id is not null then cp.storage_path else ep.storage_path end,
    t.revision,
    t.initiative
  from public.vtt_tokens t
  left join public.character_miniatures cm on cm.id=t.character_miniature_id
  left join public.vtt_enemy_models em on em.id=t.enemy_model_id
  left join public.character_miniature_paint_jobs cp on cp.miniature_id=cm.id and cp.is_default=true
  left join public.vtt_enemy_paint_jobs ep on ep.enemy_model_id=em.id and ep.is_default=true
  where t.scene_id=p_scene_id
    and (
      v_is_dm
      or (
        t.visible_to_players=true
        and public.is_vtt_token_position_revealed(p_scene_id, t.x, t.z, t.size_squares)
      )
    )
  order by t.created_at,t.id;
end;
$$;

-- VTT broadcasts used to be public. Restrict table/fog/presence to members,
-- fog writes to GMs, and shared dice to the visible scene (or its GM).
create or replace function public.can_access_vtt_topic(p_topic text, p_send boolean default false)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_topic, ':');
  v_id uuid;
  v_scene public.vtt_scenes%rowtype;
begin
  if auth.uid() is null or array_length(v_parts, 1) <> 3 or v_parts[1] <> 'vtt' then return false; end if;
  v_id := v_parts[3]::uuid;
  if v_parts[2] in ('campaign', 'fog', 'presence') then
    if v_parts[2] = 'fog' and p_send then return public.is_campaign_dm(v_id); end if;
    return public.is_campaign_member(v_id) or public.is_campaign_dm(v_id);
  elsif v_parts[2] = 'dice' then
    select * into v_scene from public.vtt_scenes where id = v_id;
    if not found then return false; end if;
    return public.is_campaign_dm(v_scene.campaign_id) or (
      v_scene.is_active and v_scene.visible_to_players and public.is_campaign_member(v_scene.campaign_id)
    );
  end if;
  return false;
exception when invalid_text_representation then return false;
end;
$$;

drop policy if exists "VTT realtime receive" on realtime.messages;
create policy "VTT realtime receive" on realtime.messages for select to authenticated
using (extension in ('broadcast', 'presence') and public.can_access_vtt_topic((select realtime.topic()), false));
drop policy if exists "VTT realtime send" on realtime.messages;
create policy "VTT realtime send" on realtime.messages for insert to authenticated
with check (extension in ('broadcast', 'presence') and public.can_access_vtt_topic((select realtime.topic()), true));

revoke all on function public.vtt_snap_token_coordinate(double precision,double precision,double precision) from public, anon;
revoke all on function public.is_vtt_point_revealed(uuid,double precision,double precision) from public, anon;
revoke all on function public.is_vtt_token_position_revealed(uuid,double precision,double precision,double precision) from public, anon;
revoke all on function public.list_vtt_scene_tokens(uuid) from public, anon;
revoke all on function public.can_read_vtt_enemy_model_object(text) from public, anon;
revoke all on function public.can_read_vtt_enemy_paint_object(text) from public, anon;
revoke all on function public.can_access_vtt_topic(text,boolean) from public, anon;
grant execute on function public.vtt_snap_token_coordinate(double precision,double precision,double precision),
  public.is_vtt_point_revealed(uuid,double precision,double precision),
  public.is_vtt_token_position_revealed(uuid,double precision,double precision,double precision),
  public.list_vtt_scene_tokens(uuid), public.can_read_vtt_enemy_model_object(text),
  public.can_read_vtt_enemy_paint_object(text), public.can_access_vtt_topic(text,boolean) to authenticated, service_role;

commit;
