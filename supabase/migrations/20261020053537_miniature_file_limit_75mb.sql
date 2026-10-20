-- Requires Supabase Pro (or higher) and a global Storage file size limit
-- of at least 78643200 bytes. Do not apply on the Free plan (50 MB cap).
-- Both source files and calibrated web derivatives accept up to 75 MiB.
begin;

alter table public.character_miniatures
  drop constraint character_miniatures_file_size_bytes_check,
  add constraint character_miniatures_file_size_bytes_check check (file_size_bytes > 0 and file_size_bytes <= 78643200);

alter table public.character_miniatures
  drop constraint character_miniatures_web_file_size_bytes_check,
  add constraint character_miniatures_web_file_size_bytes_check check (web_file_size_bytes is null or (web_file_size_bytes > 0 and web_file_size_bytes <= 78643200));

alter table public.vtt_enemy_models
  drop constraint vtt_enemy_models_file_size_bytes_check,
  add constraint vtt_enemy_models_file_size_bytes_check check (file_size_bytes > 0 and file_size_bytes <= 78643200);

alter table public.vtt_enemy_models
  drop constraint vtt_enemy_models_web_file_size_bytes_check,
  add constraint vtt_enemy_models_web_file_size_bytes_check check (web_file_size_bytes is null or (web_file_size_bytes > 0 and web_file_size_bytes <= 78643200));

-- No other buckets, MIME restrictions or access policies are changed.
update storage.buckets set file_size_limit = 78643200
where id in ('character-miniatures', 'vtt-enemy-models');

create or replace function public.register_character_miniature_asset(
  p_campaign_id uuid,
  p_player_id uuid,
  p_storage_path text,
  p_web_storage_path text,
  p_original_name text,
  p_file_size_bytes bigint,
  p_web_file_size_bytes bigint,
  p_triangle_count bigint,
  p_width_mm double precision,
  p_depth_mm double precision,
  p_height_mm double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_format text;
  v_prefix text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not public.is_campaign_dm(p_campaign_id) then raise exception 'Game Master access required.'; end if;
  if not public.is_active_campaign_player(p_campaign_id, p_player_id) then
    raise exception 'The selected character is not an active campaign player.';
  end if;
  v_format := lower(right(p_storage_path, 3));
  if v_format is null or v_format not in ('stl', 'glb') or p_original_name is null
     or lower(right(p_original_name, 4)) <> '.' || v_format then
    raise exception 'Choose an STL or GLB miniature.';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes not between 1 and 78643200
     or p_web_file_size_bytes is null or p_web_file_size_bytes not between 1 and 78643200 then
    raise exception 'Miniature files must be between 1 byte and 75 MB.';
  end if;
  v_id := split_part(split_part(p_storage_path, '/', 3), '.', 1)::uuid;
  v_prefix := p_campaign_id::text || '/' || p_player_id::text || '/' || v_id::text;
  if p_storage_path is distinct from v_prefix || '.' || v_format
     or p_web_storage_path is distinct from v_prefix || '.web.glb' then
    raise exception 'Invalid miniature storage path.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'character-miniatures' and name = p_storage_path)
     or not exists (select 1 from storage.objects where bucket_id = 'character-miniatures' and name = p_web_storage_path) then
    raise exception 'Both the source and web miniature must be uploaded first.';
  end if;
  -- Serialize concurrent uploads for a character before switching the current version.
  perform pg_advisory_xact_lock(hashtextextended(p_campaign_id::text || '/' || p_player_id::text, 0));
  update public.character_miniatures set is_current = false
    where campaign_id = p_campaign_id and player_id = p_player_id and is_current;
  insert into public.character_miniatures (
    id, campaign_id, player_id, storage_path, original_name, format,
    file_size_bytes, triangle_count, width_mm, depth_mm, height_mm,
    web_storage_path, web_file_size_bytes, web_generated_at, is_current, uploaded_by
  ) values (
    v_id, p_campaign_id, p_player_id, p_storage_path, left(trim(p_original_name), 240), v_format,
    p_file_size_bytes, p_triangle_count, p_width_mm, p_depth_mm, p_height_mm,
    p_web_storage_path, p_web_file_size_bytes, now(), true, auth.uid()
  );
  return v_id;
end;
$$;

revoke all on function public.register_character_miniature_asset(uuid,uuid,text,text,text,bigint,bigint,bigint,double precision,double precision,double precision) from public, anon;
grant execute on function public.register_character_miniature_asset(uuid,uuid,text,text,text,bigint,bigint,bigint,double precision,double precision,double precision) to authenticated, service_role;


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
  if p_web_file_size_bytes <= 0 or p_web_file_size_bytes > 78643200 then
    raise exception 'Web GLB exceeds the 75 MB miniature limit.';
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


commit;
