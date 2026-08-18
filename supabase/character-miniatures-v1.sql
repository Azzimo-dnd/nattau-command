-- Character Miniatures v1 — private STL storage, version history and current model selection
begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('character-miniatures', 'character-miniatures', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create table if not exists public.character_miniatures (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 240),
  format text not null default 'stl' check (format in ('stl', 'glb')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  triangle_count bigint check (triangle_count is null or triangle_count >= 0),
  width_mm double precision check (width_mm is null or width_mm >= 0),
  depth_mm double precision check (depth_mm is null or depth_mm >= 0),
  height_mm double precision check (height_mm is null or height_mm >= 0),
  is_current boolean not null default false,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists character_miniatures_player_history_idx
  on public.character_miniatures (campaign_id, player_id, created_at desc);

create unique index if not exists character_miniatures_one_current_idx
  on public.character_miniatures (campaign_id, player_id)
  where is_current;

alter table public.character_miniatures enable row level security;

create or replace function public.is_active_campaign_player(
  target_campaign_id uuid,
  target_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = target_player_id
      and cm.role = 'player'
      and cm.is_active = true
  );
$$;

create or replace function public.character_miniature_path_campaign_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception
  when invalid_text_representation then return null;
end;
$$;

create or replace function public.character_miniature_path_player_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return split_part(object_name, '/', 2)::uuid;
exception
  when invalid_text_representation then return null;
end;
$$;

create or replace function public.can_manage_character_miniature_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_campaign_id uuid;
  v_player_id uuid;
begin
  v_campaign_id := public.character_miniature_path_campaign_id(object_name);
  v_player_id := public.character_miniature_path_player_id(object_name);

  if v_campaign_id is null or v_player_id is null then
    return false;
  end if;

  return public.is_campaign_dm(v_campaign_id)
    and public.is_active_campaign_player(v_campaign_id, v_player_id);
end;
$$;

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
        and m.storage_path = object_name
    );
  end if;

  return public.is_campaign_member(v_campaign_id)
    and exists (
      select 1
      from public.character_miniatures m
      where m.campaign_id = v_campaign_id
        and m.storage_path = object_name
        and m.is_current = true
    );
end;
$$;

create or replace function public.register_character_miniature(
  p_campaign_id uuid,
  p_player_id uuid,
  p_storage_path text,
  p_original_name text,
  p_file_size_bytes bigint,
  p_triangle_count bigint default null,
  p_width_mm double precision default null,
  p_depth_mm double precision default null,
  p_height_mm double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Game Master access required.';
  end if;
  if not public.is_active_campaign_player(p_campaign_id, p_player_id) then
    raise exception 'The selected character is not an active campaign player.';
  end if;
  if p_storage_path <> p_campaign_id::text || '/' || p_player_id::text || '/' || split_part(p_storage_path, '/', 3) then
    raise exception 'Invalid miniature storage path.';
  end if;
  if lower(right(p_storage_path, 4)) <> '.stl' then
    raise exception 'Character Miniatures v1 accepts STL files only.';
  end if;
  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'character-miniatures'
      and o.name = p_storage_path
  ) then
    raise exception 'The uploaded miniature file could not be found.';
  end if;

  update public.character_miniatures
  set is_current = false
  where campaign_id = p_campaign_id
    and player_id = p_player_id
    and is_current = true;

  insert into public.character_miniatures (
    campaign_id,
    player_id,
    storage_path,
    original_name,
    format,
    file_size_bytes,
    triangle_count,
    width_mm,
    depth_mm,
    height_mm,
    is_current,
    uploaded_by
  ) values (
    p_campaign_id,
    p_player_id,
    p_storage_path,
    left(trim(p_original_name), 240),
    'stl',
    p_file_size_bytes,
    p_triangle_count,
    p_width_mm,
    p_depth_mm,
    p_height_mm,
    true,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.set_character_miniature_current(p_miniature_id uuid)
returns void
language plpgsql
security definer
set search_path = public
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

  update public.character_miniatures
  set is_current = false
  where campaign_id = v_miniature.campaign_id
    and player_id = v_miniature.player_id
    and is_current = true;

  update public.character_miniatures
  set is_current = true
  where id = p_miniature_id;
end;
$$;

create or replace function public.list_campaign_miniature_roster(p_campaign_id uuid)
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
  miniature_created_at timestamptz
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
    m.created_at
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

drop policy if exists "Campaign miniature current read" on public.character_miniatures;
create policy "Campaign miniature current read"
on public.character_miniatures
for select
to authenticated
using (
  public.is_campaign_dm(campaign_id)
  or (is_current = true and public.is_campaign_member(campaign_id))
);

revoke all on table public.character_miniatures from anon;
revoke insert, update, delete on table public.character_miniatures from authenticated;
grant select on table public.character_miniatures to authenticated;

revoke all on function public.is_active_campaign_player(uuid, uuid) from public, anon;
revoke all on function public.can_manage_character_miniature_object(text) from public, anon;
revoke all on function public.can_read_character_miniature_object(text) from public, anon;
revoke all on function public.register_character_miniature(uuid, uuid, text, text, bigint, bigint, double precision, double precision, double precision) from public, anon;
revoke all on function public.set_character_miniature_current(uuid) from public, anon;
revoke all on function public.list_campaign_miniature_roster(uuid) from public, anon;

grant execute on function public.is_active_campaign_player(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_character_miniature_object(text) to authenticated, service_role;
grant execute on function public.can_read_character_miniature_object(text) to authenticated, service_role;
grant execute on function public.register_character_miniature(uuid, uuid, text, text, bigint, bigint, double precision, double precision, double precision) to authenticated, service_role;
grant execute on function public.set_character_miniature_current(uuid) to authenticated, service_role;
grant execute on function public.list_campaign_miniature_roster(uuid) to authenticated, service_role;

drop policy if exists "Campaign miniature current download" on storage.objects;
create policy "Campaign miniature current download"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'character-miniatures'
  and public.can_read_character_miniature_object(name)
);

drop policy if exists "GM miniature upload" on storage.objects;
create policy "GM miniature upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'character-miniatures'
  and public.can_manage_character_miniature_object(name)
);

drop policy if exists "GM miniature update" on storage.objects;
create policy "GM miniature update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'character-miniatures'
  and public.can_manage_character_miniature_object(name)
)
with check (
  bucket_id = 'character-miniatures'
  and public.can_manage_character_miniature_object(name)
);

drop policy if exists "GM miniature delete" on storage.objects;
create policy "GM miniature delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'character-miniatures'
  and public.can_manage_character_miniature_object(name)
);

commit;
