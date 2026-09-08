-- Nattau VTT Alpha v0.1.2 — private active-scene battle maps and presentation settings
begin;

alter table public.vtt_scenes
  add column if not exists map_storage_path text,
  add column if not exists map_original_name text,
  add column if not exists map_opacity double precision not null default 1,
  add column if not exists grid_opacity double precision not null default 0.78,
  add column if not exists show_grid boolean not null default true;

alter table public.vtt_scenes
  drop constraint if exists vtt_scenes_map_opacity_chk,
  add constraint vtt_scenes_map_opacity_chk check (map_opacity between 0 and 1),
  drop constraint if exists vtt_scenes_grid_opacity_chk,
  add constraint vtt_scenes_grid_opacity_chk check (grid_opacity between 0 and 1),
  drop constraint if exists vtt_scenes_map_original_name_chk,
  add constraint vtt_scenes_map_original_name_chk check (map_original_name is null or char_length(trim(map_original_name)) between 1 and 240);

create unique index if not exists vtt_scenes_map_storage_path_idx
  on public.vtt_scenes(map_storage_path) where map_storage_path is not null;

insert into storage.buckets (id, name, public, file_size_limit)
values ('vtt-maps', 'vtt-maps', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Players may discover only the active scene. This prevents future prepared-scene metadata
-- (including map filenames) from becoming a spoiler through direct table reads.
drop policy if exists "VTT scene campaign read" on public.vtt_scenes;
create policy "VTT scene campaign read" on public.vtt_scenes for select to authenticated
using (
  public.is_campaign_dm(campaign_id)
  or (is_active = true and public.is_campaign_member(campaign_id))
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
      and s.map_storage_path = object_name
  );
end;
$$;

revoke all on function public.can_read_vtt_map_object(text) from public, anon;
grant execute on function public.can_read_vtt_map_object(text) to authenticated, service_role;

drop policy if exists "VTT map read" on storage.objects;
create policy "VTT map read" on storage.objects for select to authenticated
using (
  bucket_id = 'vtt-maps'
  and (public.can_manage_vtt_enemy_object(name) or public.can_read_vtt_map_object(name))
);

drop policy if exists "VTT map upload" on storage.objects;
create policy "VTT map upload" on storage.objects for insert to authenticated
with check (
  bucket_id = 'vtt-maps'
  and public.can_manage_vtt_enemy_object(name)
);

drop policy if exists "VTT map update" on storage.objects;
create policy "VTT map update" on storage.objects for update to authenticated
using (
  bucket_id = 'vtt-maps'
  and public.can_manage_vtt_enemy_object(name)
)
with check (
  bucket_id = 'vtt-maps'
  and public.can_manage_vtt_enemy_object(name)
);

drop policy if exists "VTT map delete" on storage.objects;
create policy "VTT map delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'vtt-maps'
  and public.can_manage_vtt_enemy_object(name)
);

commit;
