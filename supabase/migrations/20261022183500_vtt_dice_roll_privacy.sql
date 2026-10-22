-- Preserve secret GM rolls permanently, even if a hidden VTT scene is published later.
-- Legacy entries are deliberately private: no reliable historic public/private flag exists.
begin;
alter table public.vtt_dice_rolls
  add column if not exists visible_to_players boolean not null default false;

-- The creator controls sharing for GM rolls; players can only record public rolls.
-- This trigger executes with the existing definer privileges and never trusts
-- roller_id / roller_name supplied by a client.
create or replace function public.prepare_vtt_dice_roll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_campaign_id uuid;
  v_scene_active boolean;
  v_scene_visible boolean;
  v_display_name text;
  v_is_gm boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select s.campaign_id,s.is_active,s.visible_to_players
    into v_campaign_id,v_scene_active,v_scene_visible
    from public.vtt_scenes s where s.id=new.scene_id;
  if v_campaign_id is null then raise exception 'VTT scene not found'; end if;

  v_is_gm := public.is_campaign_dm(v_campaign_id);
  if not v_is_gm then
    if not v_scene_active or not v_scene_visible or not public.is_campaign_member(v_campaign_id)
    then raise exception 'VTT scene is not available to this campaign member'; end if;
    -- Players have no GM-secret mode.
    if not new.visible_to_players then raise exception 'Only GM can roll privately'; end if;
  end if;

  select nullif(trim(p.display_name),'') into v_display_name
    from public.profiles p where p.id=v_user_id;
  new.roller_id:=v_user_id;
  new.roller_name:=coalesce(v_display_name,'Campaign member');
  new.created_at:=now();
  new.details:=coalesce(new.details,'{}'::jsonb);
  if not v_scene_active or not v_scene_visible then new.visible_to_players:=false; end if;
  return new;
end;
$$;

drop policy if exists "VTT dice scene read" on public.vtt_dice_rolls;
create policy "VTT dice scene read"
on public.vtt_dice_rolls
for select to authenticated
using(
 exists(
   select 1 from public.vtt_scenes s
   where s.id=vtt_dice_rolls.scene_id
     and (
       public.is_campaign_dm(s.campaign_id)
       or (
         vtt_dice_rolls.visible_to_players
         and s.is_active and s.visible_to_players
         and public.is_campaign_member(s.campaign_id)
       )
     )
 )
);

-- Keep INSERT policy in step with scene visibility and let GMs save secret rolls.
drop policy if exists "VTT dice scene insert" on public.vtt_dice_rolls;
create policy "VTT dice scene insert"
on public.vtt_dice_rolls
for insert to authenticated
with check (
 roller_id=(select auth.uid()) and exists(
   select 1 from public.vtt_scenes s
   where s.id=vtt_dice_rolls.scene_id and (
     public.is_campaign_dm(s.campaign_id)
     or (
       vtt_dice_rolls.visible_to_players
       and s.is_active and s.visible_to_players
       and public.is_campaign_member(s.campaign_id)
     )
   )
 )
);
commit;
