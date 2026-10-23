-- Register Kevin's new special force in the Nattau campaign only.
-- Keep all existing units, edits and strategic-map positions unchanged.
-- Safe to run repeatedly: never overwrite a manually edited roster profile.
begin;
insert into public.campaign_strategic_special_units
 (campaign_id, unit_key, status, mission, location_note,
  gm_notes, pos_x, pos_y, visible_to_players, unit_profile)
select c.id, 'vengeful-thirteen', 'Ready', '', '',
 'Formed in the aftermath of the Imperial siege of UĆ. Kevin was restored by Mother Tyllen through the power of Nithis and now leads twelve of the settlement''s finest warriors.',
 null, null, false,
 jsonb_build_object(
  'name','The Vengeful Thirteen',
  'commander','Kevin — Avenger of Nithis',
  'size','13 warriors (Kevin + 12 veterans)',
  'cost',jsonb_build_object('type','resource','resource','RP','options',jsonb_build_array(jsonb_build_object('amount',0))),
  'theme','standard',
  'detail','An elite, thirteen-strong strike unit formed from Kevin and twelve of UĆ''s finest survivors. Restored to life by Mother Tyllen through the power of Nithis, Kevin trained these warriors in brutal, dirty fighting and swift elimination of priority targets. They wear captured Imperial armor and weapons, reforged with the guidance of the master artificer. No upkeep cost.',
  'durability',jsonb_build_object('type','finite','current',2,'max',2),
  'headquarters',jsonb_build_object('state','unavailable','reason','Newly formed in UĆ; no dedicated headquarters.'),
  'members',jsonb_build_array('Kevin — commander; twelve unnamed veterans')
 )
from public.campaigns c
where c.slug='nattau'
on conflict (campaign_id,unit_key) do nothing;
commit;
