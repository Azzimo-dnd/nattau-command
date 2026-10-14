-- The War Room and Strategic Map share campaign_strategic_special_units.
-- War Room exposes roster status for all known special units, as it did before
-- the map existed. Missions remain private unless their map marker is published.
-- No positions, private notes or visibility flags are exposed in this projection.
create or replace function public.get_campaign_special_unit_roster(p_campaign_id uuid)
returns table (
  unit_key text,
  status text,
  mission text,
  updated_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select u.unit_key, u.status,
         case when u.visible_to_players then u.mission else null::text end as mission,
         u.updated_at
  from public.campaign_strategic_special_units u
  where u.campaign_id = p_campaign_id
    and auth.uid() is not null
    and public.is_campaign_member(p_campaign_id)
  order by u.unit_key;
$$;
revoke all on function public.get_campaign_special_unit_roster(uuid) from public, anon;
grant execute on function public.get_campaign_special_unit_roster(uuid) to authenticated, service_role;
