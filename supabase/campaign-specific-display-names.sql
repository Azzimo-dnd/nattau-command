-- ============================================================
-- Campaign Companion — campaign-specific member display names
--
-- Gives each campaign membership its own display name while
-- retaining public.profiles.display_name as a backwards-compatible
-- account-level fallback.
-- ============================================================

begin;

alter table public.campaign_members
  add column if not exists display_name text;

update public.campaign_members cm
set display_name = nullif(trim(p.display_name), '')
from public.profiles p
where p.id = cm.user_id
  and nullif(trim(cm.display_name), '') is null
  and nullif(trim(p.display_name), '') is not null;

alter table public.campaign_members
  drop constraint if exists campaign_members_display_name_length_check;

alter table public.campaign_members
  add constraint campaign_members_display_name_length_check
  check (display_name is null or char_length(trim(display_name)) between 1 and 80);

CREATE OR REPLACE FUNCTION private.campaign_display_name(p_campaign_id uuid, p_user_id uuid, p_fallback text DEFAULT 'Campaign member'::text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (
      select nullif(trim(cm.display_name), '')
      from public.campaign_members cm
      where cm.campaign_id = p_campaign_id
        and cm.user_id = p_user_id
      limit 1
    ),
    (
      select nullif(trim(p.display_name), '')
      from public.profiles p
      where p.id = p_user_id
      limit 1
    ),
    p_fallback
  );
$function$;

CREATE OR REPLACE FUNCTION private.ensure_campaign_member_display_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if nullif(trim(new.display_name), '') is null then
    select nullif(trim(p.display_name), '')
      into new.display_name
    from public.profiles p
    where p.id = new.user_id;
  end if;

  new.display_name := coalesce(
    nullif(trim(new.display_name), ''),
    'Campaign member'
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_campaign_chat_messages(p_thread_id uuid)
 RETURNS TABLE(id uuid, campaign_id uuid, thread_id uuid, sender_id uuid, sender_name text, sender_role text, content text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    m.id,
    m.campaign_id,
    m.thread_id,
    m.sender_id,
    private.campaign_display_name(t.campaign_id, m.sender_id, 'Unknown wanderer') as sender_name,
    coalesce(cm.role, 'player') as sender_role,
    m.content,
    m.created_at
  from public.campaign_chat_messages m
  join public.campaign_chat_threads t on t.id = m.thread_id
  left join public.profiles p on p.id = m.sender_id
  left join public.campaign_members cm
    on cm.campaign_id = t.campaign_id
   and cm.user_id = m.sender_id
  where m.thread_id = p_thread_id
    and public.can_access_campaign_chat_thread(p_thread_id)
  order by m.created_at asc
  limit 500;
$function$;

CREATE OR REPLACE FUNCTION public.get_campaign_chat_thread_context(p_thread_id uuid)
 RETURNS TABLE(campaign_id uuid, campaign_slug text, player_id uuid, other_user_id uuid, other_display_name text, other_role text, other_last_read_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_thread public.campaign_chat_threads%rowtype;
  v_current_role text;
  v_other_user_id uuid;
begin
  if not public.can_access_campaign_chat_thread(p_thread_id) then
    raise exception 'Chat access denied.';
  end if;

  select * into v_thread
  from public.campaign_chat_threads t
  where t.id = p_thread_id;

  select cm.role into v_current_role
  from public.campaign_members cm
  where cm.campaign_id = v_thread.campaign_id
    and cm.user_id = auth.uid()
    and cm.is_active = true;

  if v_current_role = 'dm' then
    v_other_user_id := v_thread.player_id;
  else
    select cm.user_id into v_other_user_id
    from public.campaign_members cm
    where cm.campaign_id = v_thread.campaign_id
      and cm.role = 'dm'
      and cm.is_active = true
    order by cm.joined_at asc
    limit 1;
  end if;

  return query
  select
    v_thread.campaign_id,
    c.slug,
    v_thread.player_id,
    v_other_user_id,
    private.campaign_display_name(v_thread.campaign_id, v_other_user_id, case when v_current_role = 'dm' then 'Player' else 'Game Master' end),
    case when v_current_role = 'dm' then 'player' else 'dm' end,
    r.last_read_at
  from public.campaigns c
  left join public.profiles p on p.id = v_other_user_id
  left join public.campaign_chat_reads r
    on r.thread_id = v_thread.id
   and r.user_id = v_other_user_id
  where c.id = v_thread.campaign_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_campaign_chat_thread_summaries(p_campaign_slug text)
 RETURNS TABLE(campaign_id uuid, player_id uuid, player_display_name text, thread_id uuid, unread_messages bigint, last_message text, last_message_at timestamp with time zone, last_sender_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_campaign_id uuid;
begin
  select c.id into v_campaign_id
  from public.campaigns c
  where c.slug = p_campaign_slug
    and c.is_active = true;

  if v_campaign_id is null or not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Game Master access is required.';
  end if;

  return query
  select
    v_campaign_id,
    cm.user_id,
    private.campaign_display_name(v_campaign_id, cm.user_id, 'Unnamed player'),
    t.id,
    coalesce((
      select count(*)
      from public.campaign_chat_messages unread_message
      left join public.campaign_chat_reads own_read
        on own_read.thread_id = t.id
       and own_read.user_id = auth.uid()
      where unread_message.thread_id = t.id
        and unread_message.sender_id <> auth.uid()
        and unread_message.created_at > coalesce(own_read.last_read_at, '-infinity'::timestamptz)
    ), 0)::bigint,
    latest.content,
    latest.created_at,
    latest.sender_id
  from public.campaign_members cm
  left join public.profiles p on p.id = cm.user_id
  left join public.campaign_chat_threads t
    on t.campaign_id = cm.campaign_id
   and t.player_id = cm.user_id
  left join lateral (
    select m.content, m.created_at, m.sender_id
    from public.campaign_chat_messages m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) latest on true
  where cm.campaign_id = v_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
  order by
    coalesce((
      select count(*)
      from public.campaign_chat_messages unread_order
      left join public.campaign_chat_reads own_read_order
        on own_read_order.thread_id = t.id
       and own_read_order.user_id = auth.uid()
      where unread_order.thread_id = t.id
        and unread_order.sender_id <> auth.uid()
        and unread_order.created_at > coalesce(own_read_order.last_read_at, '-infinity'::timestamptz)
    ), 0) desc,
    latest.created_at desc nulls last,
    lower(private.campaign_display_name(v_campaign_id, cm.user_id, '')) asc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_session_planner_data(p_campaign_slug text, p_month_start date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_campaign_id uuid;
  v_campaign_slug text;
  v_month_start date;
  v_month_end date;
  v_role text;
  v_planning_enabled boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to open the Session Planner.';
  end if;

  select c.id, c.slug, cm.role, cm.planning_enabled
  into v_campaign_id, v_campaign_slug, v_role, v_planning_enabled
  from public.campaigns c
  join public.campaign_members cm on cm.campaign_id = c.id
  where c.slug = lower(trim(p_campaign_slug))
    and c.is_active = true
    and cm.user_id = auth.uid()
    and cm.is_active = true;

  if not found then
    raise exception 'You do not have access to this campaign.';
  end if;

  v_month_start := date_trunc('month', coalesce(p_month_start, current_date))::date;
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;

  return jsonb_build_object(
    'campaign_id', v_campaign_id,
    'campaign_slug', v_campaign_slug,
    'month_start', v_month_start,
    'month_end', v_month_end,
    'current_user_id', auth.uid(),
    'current_user_role', v_role,
    'current_user_planning_enabled', case
      when v_role = 'dm' then true
      else coalesce(v_planning_enabled, true)
    end,
    'members', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', cm.user_id,
            'display_name', coalesce(
              nullif(trim(cm.display_name), ''),
              nullif(trim(p.display_name), ''),
              case when cm.role = 'dm' then 'Game Master' else 'Campaign Member' end
            ),
            'role', cm.role,
            'planning_enabled', case
              when cm.role = 'dm' then true
              else coalesce(cm.planning_enabled, true)
            end
          )
          order by
            case when cm.role = 'dm' then 0 else 1 end,
            coalesce(nullif(trim(cm.display_name), ''), nullif(trim(p.display_name), ''), 'Campaign Member')
        )
        from public.campaign_members cm
        left join public.profiles p on p.id = cm.user_id
        where cm.campaign_id = v_campaign_id
          and cm.is_active = true
          and cm.role in ('dm', 'player')
      ),
      '[]'::jsonb
    ),
    'availability', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', a.user_id,
            'availability_date', a.availability_date,
            'availability_mode', a.availability_mode,
            'updated_at', a.updated_at
          )
          order by a.availability_date, a.user_id
        )
        from public.session_availability a
        where a.campaign_id = v_campaign_id
          and a.availability_date between v_month_start and v_month_end
      ),
      '[]'::jsonb
    ),
    'proposals', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sp.id,
            'proposed_date', sp.proposed_date,
            'session_mode', sp.session_mode,
            'message', sp.message,
            'status', sp.status,
            'created_by', sp.created_by,
            'created_by_name', private.campaign_display_name(v_campaign_id, sp.created_by, 'Game Master'),
            'created_at', sp.created_at,
            'updated_at', sp.updated_at,
            'confirmed_at', sp.confirmed_at,
            'votes', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'voter_id', v.voter_id,
                    'voter_name', private.campaign_display_name(v_campaign_id, v.voter_id, 'Campaign Member'),
                    'vote', v.vote,
                    'updated_at', v.updated_at
                  )
                  order by private.campaign_display_name(v_campaign_id, v.voter_id, 'Campaign Member')
                )
                from public.session_proposal_votes v
                left join public.profiles voter on voter.id = v.voter_id
                where v.proposal_id = sp.id
              ),
              '[]'::jsonb
            )
          )
          order by
            case sp.status when 'confirmed' then 0 else 1 end,
            sp.proposed_date,
            sp.created_at
        )
        from public.session_proposals sp
        left join public.profiles creator on creator.id = sp.created_by
        where sp.campaign_id = v_campaign_id
          and sp.proposed_date between v_month_start and v_month_end
          and sp.status in ('voting', 'confirmed')
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_session_planner_home_summary(p_campaign_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_campaign_id uuid;
  v_role text;
  v_player_count integer := 0;
  v_players_responded integer := 0;
  v_missing_player_names jsonb := '[]'::jsonb;
  v_current_user_availability_days integer := 0;
  v_open_proposal_count integer := 0;
  v_proposals_awaiting_vote integer := 0;
  v_promising_date_count integer := 0;
  v_response_window_days integer := 45;
  v_window_end date;
  v_promising_threshold integer := 1;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to load the Session Planner summary.';
  end if;

  select c.id, cm.role
  into v_campaign_id, v_role
  from public.campaigns c
  join public.campaign_members cm on cm.campaign_id = c.id
  where c.slug = lower(trim(p_campaign_slug))
    and c.is_active = true
    and cm.user_id = auth.uid()
    and cm.is_active = true;

  if not found then
    raise exception 'You do not have access to this campaign.';
  end if;

  v_window_end := current_date + v_response_window_days;

  select count(*)::integer
  into v_player_count
  from public.campaign_members cm
  where cm.campaign_id = v_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
    and cm.planning_enabled = true;

  v_promising_threshold := greatest(1, ceil(v_player_count * 0.75)::integer);

  select count(distinct a.user_id)::integer
  into v_players_responded
  from public.session_availability a
  join public.campaign_members cm
    on cm.campaign_id = a.campaign_id
   and cm.user_id = a.user_id
  where a.campaign_id = v_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
    and cm.planning_enabled = true
    and a.availability_date between current_date and v_window_end;

  select coalesce(jsonb_agg(player_name order by player_name), '[]'::jsonb)
  into v_missing_player_names
  from (
    select coalesce(nullif(trim(cm.display_name), ''), nullif(trim(p.display_name), ''), 'Campaign Member') as player_name
    from public.campaign_members cm
    left join public.profiles p on p.id = cm.user_id
    where cm.campaign_id = v_campaign_id
      and cm.role = 'player'
      and cm.is_active = true
      and cm.planning_enabled = true
      and not exists (
        select 1
        from public.session_availability a
        where a.campaign_id = v_campaign_id
          and a.user_id = cm.user_id
          and a.availability_date between current_date and v_window_end
      )
  ) missing_players;

  select count(*)::integer
  into v_current_user_availability_days
  from public.session_availability a
  where a.campaign_id = v_campaign_id
    and a.user_id = auth.uid()
    and a.availability_date between current_date and v_window_end;

  select count(*)::integer
  into v_open_proposal_count
  from public.session_proposals sp
  where sp.campaign_id = v_campaign_id
    and sp.status = 'voting'
    and sp.proposed_date >= current_date;

  if v_role = 'player' then
    select count(*)::integer
    into v_proposals_awaiting_vote
    from public.session_proposals sp
    where sp.campaign_id = v_campaign_id
      and sp.status = 'voting'
      and sp.proposed_date >= current_date
      and not exists (
        select 1
        from public.session_proposal_votes v
        where v.proposal_id = sp.id
          and v.voter_id = auth.uid()
      );
  end if;

  if v_player_count > 0 then
    select count(*)::integer
    into v_promising_date_count
    from (
      select
        a.availability_date,
        count(*) filter (where a.availability_mode in ('online', 'both')) as online_count,
        count(*) filter (where a.availability_mode in ('in_person', 'both')) as in_person_count
      from public.session_availability a
      join public.campaign_members cm
        on cm.campaign_id = a.campaign_id
       and cm.user_id = a.user_id
      where a.campaign_id = v_campaign_id
        and cm.role = 'player'
        and cm.is_active = true
        and cm.planning_enabled = true
        and a.availability_date between current_date and v_window_end
      group by a.availability_date
    ) scores
    where greatest(scores.online_count, scores.in_person_count) >= v_promising_threshold;
  end if;

  return jsonb_build_object(
    'player_count', v_player_count,
    'players_responded', v_players_responded,
    'missing_player_names', v_missing_player_names,
    'current_user_availability_days', v_current_user_availability_days,
    'current_user_has_availability', v_current_user_availability_days > 0,
    'open_proposal_count', v_open_proposal_count,
    'proposals_awaiting_vote', v_proposals_awaiting_vote,
    'promising_date_count', v_promising_date_count,
    'response_window_days', v_response_window_days
  );
end;
$function$;

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
    private.campaign_display_name(p_campaign_id, cm.user_id, 'Unnamed soul')::text,
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
  order by cm.counts_toward_campaign_progress desc, lower(private.campaign_display_name(p_campaign_id, cm.user_id, ''));
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_campaign_admin_members(p_campaign_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, email text, member_role text, planning_enabled boolean, counts_toward_progress boolean, is_test_account boolean, is_active boolean, joined_at timestamp with time zone, last_seen_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only a Game Master can view campaign members.';
  end if;

  return query
  select
    cm.user_id,
    coalesce(
      nullif(trim(cm.display_name), ''),
      nullif(trim(p.display_name), ''),
      nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(u.email, ''), '@', 1),
      'Unknown soul'
    ),
    u.email::text,
    cm.role,
    cm.planning_enabled,
    cm.counts_toward_campaign_progress,
    cm.is_test_account,
    cm.is_active,
    cm.joined_at,
    cm.last_seen_at
  from public.campaign_members cm
  join auth.users u on u.id = cm.user_id
  left join public.profiles p on p.id = cm.user_id
  where cm.campaign_id = p_campaign_id
  order by
    cm.is_active desc,
    case when cm.role = 'dm' then 0 else 1 end,
    lower(coalesce(nullif(trim(cm.display_name), ''), p.display_name, u.email, ''));
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_campaign_invites(p_campaign_id uuid)
 RETURNS TABLE(invite_id uuid, invite_label text, code_preview text, planning_enabled boolean, counts_toward_progress boolean, max_uses integer, uses_count integer, expires_at timestamp with time zone, is_active boolean, created_at timestamp with time zone, created_by_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only a Game Master can view invitations.';
  end if;

  return query
  select
    ci.id,
    ci.label,
    ci.code_preview,
    ci.planning_enabled,
    ci.counts_toward_campaign_progress,
    ci.max_uses,
    ci.uses_count,
    ci.expires_at,
    ci.is_active,
    ci.created_at,
    private.campaign_display_name(ci.campaign_id, ci.created_by, split_part(coalesce(u.email, ''), '@', 1))
  from public.campaign_invites ci
  left join auth.users u on u.id = ci.created_by
  left join public.profiles p on p.id = ci.created_by
  where ci.campaign_id = p_campaign_id
  order by ci.created_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_campaign_miniature_roster(p_campaign_id uuid)
 RETURNS TABLE(player_id uuid, display_name text, miniature_id uuid, storage_path text, original_name text, file_size_bytes bigint, triangle_count bigint, width_mm double precision, depth_mm double precision, height_mm double precision, miniature_created_at timestamp with time zone, web_storage_path text, web_file_size_bytes bigint, web_generated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not public.is_campaign_member(p_campaign_id) and not public.is_campaign_dm(p_campaign_id) then raise exception 'Campaign access required.'; end if;
  return query
  select cm.user_id,
    private.campaign_display_name(p_campaign_id, cm.user_id, 'Adventurer'),
    m.id, m.storage_path, m.original_name, m.file_size_bytes, m.triangle_count,
    m.width_mm, m.depth_mm, m.height_mm, m.created_at,
    m.web_storage_path, m.web_file_size_bytes, m.web_generated_at
  from public.campaign_members cm
  left join public.profiles p on p.id = cm.user_id
  left join public.character_miniatures m
    on m.campaign_id = cm.campaign_id and m.player_id = cm.user_id and m.is_current = true
  where cm.campaign_id = p_campaign_id and cm.role = 'player' and cm.is_active = true
  order by lower(private.campaign_display_name(p_campaign_id, cm.user_id, 'Adventurer'));
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_daggerheart_character_roster(p_campaign_id uuid)
 RETURNS TABLE(player_id uuid, display_name text, member_role text, character_id uuid, character_name text, character_level integer, character_class text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select private.is_active_daggerheart_campaign_member(p_campaign_id)) then
    raise exception 'Active Daggerheart campaign membership required';
  end if;
  return query
  select cm.user_id, private.campaign_display_name(p_campaign_id, cm.user_id, 'Unknown wanderer')::text, cm.role::text,
         dc.id, nullif(dc.name, '')::text, dc.level, dc.class_key::text
  from public.campaign_members cm
  join public.profiles p on p.id = cm.user_id
  left join public.daggerheart_characters dc
    on dc.campaign_id = cm.campaign_id and dc.player_id = cm.user_id and dc.is_active = true
  where cm.campaign_id = p_campaign_id
    and cm.is_active = true
    and cm.role = 'player'
    and (
      public.is_campaign_dm(p_campaign_id)
      or cm.user_id = (select auth.uid())
    )
  order by lower(private.campaign_display_name(p_campaign_id, cm.user_id, ''));
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_vtt_party_roster(p_scene_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, has_miniature boolean, included boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_campaign_id uuid;
  v_configured boolean;
  v_has_character_tokens boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select s.campaign_id, s.party_roster_configured
    into v_campaign_id, v_configured
  from public.vtt_scenes s
  where s.id = p_scene_id;

  if v_campaign_id is null then raise exception 'Scene not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Game Master access required.'; end if;

  select exists (
    select 1 from public.vtt_tokens t
    where t.scene_id = p_scene_id
      and t.character_miniature_id is not null
  ) into v_has_character_tokens;

  return query
  select
    cm.user_id,
    private.campaign_display_name(v_campaign_id, cm.user_id, 'Adventurer') as display_name,
    exists (
      select 1 from public.character_miniatures m
      where m.campaign_id = v_campaign_id
        and m.player_id = cm.user_id
        and m.is_current = true
    ) as has_miniature,
    case
      when v_configured then exists (
        select 1 from public.vtt_scene_party_members rpm
        where rpm.scene_id = p_scene_id
          and rpm.user_id = cm.user_id
      )
      when v_has_character_tokens then exists (
        select 1
        from public.vtt_tokens t
        join public.character_miniatures m on m.id = t.character_miniature_id
        where t.scene_id = p_scene_id
          and m.player_id = cm.user_id
      )
      else true
    end as included
  from public.campaign_members cm
  left join public.profiles p on p.id = cm.user_id
  where cm.campaign_id = v_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
  order by lower(private.campaign_display_name(v_campaign_id, cm.user_id, 'Adventurer')), cm.user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_campaign_dice_roll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resolved_user_id uuid;
  resolved_name text;
  resolved_system text;
begin
  resolved_user_id := auth.uid();

  if resolved_user_id is null then
    raise exception 'Authentication required';
  end if;

  resolved_name := private.campaign_display_name(new.campaign_id, resolved_user_id, 'Campaign member');

  select c.system_key
    into resolved_system
  from public.campaigns c
  where c.id = new.campaign_id
    and c.is_active = true;

  if resolved_system is null then
    raise exception 'Campaign not found or inactive';
  end if;

  new.user_id := resolved_user_id;
  new.roller_name := coalesce(resolved_name, 'Campaign member');
  new.system_key := resolved_system;
  new.created_at := coalesce(new.created_at, now());
  new.details := coalesce(new.details, '{}'::jsonb);

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_vtt_dice_roll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_campaign_id uuid;
  v_scene_active boolean;
  v_scene_visible boolean;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select s.campaign_id, s.is_active, s.visible_to_players
    into v_campaign_id, v_scene_active, v_scene_visible
  from public.vtt_scenes s
  where s.id = new.scene_id;

  if v_campaign_id is null then
    raise exception 'VTT scene not found';
  end if;

  if not public.is_campaign_dm(v_campaign_id) then
    if not v_scene_active or not v_scene_visible or not public.is_campaign_member(v_campaign_id) then
      raise exception 'VTT scene is not available to this campaign member';
    end if;
  end if;

  v_display_name := private.campaign_display_name(v_campaign_id, v_user_id, 'Campaign member');

  new.roller_id := v_user_id;
  new.roller_name := coalesce(v_display_name, 'Campaign member');
  new.created_at := now();
  new.details := coalesce(new.details, '{}'::jsonb);

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.seed_vtt_party(p_scene_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_campaign_id uuid;
  v_configured boolean;
  v_effective_user_ids uuid[] := '{}'::uuid[];
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select s.campaign_id, s.party_roster_configured
    into v_campaign_id, v_configured
  from public.vtt_scenes s
  where s.id = p_scene_id;

  if v_campaign_id is null then raise exception 'Scene not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then raise exception 'Game Master access required.'; end if;

  if v_configured then
    select coalesce(array_agg(rpm.user_id), '{}'::uuid[])
      into v_effective_user_ids
    from public.vtt_scene_party_members rpm
    where rpm.scene_id = p_scene_id;
  elsif exists (
    select 1 from public.vtt_tokens t
    where t.scene_id = p_scene_id
      and t.character_miniature_id is not null
  ) then
    select coalesce(array_agg(distinct m.player_id), '{}'::uuid[])
      into v_effective_user_ids
    from public.vtt_tokens t
    join public.character_miniatures m on m.id = t.character_miniature_id
    where t.scene_id = p_scene_id
      and t.character_miniature_id is not null;
  else
    select coalesce(array_agg(cm.user_id), '{}'::uuid[])
      into v_effective_user_ids
    from public.campaign_members cm
    where cm.campaign_id = v_campaign_id
      and cm.role = 'player'
      and cm.is_active = true
      and exists (
        select 1 from public.character_miniatures m
        where m.campaign_id = v_campaign_id
          and m.player_id = cm.user_id
          and m.is_current = true
      );
  end if;

  delete from public.vtt_tokens t
  using public.character_miniatures old_m
  where t.scene_id = p_scene_id
    and t.character_miniature_id = old_m.id
    and (
      not (old_m.player_id = any(v_effective_user_ids))
      or old_m.is_current = false
    );

  with party as (
    select
      m.id as miniature_id,
      private.campaign_display_name(v_campaign_id, cm.user_id, 'Adventurer') as display_name,
      row_number() over(order by lower(private.campaign_display_name(v_campaign_id, cm.user_id, 'Adventurer')), cm.user_id) as rn
    from public.campaign_members cm
    join public.character_miniatures m
      on m.campaign_id = cm.campaign_id
     and m.player_id = cm.user_id
     and m.is_current = true
    left join public.profiles p on p.id = cm.user_id
    where cm.campaign_id = v_campaign_id
      and cm.role = 'player'
      and cm.is_active = true
      and cm.user_id = any(v_effective_user_ids)
  ), inserted as (
    insert into public.vtt_tokens(
      scene_id, character_miniature_id, name, x, z, visible_to_players, created_by
    )
    select
      p_scene_id,
      miniature_id,
      display_name,
      (rn - 3) * 2,
      6,
      true,
      auth.uid()
    from party
    on conflict (scene_id, character_miniature_id)
      where character_miniature_id is not null
    do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_campaign_member_admin(p_campaign_id uuid, p_user_id uuid, p_role text, p_planning_enabled boolean, p_counts_toward_progress boolean, p_is_test_account boolean, p_is_active boolean, p_display_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current public.campaign_members%rowtype;
  v_other_active_dms integer;
  v_display_name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only a Game Master can edit campaign members.';
  end if;

  if p_role not in ('dm', 'player') then
    raise exception 'Invalid campaign role.';
  end if;

  if v_display_name is null then
    raise exception 'Campaign display name cannot be empty.';
  end if;

  if char_length(v_display_name) > 80 then
    raise exception 'Campaign display name must be 80 characters or fewer.';
  end if;

  select cm.* into v_current
  from public.campaign_members cm
  where cm.campaign_id = p_campaign_id
    and cm.user_id = p_user_id
  for update;

  if v_current.user_id is null then
    raise exception 'Campaign member not found.';
  end if;

  if v_current.role = 'dm' and v_current.is_active = true
     and (p_role <> 'dm' or p_is_active = false) then
    select count(*) into v_other_active_dms
    from public.campaign_members cm
    where cm.campaign_id = p_campaign_id
      and cm.user_id <> p_user_id
      and cm.role = 'dm'
      and cm.is_active = true;

    if v_other_active_dms = 0 then
      raise exception 'A campaign must keep at least one active Game Master.';
    end if;
  end if;

  update public.campaign_members
  set display_name = v_display_name,
      role = p_role,
      planning_enabled = coalesce(p_planning_enabled, true),
      counts_toward_campaign_progress = coalesce(p_counts_toward_progress, true),
      is_test_account = coalesce(p_is_test_account, false),
      is_active = coalesce(p_is_active, true),
      updated_at = now()
  where campaign_id = p_campaign_id
    and user_id = p_user_id;
end;
$function$;

drop trigger if exists campaign_members_default_display_name
  on public.campaign_members;

create trigger campaign_members_default_display_name
before insert on public.campaign_members
for each row
execute function private.ensure_campaign_member_display_name();

revoke all on function public.update_campaign_member_admin(
  uuid, uuid, text, boolean, boolean, boolean, boolean
) from public, anon;

revoke all on function public.update_campaign_member_admin(
  uuid, uuid, text, boolean, boolean, boolean, boolean, text
) from public, anon;

grant execute on function public.update_campaign_member_admin(
  uuid, uuid, text, boolean, boolean, boolean, boolean
) to authenticated;

grant execute on function public.update_campaign_member_admin(
  uuid, uuid, text, boolean, boolean, boolean, boolean, text
) to authenticated;

commit;
