-- Barovia's High Deck. Existing draw snapshots and cycle IDs are preserved.
-- Personal omens are campaign homebrew; grand readings grant no mechanical boon.
alter table public.tarokka_cards
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade,
  add column if not exists deck_key text not null default 'legacy',
  add column if not exists revision integer not null default 1,
  add column if not exists prophecy_upright text not null default '',
  add column if not exists prophecy_reversed text not null default '';
update public.tarokka_cards set campaign_id = (select id from public.campaigns where slug = 'barovia')
where campaign_id is null;
alter table public.tarokka_cards alter column campaign_id set not null;
create index if not exists tarokka_cards_campaign_deck_idx on public.tarokka_cards(campaign_id, deck_key, is_active);

alter table public.tarokka_cycles add column if not exists draws_open boolean not null default true;
alter table public.tarokka_draws
  add column if not exists used_at timestamptz,
  add column if not exists used_by uuid references auth.users(id) on delete set null,
  add column if not exists use_note text not null default '',
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text not null default '';
alter table public.tarokka_draws drop constraint if exists tarokka_draws_cycle_id_player_id_key;
create unique index if not exists tarokka_one_current_omen_idx
  on public.tarokka_draws(cycle_id, player_id) where voided_at is null;

create table if not exists public.tarokka_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  draw_id uuid references public.tarokka_draws(id) on delete set null,
  card_id smallint references public.tarokka_cards(id) on delete set null,
  kind text not null,
  note text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tarokka_events_campaign_time_idx on public.tarokka_events(campaign_id, created_at desc);
alter table public.tarokka_events enable row level security;
-- Hidden card identities and orientations are readable only inside the RPCs.
alter table public.tarokka_draw_offers enable row level security;

-- All mutations take the campaign lock before any row lock. This also serializes
-- claiming, closing a cycle, returning an omen, and changing the active pool.
create or replace function public.tarokka_assert_access(p_campaign_id uuid, p_role text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'Sign in to consult the deck.'; end if;
  select cm.role into v_role from public.campaign_members cm
  join public.campaigns c on c.id = cm.campaign_id
  where cm.campaign_id = p_campaign_id and cm.user_id = auth.uid()
    and cm.is_active and c.slug = 'barovia';
  if v_role is null or (p_role is not null and v_role <> p_role) then
    raise exception 'You do not have access to this Barovia action.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_campaign_id::text, 817));
  return v_role;
end;
$$;

create or replace function public.tarokka_record_event(
  p_campaign_id uuid, p_kind text, p_note text default '',
  p_draw_id uuid default null, p_card_id smallint default null, p_details jsonb default '{}'
) returns void language sql security definer set search_path = '' as $$
  insert into public.tarokka_events(campaign_id, actor_id, kind, note, draw_id, card_id, details)
  values (p_campaign_id, auth.uid(), p_kind, left(coalesce(p_note, ''), 500), p_draw_id, p_card_id, p_details);
$$;

create or replace function public.set_tarokka_effect_used(p_draw_id uuid, p_used boolean, p_note text default '')
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_draw public.tarokka_draws%rowtype; v_role text;
begin
  select * into v_draw from public.tarokka_draws where id = p_draw_id;
  if not found then raise exception 'Omen not found.'; end if;
  v_role := public.tarokka_assert_access(v_draw.campaign_id);
  select * into v_draw from public.tarokka_draws where id = p_draw_id for update;
  if p_used is null then raise exception 'Choose an omen state.'; end if;
  if v_role <> 'dm' and (v_draw.player_id <> auth.uid() or v_role <> 'player' or not p_used) then
    raise exception 'Only the owner can spend an omen; only the GM can restore it.';
  end if;
  if v_draw.voided_at is not null or v_draw.revealed_at is null or not exists (
    select 1 from public.tarokka_cycles where id = v_draw.cycle_id and is_active
  ) then raise exception 'Only a revealed omen in the active cycle can be used or restored.'; end if;
  if (v_draw.used_at is not null) = p_used then return true; end if;
  if not p_used and nullif(trim(p_note), '') is null then raise exception 'Give a reason for restoring the omen.'; end if;
  if length(p_note) > 500 then raise exception 'Keep the note within 500 characters.'; end if;
  update public.tarokka_draws set used_at = case when p_used then now() else null end,
    used_by = case when p_used then auth.uid() else null end, use_note = coalesce(trim(p_note), '')
    where id = p_draw_id;
  perform public.tarokka_record_event(v_draw.campaign_id, case when p_used then 'omen_used' else 'omen_restored' end,
    p_note, p_draw_id);
  return true;
end;
$$;

create or replace function public.reset_tarokka_player_draw(p_campaign_id uuid, p_player_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_cycle_id uuid; v_draw_id uuid;
begin
  perform public.tarokka_assert_access(p_campaign_id, 'dm');
  if nullif(trim(p_reason), '') is null or length(p_reason) > 500 then
    raise exception 'Give a reason of 1–500 characters for returning the omen.';
  end if;
  select id into v_cycle_id from public.tarokka_cycles where campaign_id = p_campaign_id and is_active;
  update public.tarokka_draws set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
    where cycle_id = v_cycle_id and player_id = p_player_id and voided_at is null returning id into v_draw_id;
  delete from public.tarokka_draw_offers where cycle_id = v_cycle_id and player_id = p_player_id;
  if v_draw_id is not null then perform public.tarokka_record_event(p_campaign_id, 'omen_returned', p_reason, v_draw_id); end if;
  return true;
end;
$$;
create or replace function public.reset_tarokka_player_draw(p_campaign_id uuid, p_player_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select public.reset_tarokka_player_draw(p_campaign_id, p_player_id, 'Returned by the GM');
$$;

-- A stale session desk must never return a different, newer omen.
create or replace function public.reset_tarokka_player_draw(p_campaign_id uuid, p_player_id uuid, p_reason text, p_expected_draw_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_current uuid;
begin
  perform public.tarokka_assert_access(p_campaign_id, 'dm');
  select d.id into v_current from public.tarokka_draws d join public.tarokka_cycles c on c.id = d.cycle_id
    where c.campaign_id = p_campaign_id and c.is_active and d.player_id = p_player_id and d.voided_at is null;
  if p_expected_draw_id is null then raise exception 'Choose the omen to return.'; end if;
  if v_current is distinct from p_expected_draw_id then
    if v_current is null and exists (select 1 from public.tarokka_draws where id = p_expected_draw_id
      and campaign_id = p_campaign_id and player_id = p_player_id and voided_at is not null) then return true; end if;
    raise exception 'The held omen changed. Refresh before returning a card.';
  end if;
  return public.reset_tarokka_player_draw(p_campaign_id, p_player_id, p_reason);
end;
$$;

create or replace function public.set_tarokka_draws_open(p_campaign_id uuid, p_cycle_id uuid, p_open boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform public.tarokka_assert_access(p_campaign_id, 'dm');
  if p_open is null then raise exception 'Choose whether drawing is open.'; end if;
  update public.tarokka_cycles set draws_open = p_open where id = p_cycle_id and campaign_id = p_campaign_id and is_active;
  if not found then raise exception 'The cycle changed. Refresh the session desk.'; end if;
  perform public.tarokka_record_event(p_campaign_id, case when p_open then 'drawing_opened' else 'drawing_paused' end);
  return true;
end;
$$;

create or replace function public.save_tarokka_card(
  p_campaign_id uuid, p_card_id smallint, p_patch jsonb, p_expected_revision integer
) returns public.tarokka_cards language plpgsql security definer set search_path = '' as $$
declare v_card public.tarokka_cards%rowtype; v_key text; v_value text;
begin
  perform public.tarokka_assert_access(p_campaign_id, 'dm');
  select * into v_card from public.tarokka_cards where id = p_card_id and campaign_id = p_campaign_id and deck_key = 'high' for update;
  if not found then raise exception 'High Deck card not found.'; end if;
  if p_expected_revision is distinct from v_card.revision then raise exception 'This card changed in another window. Refresh before saving.'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then raise exception 'Provide card text to save.'; end if;
  for v_key, v_value in select key, value from jsonb_each_text(p_patch) loop
    if v_key not in ('subtitle','meaning','upright_title','upright_description','reversed_title','reversed_description','prophecy_upright','prophecy_reversed') then
      raise exception 'This card field cannot be edited.';
    end if;
    if jsonb_typeof(p_patch -> v_key) <> 'string' or nullif(trim(v_value), '') is null
      or length(v_value) > (case when v_key in ('subtitle','upright_title','reversed_title') then 100 else 2000 end) then
      raise exception 'Card text must be complete; titles allow 100 characters and descriptions 2000.';
    end if;
    p_patch := jsonb_set(p_patch, array[v_key], to_jsonb(trim(v_value)));
  end loop;
  update public.tarokka_cards set
    subtitle = coalesce(p_patch->>'subtitle', subtitle), meaning = coalesce(p_patch->>'meaning', meaning),
    upright_title = coalesce(p_patch->>'upright_title', upright_title), upright_description = coalesce(p_patch->>'upright_description', upright_description),
    reversed_title = coalesce(p_patch->>'reversed_title', reversed_title), reversed_description = coalesce(p_patch->>'reversed_description', reversed_description),
    prophecy_upright = coalesce(p_patch->>'prophecy_upright', prophecy_upright), prophecy_reversed = coalesce(p_patch->>'prophecy_reversed', prophecy_reversed),
    revision = revision + 1, updated_at = now() where id = p_card_id returning * into v_card;
  perform public.tarokka_record_event(p_campaign_id, 'card_edited', v_card.name, null, p_card_id,
    jsonb_build_object('revision', v_card.revision, 'fields', (select jsonb_agg(key) from jsonb_object_keys(p_patch) key)));
  return v_card;
end;
$$;

create or replace function public.set_tarokka_card_active(
  p_campaign_id uuid, p_card_id smallint, p_active boolean, p_expected_revision integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_card public.tarokka_cards%rowtype;
begin
  perform public.tarokka_assert_access(p_campaign_id, 'dm');
  select * into v_card from public.tarokka_cards where id = p_card_id and campaign_id = p_campaign_id and deck_key = 'high' for update;
  if not found then raise exception 'High Deck card not found.'; end if;
  if p_expected_revision is distinct from v_card.revision then raise exception 'This card changed. Refresh before editing the deck.'; end if;
  if p_active is null then raise exception 'Choose an active state.'; end if;
  if v_card.is_active = p_active then return true; end if;
  if not p_active and (select count(*) from public.tarokka_cards where campaign_id = p_campaign_id and deck_key = 'high' and is_active) <= 5 then
    raise exception 'Keep at least five cards active for the Grand Reading.';
  end if;
  update public.tarokka_cards set is_active = p_active, revision = revision + 1, updated_at = now() where id = p_card_id;
  perform public.tarokka_record_event(p_campaign_id, case when p_active then 'card_enabled' else 'card_disabled' end, v_card.name, null, p_card_id);
  return true;
end;
$$;


CREATE OR REPLACE FUNCTION public.get_or_create_tarokka_offer(p_campaign_id uuid)
 RETURNS TABLE(offer_id uuid, cycle_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_cycle public.tarokka_cycles%rowtype;
  v_offer public.tarokka_draw_offers%rowtype;
  v_card_ids smallint[];
  v_flags boolean[];
begin
  perform public.tarokka_assert_access(p_campaign_id, 'player');
  if v_user_id is null then
    raise exception 'You must be signed in to draw from the Mists.';
  end if;

  select cm.role into v_role
  from public.campaign_members cm
  where cm.campaign_id = p_campaign_id
    and cm.user_id = v_user_id
    and cm.is_active = true;

  if v_role is distinct from 'player' then
    raise exception 'Only player members may draw a Personal Omen.';
  end if;

  select * into v_cycle
  from public.tarokka_cycles
  where campaign_id = p_campaign_id and is_active = true
  order by cycle_number desc
  limit 1;

  if not found then
    raise exception 'No Turning of the Mists is currently active.';
  end if;

  if not v_cycle.draws_open then raise exception 'Drawing is paused by the GM.'; end if;

  if exists (
    select 1 from public.tarokka_draws td
    where td.cycle_id = v_cycle.id and td.player_id = v_user_id and td.voided_at is null
  ) then
    raise exception 'You have already drawn an omen during this cycle.';
  end if;

  select * into v_offer
  from public.tarokka_draw_offers tdo
  where tdo.cycle_id = v_cycle.id and tdo.player_id = v_user_id
  for update;

  if found and v_offer.claimed_at is null and v_offer.expires_at > now() and
    (select count(*) from public.tarokka_cards where id = any(v_offer.card_ids) and campaign_id = p_campaign_id and deck_key = 'high' and is_active) = 3 then
    return query select v_offer.id, v_offer.cycle_id, v_offer.expires_at;
    return;
  end if;

  select array_agg(x.id order by x.random_order)
  into v_card_ids
  from (
    select id, random() as random_order
    from public.tarokka_cards
    where is_active = true and campaign_id = p_campaign_id and deck_key = 'high'
    order by random_order
    limit 3
  ) x;

  if coalesce(array_length(v_card_ids, 1), 0) < 3 then
    raise exception 'At least three active Tarokka cards are required.';
  end if;

  v_flags := array[random() < 0.5, random() < 0.5, random() < 0.5];

  if v_offer.id is null then
    insert into public.tarokka_draw_offers (
      campaign_id, cycle_id, player_id, card_ids, reversed_flags, expires_at
    ) values (
      p_campaign_id, v_cycle.id, v_user_id, v_card_ids, v_flags, now() + interval '30 minutes'
    ) returning * into v_offer;
  else
    update public.tarokka_draw_offers
    set id = gen_random_uuid(), card_ids = v_card_ids,
        reversed_flags = v_flags,
        created_at = now(),
        expires_at = now() + interval '30 minutes',
        claimed_at = null,
        chosen_slot = null
    where id = v_offer.id
    returning * into v_offer;
  end if;

  return query select v_offer.id, v_offer.cycle_id, v_offer.expires_at;
end;
$function$
;


CREATE OR REPLACE FUNCTION public.claim_tarokka_offer(p_offer_id uuid, p_slot smallint, p_turn boolean)
 RETURNS TABLE(draw_id uuid, cycle_id uuid, card_id smallint, is_reversed boolean, selected_slot smallint, card_slug text, card_number text, card_name text, subtitle text, meaning text, sigil text, art_key text, effect_title text, effect_description text, drawn_at timestamp with time zone, revealed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_offer public.tarokka_draw_offers%rowtype;
  v_card public.tarokka_cards%rowtype;
  v_draw public.tarokka_draws%rowtype;
  v_card_id smallint;
  v_reversed boolean;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if p_slot is null or p_slot not between 1 and 3 or p_turn is null then
    raise exception 'Choose one of the three cards.';
  end if;

  select * into v_offer
  from public.tarokka_draw_offers tdo
  where tdo.id = p_offer_id and tdo.player_id = v_user_id
;

  if not found then
    raise exception 'This hidden offer does not belong to you.';
  end if;

  perform public.tarokka_assert_access(v_offer.campaign_id, 'player');
  select * into v_offer from public.tarokka_draw_offers where id = p_offer_id and player_id = v_user_id for update;
  if not found then raise exception 'This offer has changed. Request the cards again.'; end if;

  select * into v_draw
  from public.tarokka_draws td
  where td.cycle_id = v_offer.cycle_id and td.player_id = v_user_id and td.voided_at is null;

  if not found then
    if not exists (select 1 from public.tarokka_cycles where id = v_offer.cycle_id and campaign_id = v_offer.campaign_id and is_active and draws_open) then
      raise exception 'This cycle is closed or drawing is paused. Refresh the table.';
    end if;
    if v_offer.claimed_at is not null then
      raise exception 'This offer has already been claimed.';
    end if;
    if v_offer.expires_at <= now() then
      raise exception 'The Mists have swallowed this offer. Draw again.';
    end if;

    v_card_id := v_offer.card_ids[p_slot];
    v_reversed := v_offer.reversed_flags[p_slot] <> p_turn;

    select * into v_card from public.tarokka_cards where id = v_card_id and campaign_id = v_offer.campaign_id and deck_key = 'high' and is_active;
    if not found then
      raise exception 'The deck changed. Request a new hidden hand.';
    end if;

    insert into public.tarokka_draws (
      campaign_id, cycle_id, player_id, card_id, is_reversed, selected_slot,
      card_slug_snapshot, card_number_snapshot, card_name_snapshot,
      subtitle_snapshot, meaning_snapshot, sigil_snapshot, art_key_snapshot,
      effect_title_snapshot, effect_description_snapshot
    ) values (
      v_offer.campaign_id, v_offer.cycle_id, v_user_id, v_card.id,
      v_reversed, p_slot, v_card.slug, v_card.card_number, v_card.name,
      v_card.subtitle, v_card.meaning, v_card.sigil, v_card.art_key,
      case when v_reversed then v_card.reversed_title else v_card.upright_title end,
      case when v_reversed then v_card.reversed_description else v_card.upright_description end
    ) returning * into v_draw;

    update public.tarokka_draw_offers
    set claimed_at = now(), chosen_slot = p_slot
    where id = v_offer.id;
  end if;

  return query
  select
    v_draw.id,
    v_draw.cycle_id,
    v_draw.card_id,
    v_draw.is_reversed,
    v_draw.selected_slot,
    v_draw.card_slug_snapshot,
    v_draw.card_number_snapshot,
    v_draw.card_name_snapshot,
    v_draw.subtitle_snapshot,
    v_draw.meaning_snapshot,
    v_draw.sigil_snapshot,
    v_draw.art_key_snapshot,
    v_draw.effect_title_snapshot,
    v_draw.effect_description_snapshot,
    v_draw.drawn_at,
    v_draw.revealed_at;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.claim_tarokka_offer(p_offer_id uuid, p_slot smallint)
 RETURNS TABLE(draw_id uuid, cycle_id uuid, card_id smallint, is_reversed boolean, selected_slot smallint, card_slug text, card_number text, card_name text, subtitle text, meaning text, sigil text, art_key text, effect_title text, effect_description text, drawn_at timestamp with time zone, revealed_at timestamp with time zone)
 LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ select * from public.claim_tarokka_offer(p_offer_id, p_slot, false); $$;


CREATE OR REPLACE FUNCTION public.start_next_tarokka_cycle(p_campaign_id uuid, p_title text DEFAULT NULL::text)
 RETURNS tarokka_cycles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_number integer;
  v_cycle public.tarokka_cycles%rowtype;
begin
  perform public.tarokka_assert_access(p_campaign_id, 'dm');
  if length(p_title) > 100 then raise exception 'Keep the cycle title within 100 characters.'; end if;
  if (select count(*) from public.tarokka_cards where campaign_id = p_campaign_id and deck_key = 'high' and is_active) < 5 then raise exception 'At least five active cards are required.'; end if;
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the Game Master can turn the cycle.';
  end if;

  update public.tarokka_cycles
  set is_active = false, closed_at = coalesce(closed_at, now())
  where campaign_id = p_campaign_id and is_active = true;

  select coalesce(max(cycle_number), 0) + 1 into v_number
  from public.tarokka_cycles where campaign_id = p_campaign_id;

  insert into public.tarokka_cycles (
    campaign_id, cycle_number, title, is_active, started_by
  ) values (
    p_campaign_id,
    v_number,
    coalesce(nullif(trim(p_title), ''), 'The ' || v_number || case
      when v_number % 100 between 11 and 13 then 'th'
      when v_number % 10 = 1 then 'st'
      when v_number % 10 = 2 then 'nd'
      when v_number % 10 = 3 then 'rd'
      else 'th' end || ' Turning of the Mists'),
    true,
    auth.uid()
  ) returning * into v_cycle;

  perform public.tarokka_record_event(p_campaign_id, 'cycle_started', v_cycle.title);
  return v_cycle;
end;
$function$
;


-- The new client supplies its last observed cycle to reject stale/double starts.
create or replace function public.start_next_tarokka_cycle(p_campaign_id uuid, p_title text, p_expected_cycle_id uuid)
returns public.tarokka_cycles language plpgsql security definer set search_path = '' as $$
declare v_current uuid;
begin
  perform public.tarokka_assert_access(p_campaign_id, 'dm');
  select id into v_current from public.tarokka_cycles where campaign_id = p_campaign_id and is_active;
  if v_current is distinct from p_expected_cycle_id then raise exception 'The cycle changed. Refresh before opening another Turning.'; end if;
  return public.start_next_tarokka_cycle(p_campaign_id, p_title);
end;
$$;

CREATE OR REPLACE FUNCTION public.get_tarokka_cycle_progress(p_campaign_id uuid)
 RETURNS TABLE(player_id uuid, display_name text, counts_toward_progress boolean, draw_id uuid, drawn_at timestamp with time zone, revealed_at timestamp with time zone, card_name text, is_reversed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cycle_id uuid;
begin
  perform public.tarokka_assert_access(p_campaign_id, 'dm');
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the Game Master can read campaign progress.';
  end if;

  select id into v_cycle_id
  from public.tarokka_cycles
  where campaign_id = p_campaign_id and is_active = true
  order by cycle_number desc limit 1;

  return query
  select
    cm.user_id,
    coalesce(p.display_name, 'Unnamed soul')::text,
    cm.counts_toward_campaign_progress,
    td.id,
    td.drawn_at,
    td.revealed_at,
    td.card_name_snapshot,
    td.is_reversed
  from public.campaign_members cm
  left join public.profiles p on p.id = cm.user_id
  left join public.tarokka_draws td
    on td.player_id = cm.user_id and td.cycle_id = v_cycle_id and td.voided_at is null
  where cm.campaign_id = p_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
  order by cm.counts_toward_campaign_progress desc, lower(coalesce(p.display_name, ''));
end;
$function$
;


CREATE OR REPLACE FUNCTION public.reveal_tarokka_draw(p_draw_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_draw public.tarokka_draws%rowtype;
begin
  select * into v_draw from public.tarokka_draws where id = p_draw_id;
  if not found then raise exception 'Omen not found.'; end if;

  perform public.tarokka_assert_access(v_draw.campaign_id);
  select * into v_draw from public.tarokka_draws where id = p_draw_id for update;
  if v_draw.voided_at is not null then raise exception 'This omen has been returned to the deck.'; end if;

  if v_draw.player_id <> v_user_id and not public.is_campaign_dm(v_draw.campaign_id) then
    raise exception 'You cannot reveal this omen.';
  end if;

  update public.tarokka_draws
  set revealed_at = coalesce(revealed_at, now())
  where id = p_draw_id
  returning revealed_at into v_draw.revealed_at;

  return v_draw.revealed_at;
end;
$function$
;


CREATE OR REPLACE FUNCTION public.create_tarokka_grand_reading(p_campaign_id uuid, p_title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cycle_id uuid;
  v_reading_id uuid;
  v_cards smallint[];
  v_labels text[] := array[
    'Echo of the Past',
    'Path Through the Fog',
    'Hand in the Dark',
    'Shadow at Your Back',
    'Fate Beyond the Mists'
  ];
  v_keys text[] := array['past', 'path', 'ally', 'shadow', 'fate'];
  v_prompts text[] := array[
    'What still follows the party from before the Mists?',
    'Which road will shape the next chapter?',
    'Who or what may offer aid?',
    'What danger moves unseen behind them?',
    'What possible end waits beyond the fog?'
  ];
  v_index integer;
  v_card public.tarokka_cards%rowtype;
  v_reversed boolean;
begin
  perform public.tarokka_assert_access(p_campaign_id, 'dm');
  if length(p_title) > 100 then raise exception 'Keep the reading title within 100 characters.'; end if;
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the Game Master can prepare the Grand Reading.';
  end if;

  if exists (select 1 from public.tarokka_readings where campaign_id = p_campaign_id and status in ('draft', 'revealing')) then
    raise exception 'Complete the existing reading before preparing another.';
  end if;

  select id into v_cycle_id
  from public.tarokka_cycles
  where campaign_id = p_campaign_id and is_active = true
  order by cycle_number desc limit 1;

  select array_agg(x.id order by x.random_order)
  into v_cards
  from (
    select id, random() as random_order
    from public.tarokka_cards
    where is_active = true and campaign_id = p_campaign_id and deck_key = 'high'
    order by random_order
    limit 5
  ) x;

  if coalesce(array_length(v_cards, 1), 0) < 5 then
    raise exception 'At least five active cards are required.';
  end if;

  insert into public.tarokka_readings (
    campaign_id, cycle_id, title, status, created_by
  ) values (
    p_campaign_id, v_cycle_id,
    coalesce(nullif(trim(p_title), ''), 'The Grand Reading'),
    'draft', auth.uid()
  ) returning id into v_reading_id;

  for v_index in 1..5 loop
    select * into v_card from public.tarokka_cards where id = v_cards[v_index];
    v_reversed := random() < 0.5;

    insert into public.tarokka_reading_positions (
      campaign_id, reading_id, position_index, position_key,
      position_label, position_prompt, card_id, is_reversed,
      card_slug_snapshot, card_number_snapshot, card_name_snapshot,
      subtitle_snapshot, meaning_snapshot, sigil_snapshot, art_key_snapshot,
      effect_title_snapshot, effect_description_snapshot
    ) values (
      p_campaign_id, v_reading_id, v_index, v_keys[v_index],
      v_labels[v_index], v_prompts[v_index], v_card.id, v_reversed,
      v_card.slug, v_card.card_number, v_card.name,
      v_card.subtitle, v_card.meaning, v_card.sigil, v_card.art_key,
      'The prophecy',
      case when v_reversed then v_card.prophecy_reversed else v_card.prophecy_upright end
    );
  end loop;

  return v_reading_id;
end;
$function$
;


CREATE OR REPLACE FUNCTION public.open_tarokka_grand_reading(p_reading_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id from public.tarokka_readings where id = p_reading_id;
  if not found then raise exception 'Reading not found.'; end if;
  perform public.tarokka_assert_access(v_campaign_id, 'dm');
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Only the Game Master can open the reading.'; end if;

  update public.tarokka_readings
  set status = 'revealing', opened_at = coalesce(opened_at, now())
  where id = p_reading_id and status = 'draft';

  return true;
end;
$function$
;


CREATE OR REPLACE FUNCTION public.reveal_tarokka_reading_position(p_position_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_position public.tarokka_reading_positions%rowtype;
  v_remaining integer;
begin
  select * into v_position from public.tarokka_reading_positions where id = p_position_id;
  if not found then raise exception 'Reading position not found.'; end if;
  perform public.tarokka_assert_access(v_position.campaign_id, 'dm');
  if not exists (select 1 from public.tarokka_readings where id = v_position.reading_id and status in ('revealing','complete')) then raise exception 'Open the reading before revealing a card.'; end if;
  if not public.is_campaign_dm(v_position.campaign_id) then raise exception 'Only the Game Master can reveal this card.'; end if;

  update public.tarokka_reading_positions
  set revealed_at = coalesce(revealed_at, now())
  where id = p_position_id;

  select count(*) into v_remaining
  from public.tarokka_reading_positions
  where reading_id = v_position.reading_id and revealed_at is null;

  if v_remaining = 0 then
    update public.tarokka_readings
    set status = 'complete', completed_at = coalesce(completed_at, now())
    where id = v_position.reading_id;
  end if;

  return true;
end;
$function$
;


drop policy if exists "Authenticated users can view active Tarokka cards" on public.tarokka_cards;

drop policy if exists "Campaign members can view Tarokka cycles" on public.tarokka_cycles;

drop policy if exists "Players can view own Tarokka draws and DMs can view campaign dr" on public.tarokka_draws;

drop policy if exists "Members can view revealed positions and DMs can view all positi" on public.tarokka_reading_positions;

drop policy if exists "Members can view published readings and DMs can view drafts" on public.tarokka_readings;

alter table public.tarokka_cards enable row level security;
drop policy if exists tarokka_scoped_read on public.tarokka_cards;
create policy tarokka_scoped_read on public.tarokka_cards for select to authenticated using ((public.is_campaign_member(campaign_id) and exists (select 1 from public.campaigns c where c.id = campaign_id and c.slug = 'barovia')) and (is_active or public.is_campaign_dm(campaign_id)));

alter table public.tarokka_cycles enable row level security;
drop policy if exists tarokka_scoped_read on public.tarokka_cycles;
create policy tarokka_scoped_read on public.tarokka_cycles for select to authenticated using (public.is_campaign_member(campaign_id) and exists (select 1 from public.campaigns c where c.id = campaign_id and c.slug = 'barovia'));

alter table public.tarokka_draws enable row level security;
drop policy if exists tarokka_scoped_read on public.tarokka_draws;
create policy tarokka_scoped_read on public.tarokka_draws for select to authenticated using ((public.is_campaign_member(campaign_id) and exists (select 1 from public.campaigns c where c.id = campaign_id and c.slug = 'barovia')) and (player_id = (select auth.uid()) or public.is_campaign_dm(campaign_id)));

alter table public.tarokka_readings enable row level security;
drop policy if exists tarokka_scoped_read on public.tarokka_readings;
create policy tarokka_scoped_read on public.tarokka_readings for select to authenticated using ((public.is_campaign_member(campaign_id) and exists (select 1 from public.campaigns c where c.id = campaign_id and c.slug = 'barovia')) and (public.is_campaign_dm(campaign_id) or status in ('revealing','complete')));

alter table public.tarokka_reading_positions enable row level security;
drop policy if exists tarokka_scoped_read on public.tarokka_reading_positions;
create policy tarokka_scoped_read on public.tarokka_reading_positions for select to authenticated using ((public.is_campaign_member(campaign_id) and exists (select 1 from public.campaigns c where c.id = campaign_id and c.slug = 'barovia')) and (public.is_campaign_dm(campaign_id) or (revealed_at is not null and exists (select 1 from public.tarokka_readings r where r.id = reading_id and r.status in ('revealing','complete')))));

alter table public.tarokka_events enable row level security;
drop policy if exists tarokka_scoped_read on public.tarokka_events;
create policy tarokka_scoped_read on public.tarokka_events for select to authenticated using ((public.is_campaign_member(campaign_id) and exists (select 1 from public.campaigns c where c.id = campaign_id and c.slug = 'barovia')) and public.is_campaign_dm(campaign_id));

revoke all on public.tarokka_cards from anon, authenticated;
grant select on public.tarokka_cards to authenticated;

revoke all on public.tarokka_cycles from anon, authenticated;
grant select on public.tarokka_cycles to authenticated;

revoke all on public.tarokka_draws from anon, authenticated;
grant select on public.tarokka_draws to authenticated;

revoke all on public.tarokka_readings from anon, authenticated;
grant select on public.tarokka_readings to authenticated;

revoke all on public.tarokka_reading_positions from anon, authenticated;
grant select on public.tarokka_reading_positions to authenticated;

revoke all on public.tarokka_events from anon, authenticated;
grant select on public.tarokka_events to authenticated;

revoke all on public.tarokka_draw_offers from anon, authenticated;
grant select on public.tarokka_draw_offers to authenticated;

select setval('public.tarokka_cards_id_seq', greatest(coalesce((select max(id) from public.tarokka_cards), 1), (select last_value from public.tarokka_cards_id_seq)), true);

insert into public.tarokka_cards (slug, name, card_number, subtitle, sigil, art_key, sort_order, meaning, upright_title, upright_description, reversed_title, reversed_description, prophecy_upright, prophecy_reversed, campaign_id, deck_key)
select x.slug, x.name, x.card_number, x.subtitle, x.sigil, x.art_key, x.sort_order, x.meaning, x.upright_title, x.upright_description, x.reversed_title, x.reversed_description, x.prophecy_upright, x.prophecy_reversed, c.id, 'high'
from jsonb_to_recordset($high_deck$[
  {
    "slug": "high-artifact",
    "name": "The Artifact",
    "card_number": "★ I",
    "subtitle": "Power remembers its maker",
    "sigil": "✦",
    "art_key": "high-artifact",
    "sort_order": 10,
    "meaning": "A relic outlives the hand that forged it. What you inherit may be a key, a burden, or both.",
    "upright_title": "The Relic Remembers",
    "upright_description": "Once this cycle, before a Knowledge action roll to study a crafted or magical object, apply one relevant Experience without spending its usual Hope. Its normal bonus and all other limits still apply.",
    "reversed_title": "Borrowed Splendour",
    "reversed_description": "Once this cycle, after rolling your damage but before it is applied, mark 1 Stress to reroll up to two damage dice. Keep the new values, even if lower. This changes neither the attack roll nor its Hope/Fear outcome.",
    "prophecy_upright": "An overlooked possession carries the answer. Seek its maker, previous bearer, or unfinished purpose.",
    "prophecy_reversed": "Something precious demands a new owner. Ask what was taken to give it power."
  },
  {
    "slug": "high-beast",
    "name": "The Beast",
    "card_number": "♦ J",
    "subtitle": "The hunger behind the eyes",
    "sigil": "♦",
    "art_key": "high-beast",
    "sort_order": 20,
    "meaning": "Passion can defend the hearth or devour it. The difference is what you refuse to consume.",
    "upright_title": "Teeth in the Dark",
    "upright_description": "Once this cycle, after a successful melee attack and before damage is applied, add 1d6 to that attack's damage against one target. This extra die is not multiplied by Proficiency or a critical success.",
    "reversed_title": "Cornered Animal",
    "reversed_description": "Once this cycle, after a failed Strength action roll but before its consequences resolve, mark 1 Stress to reroll both Duality Dice. Keep the new pair and resolve only its outcome. Modifiers remain unchanged.",
    "prophecy_upright": "A fierce protector guards something fragile. Discover what it loves before deciding what it is.",
    "prophecy_reversed": "An appetite has been mistaken for a need. Find who profits when restraint is lost."
  },
  {
    "slug": "high-broken-one",
    "name": "The Broken One",
    "card_number": "♦ K",
    "subtitle": "A heart that still beats",
    "sigil": "♦",
    "art_key": "high-broken-one",
    "sort_order": 30,
    "meaning": "Defeat leaves a shape in the soul. A broken thing may still shelter a smaller flame.",
    "upright_title": "Still Here",
    "upright_description": "Once this cycle, after you fail an action roll with Fear, clear 1 Stress. The failure, the GM's Fear, and the consequences of that roll remain unchanged.",
    "reversed_title": "Splinters into Shelter",
    "reversed_description": "Once this cycle, when one effect would make you mark Stress, mark 1 Hit Point instead of that effect's Stress. You can choose this only if at least one Hit Point will remain unmarked. Armor cannot reduce this cost.",
    "prophecy_upright": "Aid waits with someone the world has discarded. Their failure taught them what victory could not.",
    "prophecy_reversed": "Old grief is being used as a chain. Name the promise that keeps someone kneeling."
  },
  {
    "slug": "high-darklord",
    "name": "The Darklord",
    "card_number": "♠ K",
    "subtitle": "A crown with no horizon",
    "sigil": "♠",
    "art_key": "high-darklord",
    "sort_order": 40,
    "meaning": "Dominion can become a prison. Every throne asks who is truly permitted to leave.",
    "upright_title": "The Voice of Command",
    "upright_description": "Once this cycle, before a Presence action roll to intimidate an adversary or rally frightened NPCs, gain advantage. This grants no control over another player's character and does not compel obedience without a successful roll.",
    "reversed_title": "Debt of Blood",
    "reversed_description": "Once this cycle, when you would spend at least 2 Hope on one feature or move, spend 1 less Hope and give the GM 1 Fear instead. Pay every other cost normally. You must still spend at least 1 Hope.",
    "prophecy_upright": "A ruler's strength reveals the boundary of their prison. Study what their commands cannot change.",
    "prophecy_reversed": "The vacant throne already has a claimant. Beware the bargain that makes captivity look like inheritance."
  },
  {
    "slug": "high-donjon",
    "name": "The Donjon",
    "card_number": "♣ K",
    "subtitle": "Stone remembers every captive",
    "sigil": "♣",
    "art_key": "high-donjon",
    "sort_order": 50,
    "meaning": "Walls can keep a horror out or a soul in. Someone has forgotten which side they guard.",
    "upright_title": "The Missing Key",
    "upright_description": "Once this cycle, before a Finesse action roll to pick a lock, escape bindings, or dismantle a mechanical trap, gain advantage. You still need a plausible method and any required tools.",
    "reversed_title": "A Prison for the Pain",
    "reversed_description": "Once this cycle, when an attack would deal damage to you, mark 1 Stress to reduce that damage's severity by one threshold, in addition to normal Armor. Afterward you are Restrained until the end of your next action. This cannot reduce direct Hit Point costs.",
    "prophecy_upright": "A barrier protects more than its keeper admits. The useful question is why it was first built.",
    "prophecy_reversed": "The cage travels with its prisoner. Freedom begins with a promise, habit, or fear being broken."
  },
  {
    "slug": "high-executioner",
    "name": "The Executioner",
    "card_number": "♠ J",
    "subtitle": "The sentence draws its breath",
    "sigil": "♠",
    "art_key": "high-executioner",
    "sort_order": 60,
    "meaning": "An ending can be justice, cruelty, or mercy. The blade does not decide which.",
    "upright_title": "The Final Measure",
    "upright_description": "Once this cycle, after rolling damage against an adversary that has harmed an ally during this scene, change one of those damage dice to its maximum face. Do this before damage is applied; no other dice or flat bonuses change.",
    "reversed_title": "A Bitter Sentence",
    "reversed_description": "Once this cycle, before an attack roll, mark 1 Stress. If the attack hits, one target adversary also marks 1 Stress if it has a Stress track. If the attack misses, both the cost and this omen are still spent.",
    "prophecy_upright": "Something must be brought to an end. Decide who has the right to pronounce that sentence.",
    "prophecy_reversed": "A punishment has survived its crime. Follow the sentence back to the person who first demanded it."
  },
  {
    "slug": "high-ghost",
    "name": "The Ghost",
    "card_number": "♥ K",
    "subtitle": "The room is never empty",
    "sigil": "♥",
    "art_key": "high-ghost",
    "sort_order": 70,
    "meaning": "The past has not finished speaking. A haunting can be a warning or a request to be remembered.",
    "upright_title": "Almost a Memory",
    "upright_description": "Once this cycle, after an adversary rolls an attack against you but before damage resolves, increase your Evasion by 2 against that attack only. If it now misses, resolve it as a miss. This does not protect anyone else targeted by the attack.",
    "reversed_title": "A Name Left Behind",
    "reversed_description": "Once this cycle, in a quiet moment, ask whether this place holds an echo of its dead. If the GM confirms one exists, mark 1 Stress and ask one question about an event that happened here; receive a truthful sensory fragment. It cannot reveal what the dead never witnessed. If no echo exists, the omen is unspent.",
    "prophecy_upright": "An unfinished kindness still binds someone to this place. Hear the memory before following the apparition.",
    "prophecy_reversed": "A voice repeats the past because the living will not face it. Find whose version of the story is missing."
  },
  {
    "slug": "high-horseman",
    "name": "The Horseman",
    "card_number": "★ II",
    "subtitle": "Hooves beyond the last lantern",
    "sigil": "✦",
    "art_key": "high-horseman",
    "sort_order": 80,
    "meaning": "Change approaches whether you welcome it or not. Choose what rides with you when the road turns.",
    "upright_title": "Ride Before the Bell",
    "upright_description": "Once this cycle, before your action, move to a point within Far range without a separate movement roll. The route must be traversable; barriers, dangerous terrain, and other consequences still apply. This grants no additional attack or action.",
    "reversed_title": "Not at This Crossing",
    "reversed_description": "Once this cycle, after failing an Agility reaction roll against a fall, collapse, or environmental hazard, mark 1 Stress to reroll it. Keep the new result and the same modifiers. As a reaction roll it still generates neither Hope nor Fear.",
    "prophecy_upright": "A departure will change more than a destination. Prepare for the arrival that follows it.",
    "prophecy_reversed": "An ending has been delayed, not escaped. Seek the unfinished farewell before the road demands payment."
  },
  {
    "slug": "high-innocent",
    "name": "The Innocent",
    "card_number": "♥ Q",
    "subtitle": "A candle held against the wind",
    "sigil": "♥",
    "art_key": "high-innocent",
    "sort_order": 90,
    "meaning": "Gentleness is not ignorance. A small act of trust can deny cruelty its final victory.",
    "upright_title": "An Unbroken Light",
    "upright_description": "Once this cycle, when another player character within Close range would mark Stress, prevent 1 of those Stress marks. Describe a word or gesture they can perceive. You do not transfer the omen or its remaining use to them.",
    "reversed_title": "The Wound You Choose",
    "reversed_description": "Once this cycle, after an ally within Very Close range resolves Armor against an attack but before marking Hit Points, take 1 of those Hit Point marks yourself instead. Armor cannot reduce the transferred mark. All other damage and effects stay with their original target.",
    "prophecy_upright": "Someone vulnerable holds a choice that power cannot make for them. Protect their chance to choose.",
    "prophecy_reversed": "Protection is becoming possession. Ask whose wishes have disappeared beneath another person's good intentions."
  },
  {
    "slug": "high-marionette",
    "name": "The Marionette",
    "card_number": "♥ J",
    "subtitle": "Whose hand holds the thread?",
    "sigil": "♥",
    "art_key": "high-marionette",
    "sort_order": 100,
    "meaning": "Influence is strongest when it feels like your own idea. A helping hand and a controlling hand can look alike.",
    "upright_title": "A Guiding Thread",
    "upright_description": "Once this cycle, after another player within Close range rolls an action but before its outcome resolves, add +2 to the total. Describe a useful cue they can perceive. This is not an advantage die and does not change which Duality Die is higher.",
    "reversed_title": "Cut the Strings",
    "reversed_description": "Once this cycle, mark 1 Stress to end one temporary Restrained or Vulnerable condition affecting you. Describe how you break its hold. This cannot end a permanent curse or erase the source of the condition; that source may impose it again.",
    "prophecy_upright": "Follow the smallest tug to the hand above it. A servant may know a master better than an enemy does.",
    "prophecy_reversed": "A broken thread leaves a dangerous freedom. Decide what will guide the person who no longer has orders."
  },
  {
    "slug": "high-mists",
    "name": "The Mists",
    "card_number": "♠ Q",
    "subtitle": "No road promises a return",
    "sigil": "♠",
    "art_key": "high-mists",
    "sort_order": 110,
    "meaning": "Certainty thins at the edge of the lantern light. A hidden path is not necessarily a safe one.",
    "upright_title": "The Unseen Path",
    "upright_description": "Once this cycle, before an Instinct action roll to navigate, track a trail, or find shelter, gain advantage. This does not open a sealed Domain border or reveal a destination the GM has established as unreachable.",
    "reversed_title": "Step out of the Story",
    "reversed_description": "Once this cycle, before your action, mark 1 Stress and vanish into mist, reappearing at an unoccupied point you can see within Close range. You cannot pass through a solid barrier or use this while Restrained. This grants neither invisibility afterward nor an extra action.",
    "prophecy_upright": "An uncertain route will reveal a necessary truth. Watch what the fog chooses to leave visible.",
    "prophecy_reversed": "A familiar road leads somewhere different. What returns may not be exactly what departed."
  },
  {
    "slug": "high-raven",
    "name": "The Raven",
    "card_number": "♣ Q",
    "subtitle": "A witness on the crooked branch",
    "sigil": "♣",
    "art_key": "high-raven",
    "sort_order": 120,
    "meaning": "Help may arrive in an unsettling shape. An observer sees the danger that those inside it cannot.",
    "upright_title": "Eyes on the Road",
    "upright_description": "Once this cycle, while observing a present threat, ask the GM for one practical detail about useful cover, a safer approach, or an immediate weakness. The answer is truthful and actionable, but need not disclose a stat block or a future secret.",
    "reversed_title": "The Messenger's Price",
    "reversed_description": "Once this cycle, mark 1 Stress to send a message of up to 25 words to a known, willing ally elsewhere in Barovia. They may send one equally short reply. The GM describes the raven or omen carrying it. This does not reveal their location, compel a reply, or cross the Mists out of the Domain.",
    "prophecy_upright": "A watchful stranger has already noticed the party. Kindness offered quietly may return as aid.",
    "prophecy_reversed": "A warning arrives in a form easy to dismiss. Learn why its messenger cannot speak plainly."
  },
  {
    "slug": "high-seer",
    "name": "The Seer",
    "card_number": "♣ J",
    "subtitle": "The future blinks first",
    "sigil": "♣",
    "art_key": "high-seer",
    "sort_order": 130,
    "meaning": "Seeing a possibility is not choosing it. Foreknowledge asks what you are willing to change.",
    "upright_title": "The Other Reflection",
    "upright_description": "Once this cycle, after rolling your Duality Dice but before resolving the action, swap the Hope and Fear values. The total stays the same; resolve only the final Hope/Fear outcome. Matching dice remain a critical success.",
    "reversed_title": "A Future Paid For",
    "reversed_description": "Once this cycle, before an action roll, mark 1 Stress and roll an extra d12. After rolling the Duality Dice, you may replace either one with that extra value. Keep the resulting pair and resolve only its outcome, including any critical success. The omen is spent even if you keep the original pair.",
    "prophecy_upright": "A choice glimpsed early can still be changed. Find the decision hidden inside what seems inevitable.",
    "prophecy_reversed": "Someone has mistaken one possible future for a command. Ask what their prediction leaves out."
  },
  {
    "slug": "high-tempter",
    "name": "The Tempter",
    "card_number": "♦ Q",
    "subtitle": "Every gift casts a shadow",
    "sigil": "♦",
    "art_key": "high-tempter",
    "sort_order": 140,
    "meaning": "A useful bargain may be the most dangerous one. Listen for the price that was never spoken aloud.",
    "upright_title": "Honey on the Tongue",
    "upright_description": "Once this cycle, after rolling a Presence action to bargain or deceive but before resolving its outcome, spend 1 Hope to add +3 to the total. This changes neither the Duality Dice nor their Hope/Fear outcome, and does not compel another player's character.",
    "reversed_title": "The Bargain Below",
    "reversed_description": "Once this cycle, after a failed non-attack action roll but before its consequences resolve, ask the GM to offer a concrete complication. If you accept, add 1d6 to that roll's total; its Hope/Fear outcome is unchanged and it may still fail. This is a Tarokka bonus, not advantage. If you refuse the offered price, the omen is unspent.",
    "prophecy_upright": "A willing bargain offers a narrow way forward. Make every condition speak its name.",
    "prophecy_reversed": "A gift is collecting interest. Discover what its giver considers payment before accepting another."
  }
]$high_deck$::jsonb) as x(slug text, name text, card_number text, subtitle text, sigil text, art_key text, sort_order integer, meaning text, upright_title text, upright_description text, reversed_title text, reversed_description text, prophecy_upright text, prophecy_reversed text)
cross join public.campaigns c where c.slug = 'barovia'
on conflict (slug) do nothing;

update public.tarokka_cards set is_active = false where deck_key = 'legacy' and campaign_id = (select id from public.campaigns where slug = 'barovia');

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like '%tarokka%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    if f.proname not in ('tarokka_assert_access','tarokka_record_event') then
      execute format('grant execute on function %s to authenticated', f.signature);
    end if;
  end loop;
end;
$$;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['tarokka_cards','tarokka_cycles','tarokka_draws','tarokka_readings','tarokka_reading_positions','tarokka_events'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
notify pgrst, 'reload schema';
