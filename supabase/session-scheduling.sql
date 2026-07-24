-- NATTAU COMMAND - SESSION SCHEDULING V1
-- Run this migration once in the Supabase SQL Editor.
-- It creates one global session announcement editable only by a DM profile.

create table if not exists public.campaign_session_settings (
  id smallint primary key default 1 check (id = 1),
  status text not null default 'tba' check (status in ('scheduled', 'tba')),
  next_session_at timestamptz,
  message text not null default 'The next session has not yet been announced.',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint campaign_session_settings_state_check check (
    (status = 'scheduled' and next_session_at is not null)
    or
    (status = 'tba' and next_session_at is null)
  ),
  constraint campaign_session_settings_message_length_check check (
    char_length(message) <= 280
  )
);

insert into public.campaign_session_settings (
  id,
  status,
  next_session_at,
  message,
  updated_by
)
values (
  1,
  'tba',
  null,
  'The next session has not yet been announced.',
  null
)
on conflict (id) do nothing;

create or replace function public.is_session_dm()
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

create or replace function public.set_campaign_session(
  p_status text,
  p_next_session_at timestamptz default null,
  p_message text default null
)
returns public.campaign_session_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
  v_row public.campaign_session_settings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update the session announcement.';
  end if;

  if not public.is_session_dm() then
    raise exception 'Only the Game Master may update the session announcement.';
  end if;

  if p_status not in ('scheduled', 'tba') then
    raise exception 'Session status must be scheduled or tba.';
  end if;

  if p_status = 'scheduled' then
    if p_next_session_at is null then
      raise exception 'A date and time are required for a scheduled session.';
    end if;

    if p_next_session_at < now() - interval '5 minutes' then
      raise exception 'The next session date must be in the future.';
    end if;

    v_message := left(coalesce(trim(p_message), ''), 280);
  else
    v_message := left(
      coalesce(
        nullif(trim(p_message), ''),
        'The next session has not yet been announced.'
      ),
      280
    );
  end if;

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
    p_status,
    case when p_status = 'scheduled' then p_next_session_at else null end,
    v_message,
    now(),
    auth.uid()
  )
  on conflict (id) do update
  set
    status = excluded.status,
    next_session_at = excluded.next_session_at,
    message = excluded.message,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning * into v_row;

  return v_row;
end;
$$;

alter table public.campaign_session_settings enable row level security;

revoke all on table public.campaign_session_settings from anon;
revoke insert, update, delete on table public.campaign_session_settings from authenticated;
grant select on table public.campaign_session_settings to authenticated;

revoke all on function public.is_session_dm() from public;
grant execute on function public.is_session_dm() to authenticated;

revoke all on function public.set_campaign_session(text, timestamptz, text) from public;
grant execute on function public.set_campaign_session(text, timestamptz, text) to authenticated;

drop policy if exists campaign_session_settings_authenticated_read
  on public.campaign_session_settings;

create policy campaign_session_settings_authenticated_read
on public.campaign_session_settings
for select
to authenticated
using (true);
