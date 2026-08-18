-- Puzzle Vault v1.5 — archive restore + universal cleanup support
begin;

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
      current_run_id = null,
      updated_by = auth.uid()
  where id = p_puzzle_id;
end;
$$;

update public.campaign_puzzles
set current_run_id = null
where status = 'archived' and current_run_id is not null;

revoke all on function public.restore_campaign_puzzle(uuid) from public, anon;
revoke all on function public.archive_campaign_puzzle(uuid) from public, anon;
grant execute on function public.restore_campaign_puzzle(uuid) to authenticated, service_role;
grant execute on function public.archive_campaign_puzzle(uuid) to authenticated, service_role;

commit;
