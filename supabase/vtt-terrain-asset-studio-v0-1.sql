-- Terrain Asset Studio Alpha: independent GM-only library. No scene placement.
-- Run on a Supabase development branch before enabling persistence in a preview.
begin;

create table if not exists public.vtt_terrain_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null check (category in ('cargo','cover','wreckage','nature','structures','scatter')),
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  source_kind text not null check (source_kind in ('generated','uploaded')),
  storage_path text not null unique,
  original_name text not null check (char_length(trim(original_name)) between 1 and 180),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 78643200),
  mesh_count integer not null check (mesh_count between 1 and 100000),
  triangle_count integer not null check (triangle_count between 1 and 2000000),
  width_units double precision not null check (width_units > 0 and width_units <= 1000),
  height_units double precision not null check (height_units > 0 and height_units <= 1000),
  depth_units double precision not null check (depth_units > 0 and depth_units <= 1000),
  default_scale double precision not null default 1 check (default_scale between 0.1 and 10),
  has_textures boolean not null default false,
  pivot_mode text not null default 'centered_base' check (pivot_mode = 'centered_base'),
  generator_recipe jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terrain_asset_storage_key check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.glb$'
    and split_part(storage_path,'/',1) = campaign_id::text
  ),
  constraint terrain_recipe_source check (
    (source_kind = 'uploaded' and generator_recipe is null)
    or (source_kind = 'generated' and generator_recipe is not null and jsonb_typeof(generator_recipe) = 'object')
  )
);
create index if not exists vtt_terrain_assets_campaign_idx on public.vtt_terrain_assets(campaign_id,category,status,created_at desc);

create or replace function public.vtt_terrain_guard_immutable_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.campaign_id is distinct from old.campaign_id
    or new.storage_path is distinct from old.storage_path
    or new.created_by is distinct from old.created_by
    or new.source_kind is distinct from old.source_kind
    or new.generator_recipe is distinct from old.generator_recipe then
    raise exception 'Terrain identity and source are immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists vtt_terrain_guard_update on public.vtt_terrain_assets;
create trigger vtt_terrain_guard_update before update on public.vtt_terrain_assets
for each row execute function public.vtt_terrain_guard_immutable_fields();

alter table public.vtt_terrain_assets enable row level security;
revoke all on public.vtt_terrain_assets from anon;
grant select,insert,update,delete on public.vtt_terrain_assets to authenticated, service_role;

drop policy if exists "Terrain GM read" on public.vtt_terrain_assets;
create policy "Terrain GM read" on public.vtt_terrain_assets for select to authenticated
using (public.is_campaign_dm(campaign_id));
drop policy if exists "Terrain GM insert" on public.vtt_terrain_assets;
create policy "Terrain GM insert" on public.vtt_terrain_assets for insert to authenticated
with check (public.is_campaign_dm(campaign_id) and created_by = (select auth.uid()));
drop policy if exists "Terrain GM update" on public.vtt_terrain_assets;
create policy "Terrain GM update" on public.vtt_terrain_assets for update to authenticated
using (public.is_campaign_dm(campaign_id)) with check (public.is_campaign_dm(campaign_id));
drop policy if exists "Terrain GM delete" on public.vtt_terrain_assets;
create policy "Terrain GM delete" on public.vtt_terrain_assets for delete to authenticated
using (public.is_campaign_dm(campaign_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('vtt-terrain-assets','vtt-terrain-assets',false,78643200,array['model/gltf-binary','application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Safe conversion for malformed object paths; callers never cast arbitrary path parts.
create or replace function public.vtt_terrain_path_campaign(object_name text)
returns uuid language sql stable set search_path = '' as $$
 select case when pg_catalog.pg_input_is_valid(split_part(object_name,'/',1), 'uuid')
 then split_part(object_name,'/',1)::uuid else null::uuid end
$$;
revoke all on function public.vtt_terrain_path_campaign(text) from public;
grant execute on function public.vtt_terrain_path_campaign(text) to authenticated, service_role;

drop policy if exists "Terrain files GM read" on storage.objects;
create policy "Terrain files GM read" on storage.objects for select to authenticated
using (bucket_id = 'vtt-terrain-assets' and public.is_campaign_dm(public.vtt_terrain_path_campaign(name)));
drop policy if exists "Terrain files GM create" on storage.objects;
create policy "Terrain files GM create" on storage.objects for insert to authenticated
with check (
 bucket_id = 'vtt-terrain-assets'
 and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.glb$'
 and public.is_campaign_dm(public.vtt_terrain_path_campaign(name))
);
drop policy if exists "Terrain files GM delete" on storage.objects;
create policy "Terrain files GM delete" on storage.objects for delete to authenticated
using (bucket_id = 'vtt-terrain-assets' and public.is_campaign_dm(public.vtt_terrain_path_campaign(name)));
-- Deliberately no UPDATE / player-read policy. Future scene exposure needs its own audited policy.
commit;
