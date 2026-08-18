-- Puzzle Vault v1.6 — tester-only audience support
begin;

alter table public.campaign_puzzles
  add column if not exists is_test_visible boolean not null default false;

create or replace function public.is_campaign_test_account(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
      and coalesce(cm.is_test_account, false) = true
  );
$$;

create or replace function public.can_view_campaign_puzzle(target_puzzle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_puzzles p
    where p.id = target_puzzle_id
      and (
        public.is_campaign_dm(p.campaign_id)
        or (
          public.is_campaign_member(p.campaign_id)
          and p.status in ('active','solved','failed')
          and (
            p.is_visible = true
            or (
              p.is_test_visible = true
              and public.is_campaign_test_account(p.campaign_id)
            )
          )
        )
      )
  );
$$;

drop policy if exists "Puzzle members can read visible puzzles" on public.campaign_puzzles;
create policy "Puzzle members can read visible puzzles"
on public.campaign_puzzles for select to authenticated
using (
  public.is_campaign_dm(campaign_id)
  or (
    public.is_campaign_member(campaign_id)
    and status in ('active','solved','failed')
    and (
      is_visible = true
      or (
        is_test_visible = true
        and public.is_campaign_test_account(campaign_id)
      )
    )
  )
);

create or replace function public.start_campaign_puzzle(
  p_puzzle_id uuid,
  p_make_visible boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puzzle public.campaign_puzzles%rowtype;
  v_run_id uuid;
  v_state jsonb;
  v_deadline timestamptz;
begin
  select * into v_puzzle
  from public.campaign_puzzles
  where id = p_puzzle_id
  for update;

  if v_puzzle.id is null then raise exception 'Puzzle not found.'; end if;
  if not public.is_campaign_dm(v_puzzle.campaign_id) then
    raise exception 'Only the campaign Game Master may start puzzles.';
  end if;
  if v_puzzle.status = 'archived' then
    raise exception 'Archived puzzles cannot be started.';
  end if;

  if v_puzzle.current_run_id is not null then
    update public.campaign_puzzle_runs
    set status = case when status = 'active' then 'superseded' else status end,
        controller_user_id = null,
        controller_name = null,
        control_expires_at = null,
        updated_at = now()
    where id = v_puzzle.current_run_id;
  end if;

  v_state := public.build_campaign_puzzle_initial_state(v_puzzle.puzzle_type, v_puzzle.public_config);
  v_deadline := case
    when v_puzzle.time_limit_seconds is null then null
    else now() + make_interval(secs => v_puzzle.time_limit_seconds)
  end;

  insert into public.campaign_puzzle_runs (
    puzzle_id, campaign_id, status, state, move_count, attempt_count,
    started_at, deadline_at, version, updated_at
  ) values (
    v_puzzle.id, v_puzzle.campaign_id, 'active', v_state, 0, 0,
    now(), v_deadline, 1, now()
  ) returning id into v_run_id;

  update public.campaign_puzzles
  set current_run_id = v_run_id,
      status = 'active',
      is_visible = p_make_visible,
      is_test_visible = false,
      updated_by = auth.uid()
  where id = v_puzzle.id;

  return v_run_id;
end;
$$;

create or replace function public.start_campaign_puzzle_for_testers(p_puzzle_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_run_id := public.start_campaign_puzzle(p_puzzle_id, false);

  update public.campaign_puzzles
  set is_visible = false,
      is_test_visible = true,
      updated_by = auth.uid()
  where id = p_puzzle_id;

  return v_run_id;
end;
$$;

create or replace function public.set_campaign_puzzle_visibility(
  p_puzzle_id uuid,
  p_visible boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id
  from public.campaign_puzzles
  where id = p_puzzle_id;

  if v_campaign_id is null then raise exception 'Puzzle not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Game Master access required.';
  end if;

  update public.campaign_puzzles
  set is_visible = p_visible,
      is_test_visible = false,
      updated_by = auth.uid()
  where id = p_puzzle_id;
end;
$$;

create or replace function public.set_campaign_puzzle_test_visibility(
  p_puzzle_id uuid,
  p_visible boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id
  from public.campaign_puzzles
  where id = p_puzzle_id;

  if v_campaign_id is null then raise exception 'Puzzle not found.'; end if;
  if not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Game Master access required.';
  end if;

  update public.campaign_puzzles
  set is_visible = false,
      is_test_visible = p_visible,
      updated_by = auth.uid()
  where id = p_puzzle_id;
end;
$$;

create or replace function public.restore_campaign_puzzle(p_puzzle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select campaign_id into v_campaign_id
  from public.campaign_puzzles
  where id = p_puzzle_id
  for update;

  if v_campaign_id is null then
    raise exception 'Puzzle not found.';
  end if;
  if not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Game Master access required.';
  end if;

  update public.campaign_puzzles
  set status = 'draft',
      is_visible = false,
      is_test_visible = false,
      current_run_id = null,
      updated_by = auth.uid()
  where id = p_puzzle_id
    and status = 'archived';
end;
$$;

create or replace function public.archive_campaign_puzzle(p_puzzle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_run_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select campaign_id, current_run_id
    into v_campaign_id, v_run_id
  from public.campaign_puzzles
  where id = p_puzzle_id
  for update;

  if v_campaign_id is null then
    raise exception 'Puzzle not found.';
  end if;
  if not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Game Master access required.';
  end if;

  if v_run_id is not null then
    update public.campaign_puzzle_runs
    set status = case when status = 'active' then 'superseded' else status end,
        controller_user_id = null,
        controller_name = null,
        control_expires_at = null,
        updated_at = now()
    where id = v_run_id;
  end if;

  update public.campaign_puzzles
  set status = 'archived',
      is_visible = false,
      is_test_visible = false,
      current_run_id = null,
      updated_by = auth.uid()
  where id = p_puzzle_id;
end;
$$;

revoke all on function public.is_campaign_test_account(uuid) from public, anon;
revoke all on function public.start_campaign_puzzle_for_testers(uuid) from public, anon;
revoke all on function public.set_campaign_puzzle_test_visibility(uuid, boolean) from public, anon;
grant execute on function public.is_campaign_test_account(uuid) to authenticated, service_role;
grant execute on function public.start_campaign_puzzle_for_testers(uuid) to authenticated, service_role;
grant execute on function public.set_campaign_puzzle_test_visibility(uuid, boolean) to authenticated, service_role;

commit;
