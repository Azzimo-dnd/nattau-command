-- Nattau VTT Alpha v0.1 — 5 ft grid, GM-only world control, private enemy assets
begin;

create table if not exists public.vtt_scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  grid_width integer not null default 24 check (grid_width between 4 and 100),
  grid_height integer not null default 18 check (grid_height between 4 and 100),
  feet_per_square integer not null default 5 check (feet_per_square between 1 and 20),
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vtt_scenes_one_active_per_campaign_idx
  on public.vtt_scenes(campaign_id) where is_active;
create index if not exists vtt_scenes_campaign_idx on public.vtt_scenes(campaign_id);

create table if not exists public.vtt_enemy_models (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  storage_path text not null unique,
  web_storage_path text unique,
  original_name text not null check (char_length(trim(original_name)) between 1 and 240),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  web_file_size_bytes bigint check (web_file_size_bytes is null or (web_file_size_bytes > 0 and web_file_size_bytes <= 52428800)),
  triangle_count bigint check (triangle_count is null or triangle_count >= 0),
  width_mm double precision check (width_mm is null or width_mm > 0),
  depth_mm double precision check (depth_mm is null or depth_mm > 0),
  height_mm double precision check (height_mm is null or height_mm > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vtt_enemy_models_campaign_idx on public.vtt_enemy_models(campaign_id, lower(name));

create table if not exists public.vtt_enemy_paint_jobs (
  id uuid primary key default gen_random_uuid(),
  enemy_model_id uuid not null references public.vtt_enemy_models(id) on delete cascade,
  storage_path text not null unique,
  name text not null check (char_length(trim(name)) between 1 and 160),
  schema_version integer not null default 1 check (schema_version between 1 and 10),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 8388608),
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists vtt_enemy_paint_one_default_idx
  on public.vtt_enemy_paint_jobs(enemy_model_id) where is_default;
create index if not exists vtt_enemy_paint_model_idx on public.vtt_enemy_paint_jobs(enemy_model_id, created_at desc);

create table if not exists public.vtt_tokens (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.vtt_scenes(id) on delete cascade,
  character_miniature_id uuid references public.character_miniatures(id) on delete cascade,
  enemy_model_id uuid references public.vtt_enemy_models(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  x double precision not null default 0,
  z double precision not null default 0,
  rotation double precision not null default 0,
  scale double precision not null default 1 check (scale > 0 and scale <= 10),
  size_squares double precision not null default 1 check (size_squares >= 0.5 and size_squares <= 8),
  visible_to_players boolean not null default true,
  revision bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vtt_tokens_one_source_chk check (
    (character_miniature_id is not null and enemy_model_id is null)
    or (character_miniature_id is null and enemy_model_id is not null)
  )
);

create index if not exists vtt_tokens_scene_idx on public.vtt_tokens(scene_id);
create index if not exists vtt_tokens_character_idx on public.vtt_tokens(character_miniature_id) where character_miniature_id is not null;
create index if not exists vtt_tokens_enemy_idx on public.vtt_tokens(enemy_model_id) where enemy_model_id is not null;
create unique index if not exists vtt_tokens_one_party_character_per_scene_idx
  on public.vtt_tokens(scene_id, character_miniature_id) where character_miniature_id is not null;

alter table public.vtt_scenes enable row level security;
alter table public.vtt_enemy_models enable row level security;
alter table public.vtt_enemy_paint_jobs enable row level security;
alter table public.vtt_tokens enable row level security;

drop policy if exists "VTT scene campaign read" on public.vtt_scenes;
create policy "VTT scene campaign read" on public.vtt_scenes for select to authenticated
using (public.is_campaign_member(campaign_id) or public.is_campaign_dm(campaign_id));

drop policy if exists "VTT scene GM write" on public.vtt_scenes;
create policy "VTT scene GM write" on public.vtt_scenes for all to authenticated
using (public.is_campaign_dm(campaign_id))
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "VTT enemy GM read" on public.vtt_enemy_models;
create policy "VTT enemy GM read" on public.vtt_enemy_models for select to authenticated
using (public.is_campaign_dm(campaign_id));

drop policy if exists "VTT enemy GM write" on public.vtt_enemy_models;
create policy "VTT enemy GM write" on public.vtt_enemy_models for all to authenticated
using (public.is_campaign_dm(campaign_id))
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "VTT enemy paint GM read" on public.vtt_enemy_paint_jobs;
create policy "VTT enemy paint GM read" on public.vtt_enemy_paint_jobs for select to authenticated
using (exists (
  select 1 from public.vtt_enemy_models e
  where e.id = enemy_model_id and public.is_campaign_dm(e.campaign_id)
));

drop policy if exists "VTT enemy paint GM write" on public.vtt_enemy_paint_jobs;
create policy "VTT enemy paint GM write" on public.vtt_enemy_paint_jobs for all to authenticated
using (exists (
  select 1 from public.vtt_enemy_models e
  where e.id = enemy_model_id and public.is_campaign_dm(e.campaign_id)
))
with check (exists (
  select 1 from public.vtt_enemy_models e
  where e.id = enemy_model_id and public.is_campaign_dm(e.campaign_id)
));

drop policy if exists "VTT token campaign read" on public.vtt_tokens;
create policy "VTT token campaign read" on public.vtt_tokens for select to authenticated
using (exists (
  select 1 from public.vtt_scenes s
  where s.id = scene_id
    and (public.is_campaign_dm(s.campaign_id)
      or (visible_to_players and public.is_campaign_member(s.campaign_id)))
));

drop policy if exists "VTT token GM write" on public.vtt_tokens;
create policy "VTT token GM write" on public.vtt_tokens for all to authenticated
using (exists (
  select 1 from public.vtt_scenes s where s.id = scene_id and public.is_campaign_dm(s.campaign_id)
))
with check (exists (
  select 1 from public.vtt_scenes s where s.id = scene_id and public.is_campaign_dm(s.campaign_id)
));

grant select, insert, update, delete on public.vtt_scenes to authenticated, service_role;
grant select, insert, update, delete on public.vtt_enemy_models to authenticated, service_role;
grant select, insert, update, delete on public.vtt_enemy_paint_jobs to authenticated, service_role;
grant select, insert, update, delete on public.vtt_tokens to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('vtt-enemy-models', 'vtt-enemy-models', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

insert into storage.buckets (id, name, public, file_size_limit)
values ('vtt-enemy-paints', 'vtt-enemy-paints', false, 8388608)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function public.vtt_storage_campaign_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.can_manage_vtt_enemy_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.vtt_storage_campaign_id(object_name) is not null
    and public.is_campaign_dm(public.vtt_storage_campaign_id(object_name));
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
    join public.vtt_tokens t on t.enemy_model_id = e.id and t.visible_to_players = true
    join public.vtt_scenes s on s.id = t.scene_id and s.campaign_id = e.campaign_id
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
    join public.vtt_tokens t on t.enemy_model_id = e.id and t.visible_to_players = true
    join public.vtt_scenes s on s.id = t.scene_id and s.campaign_id = e.campaign_id
    where p.storage_path = object_name
      and p.is_default = true
      and e.campaign_id = v_campaign_id
  );
end;
$$;

drop policy if exists "VTT enemy model read" on storage.objects;
create policy "VTT enemy model read" on storage.objects for select to authenticated
using (
  bucket_id = 'vtt-enemy-models'
  and (public.can_manage_vtt_enemy_object(name) or public.can_read_vtt_enemy_model_object(name))
);

drop policy if exists "VTT enemy model upload" on storage.objects;
create policy "VTT enemy model upload" on storage.objects for insert to authenticated
with check (bucket_id = 'vtt-enemy-models' and public.can_manage_vtt_enemy_object(name));

drop policy if exists "VTT enemy model update" on storage.objects;
create policy "VTT enemy model update" on storage.objects for update to authenticated
using (bucket_id = 'vtt-enemy-models' and public.can_manage_vtt_enemy_object(name))
with check (bucket_id = 'vtt-enemy-models' and public.can_manage_vtt_enemy_object(name));

drop policy if exists "VTT enemy model delete" on storage.objects;
create policy "VTT enemy model delete" on storage.objects for delete to authenticated
using (bucket_id = 'vtt-enemy-models' and public.can_manage_vtt_enemy_object(name));

drop policy if exists "VTT enemy paint read" on storage.objects;
create policy "VTT enemy paint read" on storage.objects for select to authenticated
using (
  bucket_id = 'vtt-enemy-paints'
  and (public.can_manage_vtt_enemy_object(name) or public.can_read_vtt_enemy_paint_object(name))
);

drop policy if exists "VTT enemy paint upload" on storage.objects;
create policy "VTT enemy paint upload" on storage.objects for insert to authenticated
with check (bucket_id = 'vtt-enemy-paints' and public.can_manage_vtt_enemy_object(name));

drop policy if exists "VTT enemy paint update" on storage.objects;
create policy "VTT enemy paint update" on storage.objects for update to authenticated
using (bucket_id = 'vtt-enemy-paints' and public.can_manage_vtt_enemy_object(name))
with check (bucket_id = 'vtt-enemy-paints' and public.can_manage_vtt_enemy_object(name));

drop policy if exists "VTT enemy paint delete" on storage.objects;
create policy "VTT enemy paint delete" on storage.objects for delete to authenticated
using (bucket_id = 'vtt-enemy-paints' and public.can_manage_vtt_enemy_object(name));

create or replace function public.ensure_vtt_alpha_scene(p_campaign_id uuid)
returns public.vtt_scenes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scene public.vtt_scenes%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not public.is_campaign_dm(p_campaign_id) then raise exception 'Game Master access required.'; end if;

  select * into v_scene from public.vtt_scenes
  where campaign_id = p_campaign_id and is_active = true
  limit 1;

  if v_scene.id is null then
    insert into public.vtt_scenes(campaign_id, name, grid_width, grid_height, feet_per_square, is_active, created_by)
    values (p_campaign_id, 'Alpha Grid', 24, 18, 5, true, auth.uid())
    returning * into v_scene;
  end if;
  return v_scene;
end;
$$;

create or replace function public.register_vtt_enemy_model(
  p_campaign_id uuid,
  p_name text,
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
set search_path = public, storage
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not public.is_campaign_dm(p_campaign_id) then raise exception 'Game Master access required.'; end if;
  if public.vtt_storage_campaign_id(p_storage_path) is distinct from p_campaign_id then raise exception 'Invalid source path.'; end if;
  if p_web_storage_path is not null and public.vtt_storage_campaign_id(p_web_storage_path) is distinct from p_campaign_id then raise exception 'Invalid web path.'; end if;
  if not exists (select 1 from storage.objects where bucket_id='vtt-enemy-models' and name=p_storage_path) then raise exception 'Source STL not found.'; end if;
  if p_web_storage_path is not null and not exists (select 1 from storage.objects where bucket_id='vtt-enemy-models' and name=p_web_storage_path) then raise exception 'Web GLB not found.'; end if;

  insert into public.vtt_enemy_models(
    campaign_id,name,storage_path,web_storage_path,original_name,file_size_bytes,web_file_size_bytes,
    triangle_count,width_mm,depth_mm,height_mm,created_by
  ) values (
    p_campaign_id,trim(p_name),p_storage_path,p_web_storage_path,p_original_name,p_file_size_bytes,p_web_file_size_bytes,
    p_triangle_count,p_width_mm,p_depth_mm,p_height_mm,auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.register_vtt_enemy_paint_job(
  p_enemy_model_id uuid,
  p_storage_path text,
  p_name text,
  p_file_size_bytes bigint,
  p_schema_version integer,
  p_make_default boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_enemy public.vtt_enemy_models%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_enemy from public.vtt_enemy_models where id=p_enemy_model_id;
  if v_enemy.id is null then raise exception 'Enemy model not found.'; end if;
  if not public.is_campaign_dm(v_enemy.campaign_id) then raise exception 'Game Master access required.'; end if;
  if public.vtt_storage_campaign_id(p_storage_path) is distinct from v_enemy.campaign_id then raise exception 'Invalid paint path.'; end if;
  if not exists (select 1 from storage.objects where bucket_id='vtt-enemy-paints' and name=p_storage_path) then raise exception 'Paint document not found.'; end if;

  if p_make_default then
    update public.vtt_enemy_paint_jobs set is_default=false where enemy_model_id=p_enemy_model_id and is_default=true;
  end if;
  insert into public.vtt_enemy_paint_jobs(enemy_model_id,storage_path,name,file_size_bytes,schema_version,is_default,created_by)
  values (p_enemy_model_id,p_storage_path,trim(p_name),p_file_size_bytes,p_schema_version,p_make_default,auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_vtt_enemy_paint_default(p_paint_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model_id uuid;
  v_campaign_id uuid;
begin
  select p.enemy_model_id,e.campaign_id into v_model_id,v_campaign_id
  from public.vtt_enemy_paint_jobs p join public.vtt_enemy_models e on e.id=p.enemy_model_id
  where p.id=p_paint_job_id;
  if v_model_id is null then raise exception 'Paint job not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Game Master access required.'; end if;
  update public.vtt_enemy_paint_jobs set is_default=false where enemy_model_id=v_model_id;
  update public.vtt_enemy_paint_jobs set is_default=true where id=p_paint_job_id;
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
  v_count integer;
begin
  select campaign_id into v_campaign_id from public.vtt_scenes where id=p_scene_id;
  if v_campaign_id is null then raise exception 'Scene not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Game Master access required.'; end if;

  with party as (
    select m.id as miniature_id,
           coalesce(nullif(trim(p.display_name),''),'Adventurer') as display_name,
           row_number() over(order by lower(coalesce(nullif(trim(p.display_name),''),'Adventurer'))) as rn
    from public.campaign_members cm
    join public.character_miniatures m on m.campaign_id=cm.campaign_id and m.player_id=cm.user_id and m.is_current=true
    left join public.profiles p on p.id=cm.user_id
    where cm.campaign_id=v_campaign_id and cm.role='player' and cm.is_active=true
  ), inserted as (
    insert into public.vtt_tokens(scene_id,character_miniature_id,name,x,z,visible_to_players,created_by)
    select p_scene_id,miniature_id,display_name,(rn-3)*2,6,true,auth.uid()
    from party
    on conflict (scene_id, character_miniature_id) where character_miniature_id is not null do nothing
    returning 1
  ) select count(*) into v_count from inserted;
  return v_count;
end;
$$;

create or replace function public.spawn_vtt_enemy(p_scene_id uuid, p_enemy_model_id uuid, p_x double precision default 0, p_z double precision default 0)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_enemy public.vtt_enemy_models%rowtype;
  v_token_id uuid;
begin
  select campaign_id into v_campaign_id from public.vtt_scenes where id=p_scene_id;
  select * into v_enemy from public.vtt_enemy_models where id=p_enemy_model_id;
  if v_campaign_id is null or v_enemy.id is null then raise exception 'Scene or enemy model not found.'; end if;
  if v_enemy.campaign_id <> v_campaign_id then raise exception 'Enemy model belongs to another campaign.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Game Master access required.'; end if;
  insert into public.vtt_tokens(scene_id,enemy_model_id,name,x,z,visible_to_players,created_by)
  values (p_scene_id,p_enemy_model_id,v_enemy.name,p_x,p_z,false,auth.uid()) returning id into v_token_id;
  return v_token_id;
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
  v_is_dm boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select s.campaign_id into v_campaign_id from public.vtt_scenes s where s.id=p_scene_id;
  if v_campaign_id is null then raise exception 'Scene not found.'; end if;
  v_is_dm := public.is_campaign_dm(v_campaign_id);
  if not v_is_dm and not public.is_campaign_member(v_campaign_id) then raise exception 'Campaign access required.'; end if;

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

revoke all on function public.ensure_vtt_alpha_scene(uuid) from public, anon;
revoke all on function public.register_vtt_enemy_model(uuid,text,text,text,text,bigint,bigint,bigint,double precision,double precision,double precision) from public, anon;
revoke all on function public.register_vtt_enemy_paint_job(uuid,text,text,bigint,integer,boolean) from public, anon;
revoke all on function public.set_vtt_enemy_paint_default(uuid) from public, anon;
revoke all on function public.seed_vtt_party(uuid) from public, anon;
revoke all on function public.spawn_vtt_enemy(uuid,uuid,double precision,double precision) from public, anon;
revoke all on function public.list_vtt_scene_tokens(uuid) from public, anon;
revoke all on function public.can_manage_vtt_enemy_object(text) from public, anon;
revoke all on function public.can_read_vtt_enemy_model_object(text) from public, anon;
revoke all on function public.can_read_vtt_enemy_paint_object(text) from public, anon;
revoke all on function public.vtt_storage_campaign_id(text) from public, anon;

grant execute on function public.ensure_vtt_alpha_scene(uuid) to authenticated, service_role;
grant execute on function public.register_vtt_enemy_model(uuid,text,text,text,text,bigint,bigint,bigint,double precision,double precision,double precision) to authenticated, service_role;
grant execute on function public.register_vtt_enemy_paint_job(uuid,text,text,bigint,integer,boolean) to authenticated, service_role;
grant execute on function public.set_vtt_enemy_paint_default(uuid) to authenticated, service_role;
grant execute on function public.seed_vtt_party(uuid) to authenticated, service_role;
grant execute on function public.spawn_vtt_enemy(uuid,uuid,double precision,double precision) to authenticated, service_role;
grant execute on function public.list_vtt_scene_tokens(uuid) to authenticated, service_role;
grant execute on function public.can_manage_vtt_enemy_object(text) to authenticated, service_role;
grant execute on function public.can_read_vtt_enemy_model_object(text) to authenticated, service_role;
grant execute on function public.can_read_vtt_enemy_paint_object(text) to authenticated, service_role;
grant execute on function public.vtt_storage_campaign_id(text) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vtt_tokens'
  ) then
    alter publication supabase_realtime add table public.vtt_tokens;
  end if;
end $$;

commit;
