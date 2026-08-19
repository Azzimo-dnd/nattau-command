-- Character Miniatures v1.2 — optional private GLB derivative for faster web/mobile delivery
begin;

alter table public.character_miniatures
  add column if not exists web_storage_path text,
  add column if not exists web_file_size_bytes bigint check (web_file_size_bytes is null or (web_file_size_bytes > 0 and web_file_size_bytes <= 52428800)),
  add column if not exists web_generated_at timestamptz;

create unique index if not exists character_miniatures_web_storage_path_idx
  on public.character_miniatures (web_storage_path)
  where web_storage_path is not null;

create or replace function public.can_read_character_miniature_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_campaign_id uuid;
begin
  v_campaign_id := public.character_miniature_path_campaign_id(object_name);
  if v_campaign_id is null then
    return false;
  end if;

  if public.is_campaign_dm(v_campaign_id) then
    return exists (
      select 1
      from public.character_miniatures m
      where m.campaign_id = v_campaign_id
        and (m.storage_path = object_name or m.web_storage_path = object_name)
    );
  end if;

  return public.is_campaign_member(v_campaign_id)
    and exists (
      select 1
      from public.character_miniatures m
      where m.campaign_id = v_campaign_id
        and (m.storage_path = object_name or m.web_storage_path = object_name)
        and m.is_current = true
    );
end;
$$;

create or replace function public.attach_character_miniature_web_derivative(
  p_miniature_id uuid,
  p_web_storage_path text,
  p_web_file_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_miniature public.character_miniatures%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_miniature
  from public.character_miniatures
  where id = p_miniature_id
  for update;

  if v_miniature.id is null then
    raise exception 'Miniature not found.';
  end if;
  if not public.is_campaign_dm(v_miniature.campaign_id) then
    raise exception 'Game Master access required.';
  end if;
  if p_web_file_size_bytes <= 0 or p_web_file_size_bytes > 52428800 then
    raise exception 'Web GLB exceeds the 50 MB miniature limit.';
  end if;
  if p_web_storage_path <> v_miniature.campaign_id::text || '/' || v_miniature.player_id::text || '/' || v_miniature.id::text || '.web.glb' then
    raise exception 'Invalid web GLB storage path.';
  end if;
  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'character-miniatures'
      and o.name = p_web_storage_path
  ) then
    raise exception 'The uploaded web GLB could not be found.';
  end if;

  update public.character_miniatures
  set web_storage_path = p_web_storage_path,
      web_file_size_bytes = p_web_file_size_bytes,
      web_generated_at = now()
  where id = p_miniature_id;
end;
$$;

-- Return the optional derivative to clients while preserving all existing columns.
drop function if exists public.list_campaign_miniature_roster(uuid);
create function public.list_campaign_miniature_roster(p_campaign_id uuid)
returns table (
  player_id uuid,
  display_name text,
  miniature_id uuid,
  storage_path text,
  original_name text,
  file_size_bytes bigint,
  triangle_count bigint,
  width_mm double precision,
  depth_mm double precision,
  height_mm double precision,
  miniature_created_at timestamptz,
  web_storage_path text,
  web_file_size_bytes bigint,
  web_generated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public.is_campaign_member(p_campaign_id) and not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Campaign access required.';
  end if;

  return query
  select
    cm.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Adventurer') as display_name,
    m.id,
    m.storage_path,
    m.original_name,
    m.file_size_bytes,
    m.triangle_count,
    m.width_mm,
    m.depth_mm,
    m.height_mm,
    m.created_at,
    m.web_storage_path,
    m.web_file_size_bytes,
    m.web_generated_at
  from public.campaign_members cm
  left join public.profiles p on p.id = cm.user_id
  left join public.character_miniatures m
    on m.campaign_id = cm.campaign_id
   and m.player_id = cm.user_id
   and m.is_current = true
  where cm.campaign_id = p_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
  order by lower(coalesce(nullif(trim(p.display_name), ''), 'Adventurer'));
end;
$$;

revoke all on function public.attach_character_miniature_web_derivative(uuid, text, bigint) from public, anon;
revoke all on function public.list_campaign_miniature_roster(uuid) from public, anon;
grant execute on function public.attach_character_miniature_web_derivative(uuid, text, bigint) to authenticated, service_role;
grant execute on function public.list_campaign_miniature_roster(uuid) to authenticated, service_role;

commit;
