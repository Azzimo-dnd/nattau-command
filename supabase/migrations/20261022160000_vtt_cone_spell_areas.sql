-- Extend the existing VTT persistent spell circles with D&D 5e cone templates.
-- Additive only: all previously placed regions remain circles.
begin;
alter table public.vtt_spell_areas
 add column if not exists shape_type text not null default 'circle',
 add column if not exists direction_rad double precision not null default 0;

alter table public.vtt_spell_areas
 add constraint vtt_spell_area_shape_type_valid
 check (shape_type in ('circle','cone'));

alter table public.vtt_spell_areas
 add constraint vtt_spell_area_direction_valid
 check (direction_rad between -pi() and pi());

comment on column public.vtt_spell_areas.shape_type is
 'circle: radius represents circle radius; cone: radius represents cone length (5e base width equals length)';
comment on column public.vtt_spell_areas.direction_rad is
 'Cone direction measured counterclockwise in the world map x,z plane: atan2(delta_z,delta_x); circles use 0';
commit;
