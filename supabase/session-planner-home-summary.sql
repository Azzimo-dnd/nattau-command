-- NATTAU COMMAND - SESSION PLANNER HOME SUMMARY V1
-- Run after the original session-planner.sql migration.
-- Adds a safe authenticated RPC used by the Command Center.

create or replace function public.get_session_planner_home_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
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

  v_window_end := current_date + v_response_window_days;

  select coalesce(role, 'player')
  into v_role
  from public.profiles
  where id = auth.uid();

  select count(*)::integer
  into v_player_count
  from public.profiles
  where role = 'player';

  v_promising_threshold := greatest(
    1,
    ceil(v_player_count * 0.75)::integer
  );

  select count(distinct a.user_id)::integer
  into v_players_responded
  from public.session_availability a
  join public.profiles p on p.id = a.user_id
  where p.role = 'player'
    and a.availability_date between current_date and v_window_end;

  select coalesce(
    jsonb_agg(player_name order by player_name),
    '[]'::jsonb
  )
  into v_missing_player_names
  from (
    select coalesce(
      nullif(trim(p.display_name), ''),
      'Expedition Member'
    ) as player_name
    from public.profiles p
    where p.role = 'player'
      and not exists (
        select 1
        from public.session_availability a
        where a.user_id = p.id
          and a.availability_date between current_date and v_window_end
      )
  ) missing_players;

  select count(*)::integer
  into v_current_user_availability_days
  from public.session_availability a
  where a.user_id = auth.uid()
    and a.availability_date between current_date and v_window_end;

  select count(*)::integer
  into v_open_proposal_count
  from public.session_proposals sp
  where sp.status = 'voting'
    and sp.proposed_date >= current_date;

  if v_role = 'player' then
    select count(*)::integer
    into v_proposals_awaiting_vote
    from public.session_proposals sp
    where sp.status = 'voting'
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
        count(*) filter (
          where a.availability_mode in ('online', 'both')
        ) as online_count,
        count(*) filter (
          where a.availability_mode in ('in_person', 'both')
        ) as in_person_count
      from public.session_availability a
      join public.profiles p on p.id = a.user_id
      where p.role = 'player'
        and a.availability_date between current_date and v_window_end
      group by a.availability_date
    ) scores
    where greatest(scores.online_count, scores.in_person_count) >=
      v_promising_threshold;
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
$$;

revoke all on function public.get_session_planner_home_summary() from public;
grant execute on function public.get_session_planner_home_summary() to authenticated;
