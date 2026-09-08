-- Nattau VTT Alpha v0.4 — prepared-scene map/grid calibration
-- This migration is committed to the VTT feature branch only. Do not apply it to production until v0.4 is approved.
begin;

alter table public.vtt_scenes
  add column if not exists map_scale double precision not null default 1,
  add column if not exists map_offset_x double precision not null default 0,
  add column if not exists map_offset_z double precision not null default 0;

alter table public.vtt_scenes
  drop constraint if exists vtt_scenes_map_scale_chk,
  add constraint vtt_scenes_map_scale_chk check (map_scale between 0.25 and 4),
  drop constraint if exists vtt_scenes_map_offset_x_chk,
  add constraint vtt_scenes_map_offset_x_chk check (map_offset_x between -100 and 100),
  drop constraint if exists vtt_scenes_map_offset_z_chk,
  add constraint vtt_scenes_map_offset_z_chk check (map_offset_z between -100 and 100);

commit;
