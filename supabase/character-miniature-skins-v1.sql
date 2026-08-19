-- Character Miniature Skins v1 — private paint documents, multiple skins and owner/GM default selection
begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('character-miniature-paints', 'character-miniature-paints', false, 8388608)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create table if not exists public.character_miniature_paint_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  miniature_id uuid not null references public.character_miniatures(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  storage_path text not null unique,
  schema_version smallint not null default 1 check (schema_version = 1),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 8388608),
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists character_miniature_paint_jobs_history_idx
  on public.character_miniature_paint_jobs (miniature_id, created_at desc);
create index if not exists character_miniature_paint_jobs_campaign_player_idx
  on public.character_miniature_paint_jobs (campaign_id, player_id, created_at desc);
create unique index if not exists character_miniature_paint_jobs_one_default_idx
  on public.character_miniature_paint_jobs (miniature_id)
  where is_default;

alter table public.character_miniature_paint_jobs enable row level security;

create or replace function public.character_paint_path_campaign_id(object_name text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when invalid_text_representation then return null;
end;
$$;

create or replace function public.character_paint_path_player_id(object_name text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return split_part(object_name, '/', 2)::uuid;
exception when invalid_text_representation then return null;
end;
$$;

create or replace function public.character_paint_path_miniature_id(object_name text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return split_part(object_name, '/', 3)::uuid;
exception when invalid_text_representation then return null;
end;
$$;

create or replace function public.can_manage_character_paint_object(object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, storage
as $$
declare
  v_campaign_id uuid;
  v_player_id uuid;
  v_miniature_id uuid;
begin
  v_campaign_id := public.character_paint_path_campaign_id(object_name);
  v_player_id := public.character_paint_path_player_id(object_name);
  v_miniature_id := public.character_paint_path_miniature_id(object_name);
  if v_campaign_id is null or v_player_id is null or v_miniature_id is null then return false; end if;
  if split_part(object_name, '/', 4) = '' or split_part(object_name, '/', 5) <> '' then return false; end if;
  return (
    public.is_campaign_dm(v_campaign_id)
    or (auth.uid() = v_player_id and public.is_active_campaign_player(v_campaign_id, v_player_id))
  ) and exists (
    select 1 from public.character_miniatures m
    where m.id = v_miniature_id
      and m.campaign_id = v_campaign_id
      and m.player_id = v_player_id
      and m.is_current = true
  );
end;
$$;

create or replace function public.can_read_character_paint_object(object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, storage
as $$
declare
  v_campaign_id uuid;
begin
  v_campaign_id := public.character_paint_path_campaign_id(object_name);
  if v_campaign_id is null then return false; end if;
  if public.is_campaign_dm(v_campaign_id) then
    return exists (
      select 1 from public.character_miniature_paint_jobs pj
      where pj.campaign_id = v_campaign_id and pj.storage_path = object_name
    );
  end if;
  return public.is_campaign_member(v_campaign_id)
    and exists (
      select 1
      from public.character_miniature_paint_jobs pj
      join public.character_miniatures m on m.id = pj.miniature_id
      where pj.campaign_id = v_campaign_id
        and pj.storage_path = object_name
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
language plpgsql security definer
set search_path = public, storage
as $$
declare
  v_miniature public.character_miniatures%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_miniature from public.character_miniatures where id = p_miniature_id for share;
  if v_miniature.id is null then raise exception 'Miniature not found.'; end if;
  if v_miniature.is_current is not true then raise exception 'Paint jobs can only be added to the current miniature.'; end if;
  if not public.is_campaign_dm(v_miniature.campaign_id)
     and not (auth.uid() = v_miniature.player_id and public.is_active_campaign_player(v_miniature.campaign_id, v_miniature.player_id)) then
    raise exception 'Only the Game Master or the character owner can add a paint job.';
  end if;
  if p_schema_version <> 1 then raise exception 'Unsupported paint-job schema version.'; end if;
  if p_file_size_bytes <= 0 or p_file_size_bytes > 8388608 then raise exception 'Paint job exceeds the 8 MB limit.'; end if;
  if char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 80 then raise exception 'Paint-job name must contain between 1 and 80 characters.'; end if;
  if p_storage_path <> v_miniature.campaign_id::text || '/' || v_miniature.player_id::text || '/' || v_miniature.id::text || '/' || split_part(p_storage_path, '/', 4)
     or split_part(p_storage_path, '/', 5) <> '' then raise exception 'Invalid paint-job storage path.'; end if;
  if lower(right(p_storage_path, 5)) <> '.json' then raise exception 'Paint jobs must be stored as JSON.'; end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'character-miniature-paints' and o.name = p_storage_path
  ) then raise exception 'The uploaded paint-job file could not be found.'; end if;

  insert into public.character_miniature_paint_jobs (
    campaign_id, player_id, miniature_id, name, storage_path, schema_version,
    file_size_bytes, is_default, created_by
  ) values (
    v_miniature.campaign_id, v_miniature.player_id, v_miniature.id, trim(p_name),
    p_storage_path, p_schema_version, p_file_size_bytes, false, auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_character_miniature_paint_default(p_paint_job_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_paint public.character_miniature_paint_jobs%rowtype;
  v_miniature public.character_miniatures%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_paint from public.character_miniature_paint_jobs where id = p_paint_job_id for update;
  if v_paint.id is null then raise exception 'Paint job not found.'; end if;
  select * into v_miniature from public.character_miniatures where id = v_paint.miniature_id for update;
  if v_miniature.id is null or v_miniature.is_current is not true then raise exception 'The paint job does not belong to the current miniature.'; end if;
  if not public.is_campaign_dm(v_miniature.campaign_id) and auth.uid() <> v_miniature.player_id then
    raise exception 'Only the Game Master or the character owner can choose the default skin.';
  end if;
  update public.character_miniature_paint_jobs set is_default = false where miniature_id = v_miniature.id and is_default = true;
  update public.character_miniature_paint_jobs set is_default = true where id = v_paint.id;
end;
$$;

create or replace function public.clear_character_miniature_paint_default(p_miniature_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_miniature public.character_miniatures%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_miniature from public.character_miniatures where id = p_miniature_id for update;
  if v_miniature.id is null or v_miniature.is_current is not true then raise exception 'Current miniature not found.'; end if;
  if not public.is_campaign_dm(v_miniature.campaign_id) and auth.uid() <> v_miniature.player_id then
    raise exception 'Only the Game Master or the character owner can choose the default skin.';
  end if;
  update public.character_miniature_paint_jobs set is_default = false where miniature_id = v_miniature.id and is_default = true;
end;
$$;

create or replace function public.list_character_miniature_paint_jobs(p_miniature_id uuid)
returns table (
  id uuid,
  name text,
  storage_path text,
  schema_version smallint,
  file_size_bytes bigint,
  is_default boolean,
  created_by uuid,
  creator_display_name text,
  created_at timestamptz,
  can_set_default boolean,
  is_mine boolean
)
language plpgsql stable security definer
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
  select pj.id, pj.name, pj.storage_path, pj.schema_version, pj.file_size_bytes, pj.is_default,
    pj.created_by, coalesce(nullif(trim(p.display_name), ''), 'Adventurer'), pj.created_at,
    (public.is_campaign_dm(v_miniature.campaign_id) or auth.uid() = v_miniature.player_id),
    (auth.uid() = pj.created_by)
  from public.character_miniature_paint_jobs pj
  left join public.profiles p on p.id = pj.created_by
  where pj.miniature_id = p_miniature_id
  order by pj.is_default desc, pj.created_at desc;
end;
$$;

drop policy if exists "Campaign miniature paint read" on public.character_miniature_paint_jobs;
create policy "Campaign miniature paint read"
on public.character_miniature_paint_jobs
for select to authenticated
using (
  public.is_campaign_dm(campaign_id)
  or (
    public.is_campaign_member(campaign_id)
    and exists (select 1 from public.character_miniatures m where m.id = miniature_id and m.is_current = true)
  )
);

revoke all on table public.character_miniature_paint_jobs from anon;
revoke insert, update, delete on table public.character_miniature_paint_jobs from authenticated;
grant select on table public.character_miniature_paint_jobs to authenticated;

revoke all on function public.character_paint_path_campaign_id(text) from public, anon;
revoke all on function public.character_paint_path_player_id(text) from public, anon;
revoke all on function public.character_paint_path_miniature_id(text) from public, anon;
revoke all on function public.can_manage_character_paint_object(text) from public, anon;
revoke all on function public.can_read_character_paint_object(text) from public, anon;
revoke all on function public.register_character_miniature_paint_job(uuid, text, text, bigint, smallint) from public, anon;
revoke all on function public.set_character_miniature_paint_default(uuid) from public, anon;
revoke all on function public.clear_character_miniature_paint_default(uuid) from public, anon;
revoke all on function public.list_character_miniature_paint_jobs(uuid) from public, anon;

grant execute on function public.character_paint_path_campaign_id(text) to authenticated, service_role;
grant execute on function public.character_paint_path_player_id(text) to authenticated, service_role;
grant execute on function public.character_paint_path_miniature_id(text) to authenticated, service_role;
grant execute on function public.can_manage_character_paint_object(text) to authenticated, service_role;
grant execute on function public.can_read_character_paint_object(text) to authenticated, service_role;
grant execute on function public.register_character_miniature_paint_job(uuid, text, text, bigint, smallint) to authenticated, service_role;
grant execute on function public.set_character_miniature_paint_default(uuid) to authenticated, service_role;
grant execute on function public.clear_character_miniature_paint_default(uuid) to authenticated, service_role;
grant execute on function public.list_character_miniature_paint_jobs(uuid) to authenticated, service_role;

drop policy if exists "Campaign miniature paint download" on storage.objects;
create policy "Campaign miniature paint download"
on storage.objects for select to authenticated
using (bucket_id = 'character-miniature-paints' and public.can_read_character_paint_object(name));

drop policy if exists "Character miniature paint upload" on storage.objects;
create policy "Character miniature paint upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'character-miniature-paints' and public.can_manage_character_paint_object(name));

drop policy if exists "Character miniature paint cleanup" on storage.objects;
create policy "Character miniature paint cleanup"
on storage.objects for delete to authenticated
using (bucket_id = 'character-miniature-paints' and public.can_manage_character_paint_object(name));

commit;
