-- Nattau Command: campaign-specific session controls + Azzimo debuffs
-- Apply this migration immediately before deploying the matching application patch.
-- It migrates the legacy global id=1 session row to the Nattau campaign without
-- hard-coding the campaign UUID.

begin;

-- Fail early if the multi-campaign foundation is not present.
do $$
begin
  if to_regclass('public.campaigns') is null then
    raise exception 'public.campaigns is missing. Apply the multi-campaign foundation first.';
  end if;

  if to_regclass('public.campaign_members') is null then
    raise exception 'public.campaign_members is missing. Apply the multi-campaign foundation first.';
  end if;

  if to_regclass('public.campaign_session_settings') is null then
    raise exception 'public.campaign_session_settings is missing. Apply the original session scheduling schema first.';
  end if;

  if to_regprocedure('public.is_campaign_dm(uuid)') is null then
    raise exception 'public.is_campaign_dm(uuid) is missing.';
  end if;

  if to_regprocedure('public.is_campaign_member(uuid)') is null then
    raise exception 'public.is_campaign_member(uuid) is missing.';
  end if;
end;
$$;

-- Drop the legacy RPC before changing the table row type it returns.
drop function if exists public.set_campaign_session(text, timestamptz, text);

alter table public.campaign_session_settings
  add column if not exists campaign_id uuid,
  add column if not exists debuffs text[] not null default '{}'::text[];

-- Preserve the existing global session announcement as Nattau's announcement.
update public.campaign_session_settings settings
set campaign_id = campaign.id
from public.campaigns campaign
where campaign.slug = 'nattau'
  and settings.campaign_id is null;

do $$
begin
  if not exists (
    select 1
    from public.campaigns
    where slug = 'nattau'
      and is_active = true
  ) then
    raise exception 'Active Nattau campaign (slug=nattau) was not found.';
  end if;

  if exists (
    select 1
    from public.campaign_session_settings
    where campaign_id is null
  ) then
    raise exception 'Could not map every existing session settings row to a campaign.';
  end if;
end;
$$;

alter table public.campaign_session_settings
  alter column campaign_id set not null;

alter table public.campaign_session_settings
  drop constraint if exists campaign_session_settings_pkey,
  drop constraint if exists campaign_session_settings_id_check,
  drop constraint if exists campaign_session_settings_campaign_id_fkey;

alter table public.campaign_session_settings
  drop column if exists id;

alter table public.campaign_session_settings
  add constraint campaign_session_settings_pkey primary key (campaign_id),
  add constraint campaign_session_settings_campaign_id_fkey
    foreign key (campaign_id)
    references public.campaigns(id)
    on delete cascade;

-- Keep player reads scoped to campaigns they belong to. Direct writes stay disabled;
-- the security-definer RPC below is the only mutation path used by the app.
alter table public.campaign_session_settings enable row level security;

drop policy if exists campaign_session_settings_authenticated_read
  on public.campaign_session_settings;
drop policy if exists campaign_session_settings_campaign_member_read
  on public.campaign_session_settings;

create policy campaign_session_settings_campaign_member_read
on public.campaign_session_settings
for select
to authenticated
using (public.is_campaign_member(campaign_id));

revoke all on table public.campaign_session_settings from anon;
revoke insert, update, delete on table public.campaign_session_settings from authenticated;
grant select on table public.campaign_session_settings to authenticated;
grant select, insert, update, delete on table public.campaign_session_settings to service_role;

create or replace function public.set_campaign_session(
  p_campaign_slug text,
  p_status text,
  p_next_session_at timestamptz default null,
  p_message text default null,
  p_debuffs text[] default '{}'::text[]
)
returns public.campaign_session_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_message text;
  v_debuffs text[] := '{}'::text[];
  v_row public.campaign_session_settings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update the session announcement.';
  end if;

  select id
  into v_campaign_id
  from public.campaigns
  where slug = lower(trim(p_campaign_slug))
    and is_active = true;

  if v_campaign_id is null then
    raise exception 'Campaign not found or inactive.';
  end if;

  if not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Only a Game Master of this campaign may update the session announcement.';
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

  if coalesce(cardinality(p_debuffs), 0) > 12 then
    raise exception 'At most 12 session debuffs may be published.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_debuffs, '{}'::text[])) as debuff(value)
    where char_length(trim(debuff.value)) > 280
  ) then
    raise exception 'Each session debuff may contain at most 280 characters.';
  end if;

  select coalesce(
    array_agg(trim(debuff.value) order by debuff.ordinality),
    '{}'::text[]
  )
  into v_debuffs
  from unnest(coalesce(p_debuffs, '{}'::text[]))
    with ordinality as debuff(value, ordinality)
  where nullif(trim(debuff.value), '') is not null;

  insert into public.campaign_session_settings (
    campaign_id,
    status,
    next_session_at,
    message,
    debuffs,
    updated_at,
    updated_by
  )
  values (
    v_campaign_id,
    p_status,
    case when p_status = 'scheduled' then p_next_session_at else null end,
    v_message,
    v_debuffs,
    now(),
    auth.uid()
  )
  on conflict (campaign_id) do update
  set
    status = excluded.status,
    next_session_at = excluded.next_session_at,
    message = excluded.message,
    debuffs = excluded.debuffs,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_campaign_session(text, text, timestamptz, text, text[])
  from public;
grant execute on function public.set_campaign_session(text, text, timestamptz, text, text[])
  to authenticated;
grant execute on function public.set_campaign_session(text, text, timestamptz, text, text[])
  to service_role;

-- The old global role helper is no longer needed by session controls.
-- If another legacy feature still references it, this DROP safely leaves it in place.
do $$
begin
  begin
    execute 'drop function if exists public.is_session_dm()';
  exception
    when dependent_objects_still_exist then
      raise notice 'public.is_session_dm() is still referenced elsewhere and was left in place.';
  end;
end;
$$;

commit;

-- Optional verification after the transaction.
select
  campaign.slug,
  settings.status,
  settings.next_session_at,
  settings.message,
  settings.debuffs,
  settings.updated_at
from public.campaign_session_settings settings
join public.campaigns campaign on campaign.id = settings.campaign_id
order by campaign.slug;
