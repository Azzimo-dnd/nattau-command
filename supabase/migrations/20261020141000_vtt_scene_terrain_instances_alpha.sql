-- Terrain Placement Alpha: GM-only scene objects. No player access until fog-of-war review.
begin;

create table public.vtt_scene_terrain_instances (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid not null references public.vtt_scenes(id) on delete cascade,
  terrain_asset_id uuid not null references public.vtt_terrain_assets(id) on delete restrict,
  position_x double precision not null check (position_x between -500 and 500),
  position_z double precision not null check (position_z between -500 and 500),
  rotation_y double precision not null default 0 check (rotation_y >= 0 and rotation_y < 6.283185307179587),
  scale double precision not null default 1 check (scale between 0.1 and 10),
  visible_to_players boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vtt_scene_terrain_scene_idx on public.vtt_scene_terrain_instances(scene_id,created_at);
create index vtt_scene_terrain_asset_idx on public.vtt_scene_terrain_instances(terrain_asset_id);

create function public.vtt_terrain_instance_validate()
returns trigger language plpgsql set search_path = '' as $$
declare
  scene_width integer;
  scene_height integer;
begin
  select s.grid_width, s.grid_height into scene_width, scene_height
  from public.vtt_scenes s
  where s.id = new.scene_id and s.campaign_id = new.campaign_id;
  if not found then raise exception 'Terrain scene does not belong to this campaign'; end if;
  if not exists(select 1 from public.vtt_terrain_assets a
                where a.id = new.terrain_asset_id and a.campaign_id = new.campaign_id and a.status <> 'archived') then
    raise exception 'Terrain asset is unavailable for this campaign';
  end if;
  if new.position_x < -scene_width / 2.0 or new.position_x > scene_width / 2.0
    or new.position_z < -scene_height / 2.0 or new.position_z > scene_height / 2.0 then
    raise exception 'Terrain position is outside the scene';
  end if;
  if tg_op = 'UPDATE' then
    if new.campaign_id is distinct from old.campaign_id
       or new.scene_id is distinct from old.scene_id
       or new.terrain_asset_id is distinct from old.terrain_asset_id
       or new.created_by is distinct from old.created_by then
      raise exception 'Terrain scene, asset, and owner cannot change';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger vtt_terrain_instance_validate_trigger
before insert or update on public.vtt_scene_terrain_instances
for each row execute function public.vtt_terrain_instance_validate();

alter table public.vtt_scene_terrain_instances enable row level security;
revoke all on public.vtt_scene_terrain_instances from anon;
grant select,insert,update,delete on public.vtt_scene_terrain_instances to authenticated,service_role;

create policy "GM can read terrain in their campaign" on public.vtt_scene_terrain_instances
for select to authenticated using (public.is_campaign_dm(campaign_id));
create policy "GM can place terrain in their campaign" on public.vtt_scene_terrain_instances
for insert to authenticated with check (public.is_campaign_dm(campaign_id) and created_by = (select auth.uid()));
create policy "GM can edit terrain in their campaign" on public.vtt_scene_terrain_instances
for update to authenticated using (public.is_campaign_dm(campaign_id))
with check (public.is_campaign_dm(campaign_id));
create policy "GM can remove terrain in their campaign" on public.vtt_scene_terrain_instances
for delete to authenticated using (public.is_campaign_dm(campaign_id));
-- Player SELECT and model bucket policy deliberately not added in Alpha.
commit;
