-- NATTAU COMMAND - SESSION PLANNER PARTICIPATION FILTER V1
-- Run once in Supabase SQL Editor after the existing Session Planner migrations.
-- Adds a reusable profile flag and excludes disabled players from planner totals.

alter table public.profiles
  add column if not exists planning_enabled boolean not null default true;

comment on column public.profiles.planning_enabled is
  'When false, the profile may still sign in and test the planner UI, but is excluded from player totals, availability rankings and counted proposal votes.';

create index if not exists profiles_planning_enabled_role_idx
  on public.profiles (role, planning_enabled);

-- Pippo is the current test player and should not affect campaign planning.
-- This update is intentionally based on the visible display name so it works
-- without requiring the test account UUID or email address.
update public.profiles
set planning_enabled = false
where lower(trim(coalesce(display_name, ''))) = 'pippo';

create or replace function public.get_session_planner_data(
  p_month_start date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month_start date;
  v_month_end date;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to open the Session Planner.';
  end if;

  v_month_start := date_trunc('month', coalesce(p_month_start, current_date))::date;
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;

  select coalesce(role, 'player')
  into v_role
  from public.profiles
  where id = auth.uid();

  return jsonb_build_object(
    'month_start', v_month_start,
    'month_end', v_month_end,
    'current_user_id', auth.uid(),
    'current_user_role', coalesce(v_role, 'player'),
    'members', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'display_name', coalesce(nullif(trim(p.display_name), ''), 'Expedition Member'),
            'role', coalesce(p.role, 'player'),
            'planning_enabled', case
              when p.role = 'dm' then true
              else coalesce(p.planning_enabled, true)
            end
          )
          order by
            case when p.role = 'dm' then 0 else 1 end,
            coalesce(nullif(trim(p.display_name), ''), 'Expedition Member')
        )
        from public.profiles p
        where p.role in ('dm', 'player')
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
        where a.availability_date between v_month_start and v_month_end
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
            'created_by_name', coalesce(nullif(trim(creator.display_name), ''), 'Game Master'),
            'created_at', sp.created_at,
            'updated_at', sp.updated_at,
            'confirmed_at', sp.confirmed_at,
            'votes', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'voter_id', v.voter_id,
                    'voter_name', coalesce(nullif(trim(voter.display_name), ''), 'Expedition Member'),
                    'vote', v.vote,
                    'updated_at', v.updated_at
                  )
                  order by coalesce(nullif(trim(voter.display_name), ''), 'Expedition Member')
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
        where sp.proposed_date between v_month_start and v_month_end
          and sp.status in ('voting', 'confirmed')
      ),
      '[]'::jsonb
    )
  );
end;
$$;

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
  where role = 'player'
    and coalesce(planning_enabled, true) = true;

  v_promising_threshold := greatest(
    1,
    ceil(v_player_count * 0.75)::integer
  );

  select count(distinct a.user_id)::integer
  into v_players_responded
  from public.session_availability a
  join public.profiles p on p.id = a.user_id
  where p.role = 'player'
    and coalesce(p.planning_enabled, true) = true
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
      and coalesce(p.planning_enabled, true) = true
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
        and coalesce(p.planning_enabled, true) = true
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

revoke all on function public.get_session_planner_data(date) from public;
revoke all on function public.get_session_planner_home_summary() from public;

grant execute on function public.get_session_planner_data(date) to authenticated;
grant execute on function public.get_session_planner_home_summary() to authenticated;
