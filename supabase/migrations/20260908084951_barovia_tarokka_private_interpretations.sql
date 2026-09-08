-- GM-authored interpretations may contain future story details. Keep them out
-- of the player catalogue, including direct PostgREST requests.
create or replace function public.list_tarokka_deck(p_campaign_id uuid)
returns setof public.tarokka_cards language plpgsql security definer set search_path = '' as $$
declare v_role text; v_card public.tarokka_cards%rowtype;
begin
  v_role := public.tarokka_assert_access(p_campaign_id);
  for v_card in select * from public.tarokka_cards
    where campaign_id = p_campaign_id and deck_key = 'high' and (is_active or v_role = 'dm')
    order by sort_order, id
  loop
    if v_role <> 'dm' then
      v_card.prophecy_upright := '';
      v_card.prophecy_reversed := '';
    end if;
    return next v_card;
  end loop;
end;
$$;
revoke all on function public.list_tarokka_deck(uuid) from public, anon, authenticated;
grant execute on function public.list_tarokka_deck(uuid) to authenticated;
revoke select on public.tarokka_cards from authenticated;
grant select (id, campaign_id, slug, card_number, name, subtitle, meaning,
  upright_title, upright_description, reversed_title, reversed_description,
  sigil, art_key, sort_order, is_active, deck_key, revision, created_at, updated_at)
  on public.tarokka_cards to authenticated;

-- Realtime must not send full card rows, which include the private text.
-- Edits already create a GM-only tarokka_events entry; players refresh the
-- public catalogue on returning to its tab, reconnecting, or using Refresh.
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'tarokka_cards') then
    alter publication supabase_realtime drop table public.tarokka_cards;
  end if;
end;
$$;
notify pgrst, 'reload schema';
