-- Make the scene-to-campaign comparison explicit in the player SELECT policy.
-- Prevent SQL name resolution from turning it into an always-true self-comparison.
begin;
alter policy "VTT spell areas players see revealed"
on public.vtt_spell_areas
using (
  visible_to_players
  and public.is_campaign_member(vtt_spell_areas.campaign_id)
  and exists (
    select 1 from public.vtt_scenes s
    where s.id = vtt_spell_areas.scene_id
      and s.campaign_id = vtt_spell_areas.campaign_id
      and s.is_active
      and s.visible_to_players
  )
  and public.is_vtt_point_revealed(
    vtt_spell_areas.scene_id,
    vtt_spell_areas.center_x,
    vtt_spell_areas.center_z
  )
);
commit;
