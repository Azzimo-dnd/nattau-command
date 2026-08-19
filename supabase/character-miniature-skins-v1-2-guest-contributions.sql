-- Character Miniature Skins v1.2 — community paint contributions
begin;

alter table public.character_miniature_paint_jobs
  add column if not exists is_guest_contribution boolean not null default false;

create unique index if not exists character_miniature_paint_jobs_one_guest_slot_idx
  on public.character_miniature_paint_jobs (miniature_id, created_by)
  where is_guest_contribution = true;

create or replace function public.character_paint_path_creator_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return split_part(object_name, '/', 4)::uuid;
exception
  when invalid_text_representation then return null;
end;
$$;

create or replace function public.can_manage_character_paint_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_campaign_id uuid;
  v_player_id uuid;
  v_miniature_id uuid;
  v_creator_id uuid;
begin
  v_campaign_id := public.character_paint_path_campaign_id(object_name);
  v_player_id := public.character_paint_path_player_id(object_name);
  v_miniature_id := public.character_paint_path_miniature_id(object_name);
  v_creator_id := public.character_paint_path_creator_id(object_name);

  if v_campaign_id is null or v_player_id is null or v_miniature_id is null or v_creator_id is null then
    return false;
  end if;
  if split_part(object_name, '/', 5) = '' or split_part(object_name, '/', 6) <> '' then
    return false;
  end if;
  if auth.uid() is null or auth.uid() <> v_creator_id then
    return false;
  end if;
  if not public.is_campaign_dm(v_campaign_id)
     and not public.is_active_campaign_player(v_campaign_id, auth.uid()) then
    return false;
  end if;

  return public.is_active_campaign_player(v_campaign_id, v_player_id)
    and exists (
      select 1 from public.character_miniatures m
      where m.id = v_miniature_id
        and m.campaign_id = v_campaign_id
        and m.player_id = v_player_id
        and m.is_current = true
    );
end;
$$;

create or replace function public.register_character_miniature_paint_job(
  p_miniature_id uuid,
  p_storage_path text,
  p_name text,
  p_file_size_bytes bigint,
  p_schema_version smallint default 1
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_miniature public.character_miniatures%rowtype;
  v_id uuid;
  v_is_dm boolean;
  v_is_owner boolean;
  v_is_guest boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_miniature from public.character_miniatures where id = p_miniature_id for share;
  if v_miniature.id is null then raise exception 'Miniature not found.'; end if;
  if v_miniature.is_current is not true then raise exception 'Paint jobs can only be added to the current miniature.'; end if;

  v_is_dm := public.is_campaign_dm(v_miniature.campaign_id);
  v_is_owner := auth.uid() = v_miniature.player_id;
  v_is_guest := not v_is_dm and not v_is_owner;

  if not v_is_dm and not public.is_active_campaign_player(v_miniature.campaign_id, auth.uid()) then
    raise exception 'Only active campaign players or the Game Master can add paint jobs.';
  end if;

  if v_is_guest and exists (
    select 1 from public.character_miniature_paint_jobs pj
    where pj.miniature_id = v_miniature.id
      and pj.created_by = auth.uid()
      and pj.is_guest_contribution = true
  ) then
    raise exception 'You already have one skin for this character. Load it and replace your contribution instead.';
  end if;

  if p_schema_version <> 1 then raise exception 'Unsupported paint-job schema version.'; end if;
  if p_file_size_bytes <= 0 or p_file_size_bytes > 8388608 then raise exception 'Paint job exceeds the 8 MB limit.'; end if;
  if char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 80 then raise exception 'Paint-job name must contain between 1 and 80 characters.'; end if;
  if p_storage_path <> v_miniature.campaign_id::text || '/' || v_miniature.player_id::text || '/' || v_miniature.id::text || '/' || auth.uid()::text || '/' || split_part(p_storage_path, '/', 5)
     or split_part(p_storage_path, '/', 6) <> '' then raise exception 'Invalid paint-job storage path.'; end if;
  if lower(right(p_storage_path, 5)) <> '.json' then raise exception 'Paint jobs must be stored as JSON.'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'character-miniature-paints' and o.name = p_storage_path) then
    raise exception 'The uploaded paint-job file could not be found.';
  end if;

  insert into public.character_miniature_paint_jobs (
    campaign_id, player_id, miniature_id, name, storage_path, schema_version,
    file_size_bytes, is_default, created_by, is_guest_contribution
  ) values (
    v_miniature.campaign_id, v_miniature.player_id, v_miniature.id, trim(p_name),
    p_storage_path, p_schema_version, p_file_size_bytes, false, auth.uid(), v_is_guest
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.replace_character_miniature_guest_paint_job(
  p_paint_job_id uuid,
  p_storage_path text,
  p_name text,
  p_file_size_bytes bigint,
  p_schema_version smallint default 1
)
returns text
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_paint public.character_miniature_paint_jobs%rowtype;
  v_miniature public.character_miniatures%rowtype;
  v_old_storage_path text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_paint from public.character_miniature_paint_jobs where id = p_paint_job_id for update;
  if v_paint.id is null then raise exception 'Paint job not found.'; end if;
  if v_paint.created_by <> auth.uid() or v_paint.is_guest_contribution is not true then
    raise exception 'Only your own guest contribution can be replaced.';
  end if;
  if v_paint.is_default then
    raise exception 'This guest skin is currently the default. Ask the character owner or Game Master to switch the default before replacing it.';
  end if;

  select * into v_miniature from public.character_miniatures where id = v_paint.miniature_id for share;
  if v_miniature.id is null or v_miniature.is_current is not true then
    raise exception 'The paint job does not belong to the current miniature.';
  end if;
  if not public.is_active_campaign_player(v_miniature.campaign_id, auth.uid()) then
    raise exception 'Only active campaign players can replace guest paint jobs.';
  end if;

  if p_schema_version <> 1 then raise exception 'Unsupported paint-job schema version.'; end if;
  if p_file_size_bytes <= 0 or p_file_size_bytes > 8388608 then raise exception 'Paint job exceeds the 8 MB limit.'; end if;
  if char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 80 then raise exception 'Paint-job name must contain between 1 and 80 characters.'; end if;
  if p_storage_path <> v_miniature.campaign_id::text || '/' || v_miniature.player_id::text || '/' || v_miniature.id::text || '/' || auth.uid()::text || '/' || split_part(p_storage_path, '/', 5)
     or split_part(p_storage_path, '/', 6) <> '' then raise exception 'Invalid paint-job storage path.'; end if;
  if lower(right(p_storage_path, 5)) <> '.json' then raise exception 'Paint jobs must be stored as JSON.'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'character-miniature-paints' and o.name = p_storage_path) then
    raise exception 'The uploaded paint-job file could not be found.';
  end if;

  v_old_storage_path := v_paint.storage_path;
  update public.character_miniature_paint_jobs
  set name = trim(p_name), storage_path = p_storage_path,
      schema_version = p_schema_version, file_size_bytes = p_file_size_bytes
  where id = v_paint.id;
  return v_old_storage_path;
end;
$$;

drop function if exists public.list_character_miniature_paint_jobs(uuid);
create function public.list_character_miniature_paint_jobs(p_miniature_id uuid)
returns table (
  id uuid, name text, storage_path text, schema_version smallint,
  file_size_bytes bigint, is_default boolean, created_by uuid,
  creator_display_name text, created_at timestamptz,
  can_set_default boolean, is_mine boolean,
  is_guest_contribution boolean, can_replace boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_miniature public.character_miniatures%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_miniature from public.character_miniatures where public.character_miniatures.id = p_miniature_id;
  if v_miniature.id is null then raise exception 'Miniature not found.'; end if;
  if not public.is_campaign_dm(v_miniature.campaign_id)
     and not (v_miniature.is_current = true and public.is_campaign_member(v_miniature.campaign_id)) then
    raise exception 'Campaign access required.';
  end if;

  return query
  select pj.id, pj.name, pj.storage_path, pj.schema_version, pj.file_size_bytes,
    pj.is_default, pj.created_by,
    coalesce(nullif(trim(p.display_name), ''), 'Adventurer'), pj.created_at,
    (public.is_campaign_dm(v_miniature.campaign_id) or auth.uid() = v_miniature.player_id),
    (auth.uid() = pj.created_by), pj.is_guest_contribution,
    (auth.uid() = pj.created_by and pj.is_guest_contribution = true and pj.is_default = false)
  from public.character_miniature_paint_jobs pj
  left join public.profiles p on p.id = pj.created_by
  where pj.miniature_id = p_miniature_id
  order by pj.is_default desc, pj.created_at desc;
end;
$$;

revoke all on function public.character_paint_path_creator_id(text) from public, anon;
revoke all on function public.replace_character_miniature_guest_paint_job(uuid, text, text, bigint, smallint) from public, anon;
revoke all on function public.list_character_miniature_paint_jobs(uuid) from public, anon;

grant execute on function public.character_paint_path_creator_id(text) to authenticated, service_role;
grant execute on function public.replace_character_miniature_guest_paint_job(uuid, text, text, bigint, smallint) to authenticated, service_role;
grant execute on function public.list_character_miniature_paint_jobs(uuid) to authenticated, service_role;

commit;