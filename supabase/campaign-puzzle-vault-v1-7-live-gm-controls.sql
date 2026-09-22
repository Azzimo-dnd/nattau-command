-- Puzzle Vault v1.7 — stable live control and GM run tools
begin;

alter table public.campaign_puzzle_runs
  add column if not exists move_limit_override integer null;

alter table public.campaign_puzzle_runs
  drop constraint if exists campaign_puzzle_runs_move_limit_override_check;

alter table public.campaign_puzzle_runs
  add constraint campaign_puzzle_runs_move_limit_override_check
  check (move_limit_override is null or move_limit_override >= 1);

-- Keep move history truthful. The GM changes the active run's effective budget
-- instead of rewriting move_count or the reusable puzzle template.
create or replace function public.adjust_campaign_puzzle_move_limit(
  p_run_id uuid,
  p_delta integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.campaign_puzzle_runs%rowtype;
  v_puzzle public.campaign_puzzles%rowtype;
  v_current integer;
  v_next integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'Move adjustment must be non-zero.'; end if;

  select * into v_run
  from public.campaign_puzzle_runs
  where id = p_run_id
  for update;

  if v_run.id is null then raise exception 'Puzzle run not found.'; end if;
  if v_run.status <> 'active' then raise exception 'Only an active puzzle run can be adjusted.'; end if;
  if not public.is_campaign_dm(v_run.campaign_id) then raise exception 'Game Master access required.'; end if;

  select * into v_puzzle
  from public.campaign_puzzles
  where id = v_run.puzzle_id;

  v_current := coalesce(v_run.move_limit_override, v_puzzle.move_limit);
  if v_current is null then
    raise exception 'This puzzle has no move limit to adjust.';
  end if;

  -- Never let a GM correction retroactively invalidate the run. At least one
  -- legal move remains after an adjustment.
  v_next := greatest(v_run.move_count + 1, v_current + p_delta);

  update public.campaign_puzzle_runs
  set move_limit_override = v_next,
      version = version + 1,
      updated_at = now()
  where id = v_run.id;

  return v_next;
end;
$$;

create or replace function public.get_campaign_puzzle_solution(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.campaign_puzzle_runs%rowtype;
  v_puzzle public.campaign_puzzles%rowtype;
  v_secret jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select * into v_run
  from public.campaign_puzzle_runs
  where id = p_run_id;

  if v_run.id is null then raise exception 'Puzzle run not found.'; end if;
  if not public.is_campaign_dm(v_run.campaign_id) then raise exception 'Game Master access required.'; end if;

  select * into v_puzzle
  from public.campaign_puzzles
  where id = v_run.puzzle_id;

  select secret_config into v_secret
  from public.campaign_puzzle_secrets
  where puzzle_id = v_puzzle.id;

  return jsonb_build_object(
    'puzzle_type', v_puzzle.puzzle_type,
    'secret_config', coalesce(v_secret, '{}'::jsonb),
    'public_config', coalesce(v_puzzle.public_config, '{}'::jsonb)
  );
end;
$$;

-- Patch the authoritative action function so each run can carry its own move
-- budget. This deliberately preserves all puzzle-engine logic already present.
do $$
declare
  v_def text;
  v_old text := 'if v_puzzle.move_limit is not null and v_new_move_count >= v_puzzle.move_limit then v_failed:=true; end if;';
  v_new text := 'if coalesce(v_run.move_limit_override, v_puzzle.move_limit) is not null and v_new_move_count >= coalesce(v_run.move_limit_override, v_puzzle.move_limit) then v_failed:=true; end if;';
begin
  select pg_get_functiondef('public.apply_campaign_puzzle_action(uuid,jsonb)'::regprocedure)
  into v_def;

  if position(v_new in v_def) > 0 then
    null;
  elsif position(v_old in v_def) > 0 then
    execute replace(v_def, v_old, v_new);
  else
    raise exception 'Could not patch apply_campaign_puzzle_action move-limit guard.';
  end if;
end;
$$;

revoke all on function public.adjust_campaign_puzzle_move_limit(uuid, integer) from public, anon;
revoke all on function public.get_campaign_puzzle_solution(uuid) from public, anon;
grant execute on function public.adjust_campaign_puzzle_move_limit(uuid, integer) to authenticated, service_role;
grant execute on function public.get_campaign_puzzle_solution(uuid) to authenticated, service_role;

commit;
