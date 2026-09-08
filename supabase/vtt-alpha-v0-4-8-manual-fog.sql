-- Nattau VTT Alpha v0.4.8 — manual Fog of War
begin;

alter table public.vtt_scenes
  add column if not exists fog_enabled boolean not null default false,
  add column if not exists fog_base_state text not null default 'revealed';

alter table public.vtt_scenes
  drop constraint if exists vtt_scenes_fog_base_state_chk,
  add constraint vtt_scenes_fog_base_state_chk check (fog_base_state in ('revealed', 'covered'));

create table if not exists public.vtt_fog_regions (
  id bigint generated always as identity primary key,
  scene_id uuid not null references public.vtt_scenes(id) on delete cascade,
  operation text not null check (operation in ('reveal', 'cover')),
  shape text not null check (shape in ('all', 'rectangle', 'polygon')),
  points jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint vtt_fog_regions_points_array_chk check (jsonb_typeof(points) = 'array'),
  constraint vtt_fog_regions_shape_points_chk check (
    (shape = 'all' and jsonb_array_length(points) = 0)
    or (shape = 'rectangle' and jsonb_array_length(points) = 2)
    or (shape = 'polygon' and jsonb_array_length(points) between 3 and 64)
  )
);

create index if not exists vtt_fog_regions_scene_order_idx
  on public.vtt_fog_regions(scene_id, id);

alter table public.vtt_fog_regions enable row level security;
revoke all on public.vtt_fog_regions from anon;
grant select, insert, delete on public.vtt_fog_regions to authenticated, service_role;

drop policy if exists "VTT fog scene read" on public.vtt_fog_regions;
create policy "VTT fog scene read"
on public.vtt_fog_regions
for select
to authenticated
using (
  exists (
    select 1
    from public.vtt_scenes s
    where s.id = scene_id
      and (
        public.is_campaign_dm(s.campaign_id)
        or (s.is_active and s.visible_to_players and public.is_campaign_member(s.campaign_id))
      )
  )
);

drop policy if exists "VTT fog GM insert" on public.vtt_fog_regions;
create policy "VTT fog GM insert"
on public.vtt_fog_regions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.vtt_scenes s
    where s.id = scene_id
      and public.is_campaign_dm(s.campaign_id)
  )
);

drop policy if exists "VTT fog GM delete" on public.vtt_fog_regions;
create policy "VTT fog GM delete"
on public.vtt_fog_regions
for delete
to authenticated
using (
  exists (
    select 1
    from public.vtt_scenes s
    where s.id = scene_id
      and public.is_campaign_dm(s.campaign_id)
  )
);

create or replace function public.vtt_fog_region_contains(
  p_shape text,
  p_points jsonb,
  p_x double precision,
  p_z double precision
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_count integer;
  v_i integer;
  v_j integer;
  v_xi double precision;
  v_zi double precision;
  v_xj double precision;
  v_zj double precision;
  v_inside boolean := false;
  v_cross_x double precision;
begin
  if p_shape = 'all' then
    return true;
  end if;

  if jsonb_typeof(p_points) <> 'array' then
    return false;
  end if;

  v_count := jsonb_array_length(p_points);

  if p_shape = 'rectangle' then
    if v_count <> 2 then return false; end if;
    return p_x between least((p_points->0->>0)::double precision, (p_points->1->>0)::double precision)
                   and greatest((p_points->0->>0)::double precision, (p_points->1->>0)::double precision)
       and p_z between least((p_points->0->>1)::double precision, (p_points->1->>1)::double precision)
                   and greatest((p_points->0->>1)::double precision, (p_points->1->>1)::double precision);
  end if;

  if p_shape <> 'polygon' or v_count < 3 then
    return false;
  end if;

  v_j := v_count - 1;
  for v_i in 0..v_count - 1 loop
    v_xi := (p_points->v_i->>0)::double precision;
    v_zi := (p_points->v_i->>1)::double precision;
    v_xj := (p_points->v_j->>0)::double precision;
    v_zj := (p_points->v_j->>1)::double precision;

    if ((v_zi > p_z) <> (v_zj > p_z)) then
      v_cross_x := ((v_xj - v_xi) * (p_z - v_zi) / nullif(v_zj - v_zi, 0)) + v_xi;
      if p_x < v_cross_x then
        v_inside := not v_inside;
      end if;
    end if;
    v_j := v_i;
  end loop;

  return v_inside;
exception when others then
  return false;
end;
$$;

create or replace function public.is_vtt_point_revealed(
  p_scene_id uuid,
  p_x double precision,
  p_z double precision
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_base text;
  v_revealed boolean;
  v_region record;
begin
  select s.fog_enabled, s.fog_base_state
    into v_enabled, v_base
  from public.vtt_scenes s
  where s.id = p_scene_id;

  if coalesce(v_enabled, false) = false then
    return true;
  end if;

  v_revealed := coalesce(v_base, 'revealed') = 'revealed';

  for v_region in
    select r.operation, r.shape, r.points
    from public.vtt_fog_regions r
    where r.scene_id = p_scene_id
    order by r.id
  loop
    if public.vtt_fog_region_contains(v_region.shape, v_region.points, p_x, p_z) then
      v_revealed := v_region.operation = 'reveal';
    end if;
  end loop;

  return v_revealed;
end;
$$;

-- Keep the browser-ready GLB filename fix while adding fog filtering.
drop function if exists public.list_vtt_scene_tokens(uuid);
create function public.list_vtt_scene_tokens(p_scene_id uuid)
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
        and public.is_vtt_point_revealed(p_scene_id, t.x, t.z)
      )
    )
  order by t.created_at,t.id;
end;
$$;

grant execute on function public.list_vtt_scene_tokens(uuid) to authenticated, service_role;
grant execute on function public.is_vtt_point_revealed(uuid,double precision,double precision) to authenticated, service_role;

commit;
