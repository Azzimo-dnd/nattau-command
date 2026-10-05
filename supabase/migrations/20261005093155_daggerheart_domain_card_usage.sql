-- A narrow shared-deck projection. Full sheets remain owner/GM-only under RLS.
-- The definer is private; the exposed wrapper runs as the caller.
begin;
create or replace function private.daggerheart_domain_card_usage(p_campaign_id uuid)
returns table (
  character_id uuid, character_name text, player_name text,
  compendium_id text, slug text, source_key text, name text, domain text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_daggerheart_campaign_member(p_campaign_id) then
    raise exception 'Active Daggerheart campaign membership required' using errcode = '42501';
  end if;
  return query
  select distinct dc.id,
    coalesce(nullif(btrim(dc.name), ''), 'Unnamed wanderer'),
    private.campaign_display_name(p_campaign_id, dc.player_id, 'Unknown wanderer'),
    nullif(card->>'compendium_id', ''), nullif(card->>'slug', ''),
    nullif(card->>'source_key', ''), card->>'name', card->>'domain'
  from public.daggerheart_characters dc
  join public.campaign_members cm on cm.campaign_id = dc.campaign_id
    and cm.user_id = dc.player_id and cm.is_active = true and cm.role = 'player'
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(dc.domain_cards) = 'array' then dc.domain_cards else '[]'::jsonb end
  ) card
  where dc.campaign_id = p_campaign_id and dc.is_active = true
    and nullif(btrim(card->>'name'), '') is not null;
end;
$$;
revoke all on function private.daggerheart_domain_card_usage(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.daggerheart_domain_card_usage(uuid) to authenticated;

create or replace function public.list_daggerheart_domain_card_usage(p_campaign_id uuid)
returns table (
  character_id uuid, character_name text, player_name text,
  compendium_id text, slug text, source_key text, name text, domain text
)
language sql stable security invoker set search_path = '' as $$
  select * from private.daggerheart_domain_card_usage(p_campaign_id);
$$;
revoke all on function public.list_daggerheart_domain_card_usage(uuid) from public, anon;
grant execute on function public.list_daggerheart_domain_card_usage(uuid) to authenticated;
commit;
