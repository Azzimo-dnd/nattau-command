-- NATTAU COMMAND - SESSION PLANNER V1
-- Run once in Supabase SQL Editor.
-- Requires the existing public.profiles table.
-- Confirming a proposal also requires campaign_session_settings from Session Controls.

create extension if not exists pgcrypto;

create table if not exists public.session_availability (
  user_id uuid not null references public.profiles(id) on delete cascade,
  availability_date date not null,
  availability_mode text not null check (
    availability_mode in ('online', 'in_person', 'both', 'unavailable')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, availability_date)
);

create table if not exists public.session_proposals (
  id uuid primary key default gen_random_uuid(),
  proposed_date date not null,
  session_mode text not null check (session_mode in ('online', 'in_person')),
  message text,
  status text not null default 'voting' check (
    status in ('voting', 'confirmed', 'cancelled')
  ),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint session_proposals_message_length_check check (
    message is null or char_length(message) <= 280
  )
);

create table if not exists public.session_proposal_votes (
  proposal_id uuid not null references public.session_proposals(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (proposal_id, voter_id)
);

create index if not exists session_availability_date_idx
  on public.session_availability (availability_date);

create index if not exists session_proposals_date_idx
  on public.session_proposals (proposed_date, status);

create index if not exists session_proposal_votes_proposal_idx
  on public.session_proposal_votes (proposal_id);

create unique index if not exists session_proposals_one_open_mode_per_day_idx
  on public.session_proposals (proposed_date, session_mode)
  where status = 'voting';

create or replace function public.is_session_planner_dm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'dm'
  );
$$;

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
            'role', coalesce(p.role, 'player')
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

create or replace function public.set_session_availability(
  p_dates date[],
  p_mode text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update availability.';
  end if;

  if p_dates is null or coalesce(array_length(p_dates, 1), 0) = 0 then
    raise exception 'Choose at least one date.';
  end if;

  if array_length(p_dates, 1) > 62 then
    raise exception 'You may update at most 62 dates in one action.';
  end if;

  if p_mode not in ('online', 'in_person', 'both', 'unavailable', 'erase') then
    raise exception 'Unknown availability mode.';
  end if;

  if exists (
    select 1
    from unnest(p_dates) as selected_dates(selected_date)
    where selected_date < current_date - 31
       or selected_date > current_date + 400
  ) then
    raise exception 'Availability may only be edited from 31 days ago through 400 days ahead.';
  end if;

  if p_mode = 'erase' then
    delete from public.session_availability
    where user_id = auth.uid()
      and availability_date in (
        select distinct selected_date
        from unnest(p_dates) as selected_dates(selected_date)
      );

    get diagnostics v_changed = row_count;
    return v_changed;
  end if;

  insert into public.session_availability (
    user_id,
    availability_date,
    availability_mode,
    created_at,
    updated_at
  )
  select
    auth.uid(),
    selected_date,
    p_mode,
    now(),
    now()
  from (
    select distinct selected_date
    from unnest(p_dates) as selected_dates(selected_date)
  ) dates
  on conflict (user_id, availability_date) do update
  set
    availability_mode = excluded.availability_mode,
    updated_at = now();

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

create or replace function public.create_session_proposal(
  p_date date,
  p_mode text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a proposal.';
  end if;

  if not public.is_session_planner_dm() then
    raise exception 'Only the Game Master may propose a session date.';
  end if;

  if p_date is null or p_date < current_date then
    raise exception 'The proposed date must be today or later.';
  end if;

  if p_date > current_date + 400 then
    raise exception 'The proposed date is too far in the future.';
  end if;

  if p_mode not in ('online', 'in_person') then
    raise exception 'Session mode must be online or in_person.';
  end if;

  insert into public.session_proposals (
    proposed_date,
    session_mode,
    message,
    status,
    created_by,
    created_at,
    updated_at
  )
  values (
    p_date,
    p_mode,
    nullif(left(trim(coalesce(p_message, '')), 280), ''),
    'voting',
    auth.uid(),
    now(),
    now()
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'This date and session mode are already open for voting.';
end;
$$;

create or replace function public.cast_session_proposal_vote(
  p_proposal_id uuid,
  p_vote text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if public.is_session_planner_dm() then
    raise exception 'The Game Master closes the vote and does not cast a player vote.';
  end if;

  if p_vote not in ('yes', 'maybe', 'no') then
    raise exception 'Vote must be yes, maybe or no.';
  end if;

  if not exists (
    select 1
    from public.session_proposals
    where id = p_proposal_id
      and status = 'voting'
  ) then
    raise exception 'This proposal is no longer open for voting.';
  end if;

  insert into public.session_proposal_votes (
    proposal_id,
    voter_id,
    vote,
    created_at,
    updated_at
  )
  values (
    p_proposal_id,
    auth.uid(),
    p_vote,
    now(),
    now()
  )
  on conflict (proposal_id, voter_id) do update
  set
    vote = excluded.vote,
    updated_at = now();
end;
$$;

create or replace function public.remove_session_proposal_vote(
  p_proposal_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to remove a vote.';
  end if;

  delete from public.session_proposal_votes
  where proposal_id = p_proposal_id
    and voter_id = auth.uid();
end;
$$;

create or replace function public.cancel_session_proposal(
  p_proposal_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_session_planner_dm() then
    raise exception 'Only the Game Master may cancel a proposal.';
  end if;

  update public.session_proposals
  set
    status = 'cancelled',
    updated_at = now()
  where id = p_proposal_id
    and status = 'voting';

  if not found then
    raise exception 'The proposal is no longer open.';
  end if;
end;
$$;

create or replace function public.confirm_session_proposal(
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.session_proposals%rowtype;
  v_next_session_at timestamptz;
  v_mode_label text;
  v_message text;
begin
  if not public.is_session_planner_dm() then
    raise exception 'Only the Game Master may confirm a session proposal.';
  end if;

  if to_regclass('public.campaign_session_settings') is null then
    raise exception 'Session Controls must be installed before confirming a proposal.';
  end if;

  select *
  into v_proposal
  from public.session_proposals
  where id = p_proposal_id
    and status = 'voting'
  for update;

  if not found then
    raise exception 'The proposal is no longer open.';
  end if;

  -- Availability remains date-only. Confirmation publishes the usual campaign
  -- start time of 19:00 in Europe/Warsaw. It can still be adjusted afterwards
  -- from the existing GM Session Controls page.
  v_next_session_at :=
    (v_proposal.proposed_date + time '19:00') at time zone 'Europe/Warsaw';

  if v_next_session_at <= now() then
    raise exception 'The selected session date is already in the past.';
  end if;

  v_mode_label := case
    when v_proposal.session_mode = 'online' then 'Online session'
    else 'In-person session'
  end;

  v_message := coalesce(
    nullif(trim(v_proposal.message), ''),
    v_mode_label || ' confirmed through Session Planner.'
  );

  update public.session_proposals
  set
    status = 'cancelled',
    updated_at = now()
  where status = 'voting'
    and id <> v_proposal.id;

  update public.session_proposals
  set
    status = 'confirmed',
    confirmed_at = now(),
    updated_at = now()
  where id = v_proposal.id;

  insert into public.campaign_session_settings (
    id,
    status,
    next_session_at,
    message,
    updated_at,
    updated_by
  )
  values (
    1,
    'scheduled',
    v_next_session_at,
    left(v_message, 280),
    now(),
    auth.uid()
  )
  on conflict (id) do update
  set
    status = excluded.status,
    next_session_at = excluded.next_session_at,
    message = excluded.message,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  return jsonb_build_object(
    'proposal_id', v_proposal.id,
    'next_session_at', v_next_session_at,
    'session_mode', v_proposal.session_mode
  );
end;
$$;

alter table public.session_availability enable row level security;
alter table public.session_proposals enable row level security;
alter table public.session_proposal_votes enable row level security;

revoke all on table public.session_availability from anon, authenticated;
revoke all on table public.session_proposals from anon, authenticated;
revoke all on table public.session_proposal_votes from anon, authenticated;

revoke all on function public.is_session_planner_dm() from public;
revoke all on function public.get_session_planner_data(date) from public;
revoke all on function public.set_session_availability(date[], text) from public;
revoke all on function public.create_session_proposal(date, text, text) from public;
revoke all on function public.cast_session_proposal_vote(uuid, text) from public;
revoke all on function public.remove_session_proposal_vote(uuid) from public;
revoke all on function public.cancel_session_proposal(uuid) from public;
revoke all on function public.confirm_session_proposal(uuid) from public;

grant execute on function public.is_session_planner_dm() to authenticated;
grant execute on function public.get_session_planner_data(date) to authenticated;
grant execute on function public.set_session_availability(date[], text) to authenticated;
grant execute on function public.create_session_proposal(date, text, text) to authenticated;
grant execute on function public.cast_session_proposal_vote(uuid, text) to authenticated;
grant execute on function public.remove_session_proposal_vote(uuid) to authenticated;
grant execute on function public.cancel_session_proposal(uuid) to authenticated;
grant execute on function public.confirm_session_proposal(uuid) to authenticated;
