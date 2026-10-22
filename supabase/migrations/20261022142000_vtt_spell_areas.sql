-- Persistent spell / hazard circles for VTT. Player visibility is gated by fog and scene permissions.
begin;
create table if not exists public.vtt_spell_areas (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 scene_id uuid not null references public.vtt_scenes(id) on delete cascade,
 label text not null check (char_length(btrim(label)) between 1 and 80),
 color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
 center_x double precision not null check (center_x between -1000 and 1000),
 center_z double precision not null check (center_z between -1000 and 1000),
 radius double precision not null check (radius >= 0.1 and radius <= 100),
 visible_to_players boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists vtt_spell_areas_scene_idx on public.vtt_spell_areas(scene_id,created_at);
create or replace function public.vtt_spell_area_validate()
returns trigger language plpgsql set search_path='' as $$
declare w integer;h integer;
begin
 select s.grid_width,s.grid_height into w,h from public.vtt_scenes s
 where s.id=new.scene_id and s.campaign_id=new.campaign_id;
 if not found then raise exception 'Area scene does not belong to this campaign';end if;
 if new.center_x < -w/2.0 or new.center_x > w/2.0
 or new.center_z < -h/2.0 or new.center_z > h/2.0
 or new.radius > greatest(w,h) then
   raise exception 'Spell area exceeds valid scene coordinates';
 end if;
 if tg_op='UPDATE' and (new.campaign_id is distinct from old.campaign_id
 or new.scene_id is distinct from old.scene_id or new.created_by is distinct from old.created_by)
 then raise exception 'Cannot reassign spell area to another scene or creator';end if;
 new.updated_at=now();
 return new;
end;
$$;
drop trigger if exists vtt_spell_area_validate_trg on public.vtt_spell_areas;
create trigger vtt_spell_area_validate_trg before insert or update on public.vtt_spell_areas
for each row execute function public.vtt_spell_area_validate();
alter table public.vtt_spell_areas enable row level security;
revoke all on public.vtt_spell_areas from anon;
grant select,insert,update,delete on public.vtt_spell_areas to authenticated;
grant select,insert,update,delete on public.vtt_spell_areas to service_role;
create policy "VTT spell areas GM read" on public.vtt_spell_areas
for select to authenticated using (public.is_campaign_dm(campaign_id));
create policy "VTT spell areas players see revealed" on public.vtt_spell_areas
for select to authenticated using (
  visible_to_players and public.is_campaign_member(campaign_id)
  and exists(select 1 from public.vtt_scenes s
    where s.id=scene_id and s.campaign_id=campaign_id
    and s.is_active and s.visible_to_players)
  and public.is_vtt_point_revealed(scene_id,center_x,center_z)
);
create policy "VTT spell areas GM create" on public.vtt_spell_areas
for insert to authenticated with check
(public.is_campaign_dm(campaign_id) and created_by=(select auth.uid()));
create policy "VTT spell areas GM update" on public.vtt_spell_areas
for update to authenticated using(public.is_campaign_dm(campaign_id))
with check(public.is_campaign_dm(campaign_id));
create policy "VTT spell areas GM delete" on public.vtt_spell_areas
for delete to authenticated using(public.is_campaign_dm(campaign_id));
commit;
