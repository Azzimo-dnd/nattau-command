-- Nattau Command - Session Planner past-date protection
-- Run this once in Supabase SQL Editor after the original session-planner.sql.
-- It replaces only the availability RPC. Existing data is preserved.

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
    where selected_date > current_date + 400
  ) then
    raise exception 'Availability may only be edited up to 400 days ahead.';
  end if;

  -- Past dates may be erased for cleanup, but no new or changed
  -- availability can be written for them.
  if p_mode <> 'erase' and exists (
    select 1
    from unnest(p_dates) as selected_dates(selected_date)
    where selected_date < current_date
  ) then
    raise exception 'Past dates cannot be changed.';
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

grant execute on function public.set_session_availability(date[], text)
  to authenticated;
