-- Original Tarokka schema recovered for migration regression tests. No campaign/player data.

create sequence public.tarokka_cards_id_seq;

create table public.tarokka_cards (
  id smallint default nextval('tarokka_cards_id_seq'::regclass) not null,
  slug text not null,
  card_number text not null,
  name text not null,
  subtitle text not null,
  meaning text not null,
  upright_title text not null,
  upright_description text not null,
  reversed_title text not null,
  reversed_description text not null,
  sigil text not null,
  art_key text not null,
  sort_order integer default 100 not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.tarokka_cycles (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid not null,
  cycle_number integer not null,
  title text not null,
  is_active boolean default true not null,
  started_by uuid,
  started_at timestamp with time zone default now() not null,
  closed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.tarokka_draw_offers (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid not null,
  cycle_id uuid not null,
  player_id uuid not null,
  card_ids smallint[] not null,
  reversed_flags boolean[] not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null,
  claimed_at timestamp with time zone,
  chosen_slot smallint
);

create table public.tarokka_draws (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid not null,
  cycle_id uuid not null,
  player_id uuid not null,
  card_id smallint,
  is_reversed boolean not null,
  selected_slot smallint not null,
  card_slug_snapshot text not null,
  card_number_snapshot text not null,
  card_name_snapshot text not null,
  subtitle_snapshot text not null,
  meaning_snapshot text not null,
  sigil_snapshot text not null,
  art_key_snapshot text not null,
  effect_title_snapshot text not null,
  effect_description_snapshot text not null,
  drawn_at timestamp with time zone default now() not null,
  revealed_at timestamp with time zone
);

create table public.tarokka_reading_positions (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid not null,
  reading_id uuid not null,
  position_index smallint not null,
  position_key text not null,
  position_label text not null,
  position_prompt text not null,
  card_id smallint,
  is_reversed boolean not null,
  card_slug_snapshot text not null,
  card_number_snapshot text not null,
  card_name_snapshot text not null,
  subtitle_snapshot text not null,
  meaning_snapshot text not null,
  sigil_snapshot text not null,
  art_key_snapshot text not null,
  effect_title_snapshot text not null,
  effect_description_snapshot text not null,
  revealed_at timestamp with time zone
);

create table public.tarokka_readings (
  id uuid default gen_random_uuid() not null,
  campaign_id uuid not null,
  cycle_id uuid,
  title text default 'The Grand Reading'::text not null,
  status text default 'draft'::text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  opened_at timestamp with time zone,
  completed_at timestamp with time zone
);

alter table public.tarokka_cards add constraint tarokka_cards_pkey PRIMARY KEY (id);

alter table public.tarokka_cards add constraint tarokka_cards_slug_key UNIQUE (slug);

alter table public.tarokka_cycles add constraint tarokka_cycles_campaign_id_cycle_number_key UNIQUE (campaign_id, cycle_number);

alter table public.tarokka_cycles add constraint tarokka_cycles_pkey PRIMARY KEY (id);

alter table public.tarokka_draw_offers add constraint tarokka_draw_offers_cycle_id_player_id_key UNIQUE (cycle_id, player_id);

alter table public.tarokka_draw_offers add constraint tarokka_draw_offers_pkey PRIMARY KEY (id);

alter table public.tarokka_draw_offers add constraint tarokka_offer_slot_check CHECK (((chosen_slot IS NULL) OR ((chosen_slot >= 1) AND (chosen_slot <= 3))));

alter table public.tarokka_draw_offers add constraint tarokka_offer_three_cards_check CHECK ((array_length(card_ids, 1) = 3));

alter table public.tarokka_draw_offers add constraint tarokka_offer_three_flags_check CHECK ((array_length(reversed_flags, 1) = 3));

alter table public.tarokka_draws add constraint tarokka_draw_slot_check CHECK (((selected_slot >= 1) AND (selected_slot <= 3)));

alter table public.tarokka_draws add constraint tarokka_draws_cycle_id_player_id_key UNIQUE (cycle_id, player_id);

alter table public.tarokka_draws add constraint tarokka_draws_pkey PRIMARY KEY (id);

alter table public.tarokka_reading_positions add constraint tarokka_reading_position_index_check CHECK (((position_index >= 1) AND (position_index <= 5)));

alter table public.tarokka_reading_positions add constraint tarokka_reading_positions_pkey PRIMARY KEY (id);

alter table public.tarokka_reading_positions add constraint tarokka_reading_positions_reading_id_position_index_key UNIQUE (reading_id, position_index);

alter table public.tarokka_readings add constraint tarokka_reading_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'revealing'::text, 'complete'::text])));

alter table public.tarokka_readings add constraint tarokka_readings_pkey PRIMARY KEY (id);

alter table public.tarokka_cycles add constraint tarokka_cycles_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table public.tarokka_cycles add constraint tarokka_cycles_started_by_fkey FOREIGN KEY (started_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public.tarokka_draw_offers add constraint tarokka_draw_offers_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table public.tarokka_draw_offers add constraint tarokka_draw_offers_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES tarokka_cycles(id) ON DELETE CASCADE;

alter table public.tarokka_draw_offers add constraint tarokka_draw_offers_player_id_fkey FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.tarokka_draws add constraint tarokka_draws_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table public.tarokka_draws add constraint tarokka_draws_card_id_fkey FOREIGN KEY (card_id) REFERENCES tarokka_cards(id) ON DELETE SET NULL;

alter table public.tarokka_draws add constraint tarokka_draws_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES tarokka_cycles(id) ON DELETE CASCADE;

alter table public.tarokka_draws add constraint tarokka_draws_player_id_fkey FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.tarokka_reading_positions add constraint tarokka_reading_positions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table public.tarokka_reading_positions add constraint tarokka_reading_positions_card_id_fkey FOREIGN KEY (card_id) REFERENCES tarokka_cards(id) ON DELETE SET NULL;

alter table public.tarokka_reading_positions add constraint tarokka_reading_positions_reading_id_fkey FOREIGN KEY (reading_id) REFERENCES tarokka_readings(id) ON DELETE CASCADE;

alter table public.tarokka_readings add constraint tarokka_readings_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table public.tarokka_readings add constraint tarokka_readings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public.tarokka_readings add constraint tarokka_readings_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES tarokka_cycles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX tarokka_one_active_cycle_per_campaign_idx ON public.tarokka_cycles USING btree (campaign_id) WHERE (is_active = true);

CREATE INDEX tarokka_draws_campaign_player_idx ON public.tarokka_draws USING btree (campaign_id, player_id, drawn_at DESC);

CREATE INDEX tarokka_reading_positions_campaign_idx ON public.tarokka_reading_positions USING btree (campaign_id, reading_id, position_index);

CREATE UNIQUE INDEX tarokka_one_open_reading_per_campaign_idx ON public.tarokka_readings USING btree (campaign_id) WHERE (status = ANY (ARRAY['draft'::text, 'revealing'::text]));

CREATE OR REPLACE FUNCTION public.reset_tarokka_player_draw(p_campaign_id uuid, p_player_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cycle_id uuid;
begin
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the Game Master can return a card to the deck.';
  end if;

  select id into v_cycle_id
  from public.tarokka_cycles
  where campaign_id = p_campaign_id and is_active = true
  order by cycle_number desc limit 1;

  delete from public.tarokka_draw_offers
  where cycle_id = v_cycle_id and player_id = p_player_id;

  delete from public.tarokka_draws
  where cycle_id = v_cycle_id and player_id = p_player_id;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fate_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reveal_tarokka_draw(p_draw_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_draw public.tarokka_draws%rowtype;
begin
  select * into v_draw from public.tarokka_draws where id = p_draw_id;
  if not found then raise exception 'Omen not found.'; end if;

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

CREATE OR REPLACE FUNCTION public.get_tarokka_cycle_progress(p_campaign_id uuid)
 RETURNS TABLE(player_id uuid, display_name text, counts_toward_progress boolean, draw_id uuid, drawn_at timestamp with time zone, revealed_at timestamp with time zone, card_name text, is_reversed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cycle_id uuid;
begin
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
    on td.player_id = cm.user_id and td.cycle_id = v_cycle_id
  where cm.campaign_id = p_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
  order by cm.counts_toward_campaign_progress desc, lower(coalesce(p.display_name, ''));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_tarokka_offer(p_campaign_id uuid)
 RETURNS TABLE(offer_id uuid, cycle_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_cycle public.tarokka_cycles%rowtype;
  v_offer public.tarokka_draw_offers%rowtype;
  v_card_ids smallint[];
  v_flags boolean[];
begin
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

  if exists (
    select 1 from public.tarokka_draws td
    where td.cycle_id = v_cycle.id and td.player_id = v_user_id
  ) then
    raise exception 'You have already drawn an omen during this cycle.';
  end if;

  select * into v_offer
  from public.tarokka_draw_offers tdo
  where tdo.cycle_id = v_cycle.id and tdo.player_id = v_user_id
  for update;

  if found and v_offer.claimed_at is null and v_offer.expires_at > now() then
    return query select v_offer.id, v_offer.cycle_id, v_offer.expires_at;
    return;
  end if;

  select array_agg(x.id order by x.random_order)
  into v_card_ids
  from (
    select id, random() as random_order
    from public.tarokka_cards
    where is_active = true
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
    set card_ids = v_card_ids,
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

CREATE OR REPLACE FUNCTION public.start_next_tarokka_cycle(p_campaign_id uuid, p_title text DEFAULT NULL::text)
 RETURNS tarokka_cycles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_number integer;
  v_cycle public.tarokka_cycles%rowtype;
begin
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

  return v_cycle;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_tarokka_grand_reading(p_campaign_id uuid, p_title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only the Game Master can prepare the Grand Reading.';
  end if;

  update public.tarokka_readings
  set status = 'complete', completed_at = coalesce(completed_at, now())
  where campaign_id = p_campaign_id and status in ('draft', 'revealing');

  select id into v_cycle_id
  from public.tarokka_cycles
  where campaign_id = p_campaign_id and is_active = true
  order by cycle_number desc limit 1;

  select array_agg(x.id order by x.random_order)
  into v_cards
  from (
    select id, random() as random_order
    from public.tarokka_cards
    where is_active = true
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
      case when v_reversed then v_card.reversed_title else v_card.upright_title end,
      case when v_reversed then v_card.reversed_description else v_card.upright_description end
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
 SET search_path TO 'public'
AS $function$
declare
  v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id from public.tarokka_readings where id = p_reading_id;
  if not found then raise exception 'Reading not found.'; end if;
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
 SET search_path TO 'public'
AS $function$
declare
  v_position public.tarokka_reading_positions%rowtype;
  v_remaining integer;
begin
  select * into v_position from public.tarokka_reading_positions where id = p_position_id;
  if not found then raise exception 'Reading position not found.'; end if;
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

CREATE OR REPLACE FUNCTION public.claim_tarokka_offer(p_offer_id uuid, p_slot smallint)
 RETURNS TABLE(draw_id uuid, cycle_id uuid, card_id smallint, is_reversed boolean, selected_slot smallint, card_slug text, card_number text, card_name text, subtitle text, meaning text, sigil text, art_key text, effect_title text, effect_description text, drawn_at timestamp with time zone, revealed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  if p_slot not between 1 and 3 then
    raise exception 'Choose one of the three cards.';
  end if;

  select * into v_offer
  from public.tarokka_draw_offers tdo
  where tdo.id = p_offer_id and tdo.player_id = v_user_id
  for update;

  if not found then
    raise exception 'This hidden offer does not belong to you.';
  end if;

  select * into v_draw
  from public.tarokka_draws td
  where td.cycle_id = v_offer.cycle_id and td.player_id = v_user_id;

  if not found then
    if v_offer.claimed_at is not null then
      raise exception 'This offer has already been claimed.';
    end if;
    if v_offer.expires_at <= now() then
      raise exception 'The Mists have swallowed this offer. Draw again.';
    end if;

    v_card_id := v_offer.card_ids[p_slot];
    v_reversed := v_offer.reversed_flags[p_slot];

    select * into v_card from public.tarokka_cards where id = v_card_id;
    if not found then
      raise exception 'The selected card no longer exists.';
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

alter table public.tarokka_cards enable row level security;

create policy "Authenticated users can view active Tarokka cards" on public.tarokka_cards for SELECT to authenticated using (((is_active = true) AND (EXISTS ( SELECT 1
   FROM campaigns c
  WHERE ((c.slug = 'barovia'::text) AND is_campaign_member(c.id))))));

alter table public.tarokka_cycles enable row level security;

create policy "Campaign members can view Tarokka cycles" on public.tarokka_cycles for SELECT to authenticated using (is_campaign_member(campaign_id));

alter table public.tarokka_draws enable row level security;

create policy "Players can view own Tarokka draws and DMs can view campaign dr" on public.tarokka_draws for SELECT to authenticated using (((player_id = auth.uid()) OR is_campaign_dm(campaign_id)));

alter table public.tarokka_reading_positions enable row level security;

create policy "Members can view revealed positions and DMs can view all positi" on public.tarokka_reading_positions for SELECT to authenticated using ((is_campaign_dm(campaign_id) OR (is_campaign_member(campaign_id) AND (revealed_at IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM tarokka_readings tr
  WHERE ((tr.id = tarokka_reading_positions.reading_id) AND (tr.status = ANY (ARRAY['revealing'::text, 'complete'::text]))))))));

alter table public.tarokka_readings enable row level security;

create policy "Members can view published readings and DMs can view drafts" on public.tarokka_readings for SELECT to authenticated using ((is_campaign_dm(campaign_id) OR (is_campaign_member(campaign_id) AND (status = ANY (ARRAY['revealing'::text, 'complete'::text])))));