-- ============================================================
-- Campaign Companion — Multi-Campaign Session Planner v1
--
-- Run after:
--   1. the original Session Planner migrations;
--   2. supabase/multi-campaign-foundation.sql.
--
-- What this migration does:
--   * assigns all existing planner data to Nattau;
--   * separates availability and proposals by campaign_id;
--   * makes planner roles and planning_enabled campaign-specific;
--   * enables a fully independent Barovia planner;
--   * keeps Pippo usable as a test player while excluding him from totals;
--   * blocks editing dates in the past;
--   * replaces the old single-campaign RPC functions.
--
-- Confirming a proposal marks it as the chosen campaign date and closes
-- other open proposals in that campaign. It does not yet update the old,
-- global Nattau Session Controls record; that becomes campaign-specific in
-- the next Session Controls migration.
-- ============================================================

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.campaigns') is null
     or to_regclass('public.campaign_members') is null then
    raise exception 'Run supabase/multi-campaign-foundation.sql before this migration.';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- Tables: create when missing, then migrate existing Nattau data.
-- ------------------------------------------------------------
create table if not exists public.session_availability (
  campaign_id uuid references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  availability_date date not null,
  availability_mode text not null check (
    availability_mode in ('online', 'in_person', 'both', 'unavailable')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.session_availability
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade;

update public.session_availability a
set campaign_id = c.id
from public.campaigns c
where a.campaign_id is null
  and c.slug = 'nattau';

alter table public.session_availability
  alter column campaign_id set not null;

do $$
declare
  v_constraint name;
begin
  select conname
  into v_constraint
  from pg_constraint
  where conrelid = 'public.session_availability'::regclass
    and contype = 'p';

  if v_constraint is not null then
    execute format(
      'alter table public.session_availability drop constraint %I',
      v_constraint
    );
  end if;
end;
$$;

alter table public.session_availability
  add constraint session_availability_pkey
  primary key (campaign_id, user_id, availability_date);

create table if not exists public.session_proposals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
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

alter table public.session_proposals
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade;

update public.session_proposals sp
set campaign_id = c.id
from public.campaigns c
where sp.campaign_id is null
  and c.slug = 'nattau';

alter table public.session_proposals
  alter column campaign_id set not null;

create table if not exists public.session_proposal_votes (
  proposal_id uuid not null references public.session_proposals(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (proposal_id, voter_id)
);

drop index if exists public.session_proposals_one_open_mode_per_day_idx;

create unique index if not exists session_proposals_campaign_open_mode_day_idx
  on public.session_proposals (campaign_id, proposed_date, session_mode)
  where status = 'voting';

create index if not exists session_availability_campaign_date_idx
  on public.session_availability (campaign_id, availability_date);

create index if not exists session_proposals_campaign_date_idx
  on public.session_proposals (campaign_id, proposed_date, status);

create index if not exists session_proposal_votes_proposal_idx
  on public.session_proposal_votes (proposal_id);

alter table public.session_availability enable row level security;
alter table public.session_proposals enable row level security;
alter table public.session_proposal_votes enable row level security;

revoke all on table public.session_availability from anon, authenticated;
revoke all on table public.session_proposals from anon, authenticated;
revoke all on table public.session_proposal_votes from anon, authenticated;

-- ------------------------------------------------------------
-- Remove the old global RPC surface so it cannot bypass campaign access.
-- ------------------------------------------------------------
drop function if exists public.is_session_planner_dm();
drop function if exists public.get_session_planner_data(date);
drop function if exists public.set_session_availability(date[], text);
drop function if exists public.create_session_proposal(date, text, text);
drop function if exists public.cast_session_proposal_vote(uuid, text);
drop function if exists public.remove_session_proposal_vote(uuid);
drop function if exists public.cancel_session_proposal(uuid);
drop function if exists public.confirm_session_proposal(uuid);

-- ------------------------------------------------------------
-- Campaign-specific helper.
-- ------------------------------------------------------------
create or replace function public.is_session_planner_dm(
  p_campaign_slug text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members cm
    join public.campaigns c on c.id = cm.campaign_id
    where c.slug = lower(trim(p_campaign_slug))
      and c.is_active = true
      and cm.user_id = auth.uid()
      and cm.role = 'dm'
      and cm.is_active = true
  );
$$;

-- ------------------------------------------------------------
-- Full planner payload for one campaign and one month.
-- ------------------------------------------------------------
create or replace function public.get_session_planner_data(
  p_campaign_slug text,
  p_month_start date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
            coalesce(nullif(trim(p.display_name), ''), 'Campaign Member')
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
            'created_by_name', coalesce(nullif(trim(creator.display_name), ''), 'Game Master'),
            'created_at', sp.created_at,
            'updated_at', sp.updated_at,
            'confirmed_at', sp.confirmed_at,
            'votes', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'voter_id', v.voter_id,
                    'voter_name', coalesce(nullif(trim(voter.display_name), ''), 'Campaign Member'),
                    'vote', v.vote,
                    'updated_at', v.updated_at
                  )
                  order by coalesce(nullif(trim(voter.display_name), ''), 'Campaign Member')
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
$$;

-- ------------------------------------------------------------
-- Availability writes. Test members may save data, but their membership
-- planning_enabled flag keeps those rows out of totals in the UI and summary.
-- ------------------------------------------------------------
create or replace function public.set_session_availability(
  p_campaign_slug text,
  p_dates date[],
  p_mode text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_changed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update availability.';
  end if;

  select c.id
  into v_campaign_id
  from public.campaigns c
  join public.campaign_members cm on cm.campaign_id = c.id
  where c.slug = lower(trim(p_campaign_slug))
    and c.is_active = true
    and cm.user_id = auth.uid()
    and cm.is_active = true;

  if not found then
    raise exception 'You do not have access to this campaign.';
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
    where selected_date > current_date + 400
  ) then
    raise exception 'Availability may only be edited up to 400 days ahead.';
  end if;

  if p_mode <> 'erase' and exists (
    select 1
    from unnest(p_dates) as selected_dates(selected_date)
    where selected_date < current_date
  ) then
    raise exception 'Past dates cannot be changed.';
  end if;

  if p_mode = 'erase' then
    delete from public.session_availability
    where campaign_id = v_campaign_id
      and user_id = auth.uid()
      and availability_date in (
        select distinct selected_date
        from unnest(p_dates) as selected_dates(selected_date)
      );

    get diagnostics v_changed = row_count;
    return v_changed;
  end if;

  insert into public.session_availability (
    campaign_id,
    user_id,
    availability_date,
    availability_mode,
    created_at,
    updated_at
  )
  select
    v_campaign_id,
    auth.uid(),
    selected_date,
    p_mode,
    now(),
    now()
  from (
    select distinct selected_date
    from unnest(p_dates) as selected_dates(selected_date)
  ) dates
  on conflict (campaign_id, user_id, availability_date) do update
  set
    availability_mode = excluded.availability_mode,
    updated_at = now();

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

create or replace function public.create_session_proposal(
  p_campaign_slug text,
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
  v_campaign_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a proposal.';
  end if;

  select c.id
  into v_campaign_id
  from public.campaigns c
  where c.slug = lower(trim(p_campaign_slug))
    and c.is_active = true;

  if v_campaign_id is null or not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Only this campaign''s Game Master may propose a session date.';
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
    campaign_id,
    proposed_date,
    session_mode,
    message,
    status,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_campaign_id,
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
    raise exception 'This date and session mode are already open for voting in this campaign.';
end;
$$;

create or replace function public.cast_session_proposal_vote(
  p_campaign_slug text,
  p_proposal_id uuid,
  p_vote text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to vote.';
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

  if v_role = 'dm' then
    raise exception 'The Game Master closes the vote and does not cast a player vote.';
  end if;

  if p_vote not in ('yes', 'maybe', 'no') then
    raise exception 'Vote must be yes, maybe or no.';
  end if;

  if not exists (
    select 1
    from public.session_proposals
    where id = p_proposal_id
      and campaign_id = v_campaign_id
      and status = 'voting'
  ) then
    raise exception 'This proposal is not open in the selected campaign.';
  end if;

  insert into public.session_proposal_votes (
    proposal_id,
    voter_id,
    vote,
    created_at,
    updated_at
  )
  values (p_proposal_id, auth.uid(), p_vote, now(), now())
  on conflict (proposal_id, voter_id) do update
  set vote = excluded.vote,
      updated_at = now();
end;
$$;

create or replace function public.remove_session_proposal_vote(
  p_campaign_slug text,
  p_proposal_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select c.id
  into v_campaign_id
  from public.campaigns c
  join public.campaign_members cm on cm.campaign_id = c.id
  where c.slug = lower(trim(p_campaign_slug))
    and cm.user_id = auth.uid()
    and cm.is_active = true;

  if not found then
    raise exception 'You do not have access to this campaign.';
  end if;

  delete from public.session_proposal_votes v
  using public.session_proposals sp
  where v.proposal_id = p_proposal_id
    and v.voter_id = auth.uid()
    and sp.id = v.proposal_id
    and sp.campaign_id = v_campaign_id;
end;
$$;

create or replace function public.cancel_session_proposal(
  p_campaign_slug text,
  p_proposal_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select id
  into v_campaign_id
  from public.campaigns
  where slug = lower(trim(p_campaign_slug))
    and is_active = true;

  if v_campaign_id is null or not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Only this campaign''s Game Master may cancel a proposal.';
  end if;

  update public.session_proposals
  set status = 'cancelled',
      updated_at = now()
  where id = p_proposal_id
    and campaign_id = v_campaign_id
    and status = 'voting';

  if not found then
    raise exception 'The proposal is no longer open in this campaign.';
  end if;
end;
$$;

create or replace function public.confirm_session_proposal(
  p_campaign_slug text,
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_proposal public.session_proposals%rowtype;
begin
  select id
  into v_campaign_id
  from public.campaigns
  where slug = lower(trim(p_campaign_slug))
    and is_active = true;

  if v_campaign_id is null or not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Only this campaign''s Game Master may confirm a proposal.';
  end if;

  select *
  into v_proposal
  from public.session_proposals
  where id = p_proposal_id
    and campaign_id = v_campaign_id
    and status = 'voting'
  for update;

  if not found then
    raise exception 'The proposal is no longer open in this campaign.';
  end if;

  if v_proposal.proposed_date < current_date then
    raise exception 'The selected session date is already in the past.';
  end if;

  update public.session_proposals
  set status = 'cancelled',
      updated_at = now()
  where campaign_id = v_campaign_id
    and status = 'voting'
    and id <> v_proposal.id;

  update public.session_proposals
  set status = 'confirmed',
      confirmed_at = now(),
      updated_at = now()
  where id = v_proposal.id;

  return jsonb_build_object(
    'campaign_id', v_campaign_id,
    'proposal_id', v_proposal.id,
    'proposed_date', v_proposal.proposed_date,
    'session_mode', v_proposal.session_mode
  );
end;
$$;

-- ------------------------------------------------------------
-- Reusable campaign summary plus a no-argument Nattau wrapper retained for
-- the existing Nattau Command home page.
-- ------------------------------------------------------------
create or replace function public.get_session_planner_home_summary(
  p_campaign_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
    select coalesce(nullif(trim(p.display_name), ''), 'Campaign Member') as player_name
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
$$;

create or replace function public.get_session_planner_home_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.get_session_planner_home_summary('nattau');
$$;

-- ------------------------------------------------------------
-- Execute permissions: RPC only, no direct table access.
-- ------------------------------------------------------------
revoke all on function public.is_session_planner_dm(text) from public;
revoke all on function public.get_session_planner_data(text, date) from public;
revoke all on function public.set_session_availability(text, date[], text) from public;
revoke all on function public.create_session_proposal(text, date, text, text) from public;
revoke all on function public.cast_session_proposal_vote(text, uuid, text) from public;
revoke all on function public.remove_session_proposal_vote(text, uuid) from public;
revoke all on function public.cancel_session_proposal(text, uuid) from public;
revoke all on function public.confirm_session_proposal(text, uuid) from public;
revoke all on function public.get_session_planner_home_summary(text) from public;
revoke all on function public.get_session_planner_home_summary() from public;

grant execute on function public.is_session_planner_dm(text) to authenticated;
grant execute on function public.get_session_planner_data(text, date) to authenticated;
grant execute on function public.set_session_availability(text, date[], text) to authenticated;
grant execute on function public.create_session_proposal(text, date, text, text) to authenticated;
grant execute on function public.cast_session_proposal_vote(text, uuid, text) to authenticated;
grant execute on function public.remove_session_proposal_vote(text, uuid) to authenticated;
grant execute on function public.cancel_session_proposal(text, uuid) to authenticated;
grant execute on function public.confirm_session_proposal(text, uuid) to authenticated;
grant execute on function public.get_session_planner_home_summary(text) to authenticated;
grant execute on function public.get_session_planner_home_summary() to authenticated;

commit;

-- ------------------------------------------------------------
-- Verification output.
-- Existing rows should appear under nattau; barovia starts empty.
-- ------------------------------------------------------------
select
  c.slug,
  count(distinct a.user_id) as users_with_availability,
  count(distinct sp.id) as proposals
from public.campaigns c
left join public.session_availability a on a.campaign_id = c.id
left join public.session_proposals sp on sp.campaign_id = c.id
group by c.slug, c.sort_order
order by c.sort_order;
