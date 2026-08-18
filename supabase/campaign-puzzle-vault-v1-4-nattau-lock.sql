-- Nattau Command: Puzzle Vault v1.4 — Arcane anchors + Nattau Sliding Lock
--
-- Cumulative backend migration.
-- 1. Keeps Arcane Circuit source/destination anchors immutable and normalized.
-- 2. Sliding Lock actions may move a block any legal number of cells.
-- 3. A legal slide of 1 cell or several cells always costs exactly one move.
-- 4. Every intermediate cell is validated, so blocks can never jump through one another.

begin;

create or replace function public.apply_campaign_puzzle_action(
  p_run_id uuid,
  p_action jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.campaign_puzzle_runs%rowtype;
  v_puzzle public.campaign_puzzles%rowtype;
  v_secret jsonb;
  v_action_type text;
  v_state jsonb;
  v_new_state jsonb;
  v_new_move_count integer;
  v_new_attempt_count integer;
  v_solved boolean := false;
  v_failed boolean := false;
  v_move_number integer;

  -- Cipher
  v_solution text[];
  v_guess text[];
  v_code_length integer;
  v_exact integer := 0;
  v_misplaced integer := 0;
  v_sol_used boolean[];
  v_guess_used boolean[];
  v_runes text[];
  v_allow_repeats boolean;
  i integer;
  j integer;

  -- Sliding lock
  v_blocks jsonb;
  v_block jsonb;
  v_other jsonb;
  v_block_id text;
  v_direction text;
  v_axis text;
  v_x integer;
  v_y integer;
  v_w integer;
  v_h integer;
  v_nx integer;
  v_ny integer;
  v_board_w integer;
  v_board_h integer;
  v_target_id text;
  v_target jsonb;
  v_distance integer;
  v_step integer;
  v_dx integer;
  v_dy integer;

  -- Arrays
  v_values text[];
  v_target_values text[];
  v_from integer;
  v_to integer;
  v_size integer;
  v_tmp text;
  v_rotations integer[];
  v_masks integer[];
  v_target_masks integer[];
  v_index integer;
  v_delta integer;

  -- Sequence
  v_level integer;
  v_base integer;
  v_max_level integer;
  v_needed integer;
  v_reset_on_miss boolean;
  v_prefix text[];
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_run from public.campaign_puzzle_runs where id=p_run_id for update;
  if v_run.id is null then raise exception 'Puzzle run not found.'; end if;
  select * into v_puzzle from public.campaign_puzzles where id=v_run.puzzle_id;
  if not public.can_view_campaign_puzzle(v_puzzle.id) then raise exception 'Puzzle access denied.'; end if;
  if v_run.status <> 'active' then raise exception 'This puzzle run is no longer active.'; end if;

  if v_run.deadline_at is not null and v_run.deadline_at <= now() then
    update public.campaign_puzzle_runs
    set status='failed', failed_at=now(), controller_user_id=null, controller_name=null,
        control_expires_at=null, version=version+1, updated_at=now()
    where id=v_run.id;
    update public.campaign_puzzles set status='failed', updated_at=now() where id=v_puzzle.id;
    raise exception 'The puzzle timer has expired.';
  end if;

  if v_run.controller_user_id <> auth.uid()
     or coalesce(v_run.control_expires_at,'-infinity'::timestamptz) <= now() then
    raise exception 'Take control of the puzzle before making a move.';
  end if;

  v_action_type := coalesce(p_action->>'type','');
  v_state := v_run.state;
  v_new_state := v_state;
  v_new_move_count := v_run.move_count;
  v_new_attempt_count := v_run.attempt_count;

  select secret_config into v_secret
  from public.campaign_puzzle_secrets where puzzle_id=v_puzzle.id;
  v_secret := coalesce(v_secret,'{}'::jsonb);

  if v_puzzle.puzzle_type = 'rune_cipher' then
    if v_action_type <> 'cipher_guess' then raise exception 'Invalid Rune Cipher action.'; end if;
    select array_agg(value order by ordinality) into v_solution
      from jsonb_array_elements_text(coalesce(v_secret->'solution','[]'::jsonb)) with ordinality as s(value,ordinality);
    select array_agg(value order by ordinality) into v_guess
      from jsonb_array_elements_text(coalesce(p_action->'guess','[]'::jsonb)) with ordinality as g(value,ordinality);
    v_code_length := coalesce((v_puzzle.public_config->>'code_length')::integer, cardinality(v_solution));
    if coalesce(cardinality(v_guess),0) <> v_code_length
       or coalesce(cardinality(v_solution),0) <> v_code_length then
      raise exception 'Rune guess or configured solution has an invalid length.';
    end if;
    select array_agg(value order by ordinality) into v_runes
      from jsonb_array_elements_text(coalesce(v_puzzle.public_config->'runes','[]'::jsonb)) with ordinality as r(value,ordinality);
    for i in 1..v_code_length loop
      if v_runes is null or not (v_guess[i] = any(v_runes)) then
        raise exception 'The guess contains a rune that is not part of this cipher.';
      end if;
    end loop;
    v_allow_repeats := coalesce((v_puzzle.public_config->>'allow_repeats')::boolean,true);
    if not v_allow_repeats and (
      select count(distinct rune) from unnest(v_guess) as guessed(rune)
    ) <> cardinality(v_guess) then
      raise exception 'This cipher does not allow repeated runes.';
    end if;
    v_sol_used := array_fill(false, array[v_code_length]);
    v_guess_used := array_fill(false, array[v_code_length]);
    for i in 1..v_code_length loop
      if v_guess[i]=v_solution[i] then
        v_exact:=v_exact+1; v_sol_used[i]:=true; v_guess_used[i]:=true;
      end if;
    end loop;
    for i in 1..v_code_length loop
      if not v_guess_used[i] then
        for j in 1..v_code_length loop
          if not v_sol_used[j] and v_guess[i]=v_solution[j] then
            v_misplaced:=v_misplaced+1; v_sol_used[j]:=true; exit;
          end if;
        end loop;
      end if;
    end loop;
    v_new_state := jsonb_set(
      v_state,
      '{guesses}',
      coalesce(v_state->'guesses','[]'::jsonb) || jsonb_build_array(
        jsonb_build_object('guess',to_jsonb(v_guess),'exact',v_exact,'misplaced',v_misplaced)
      ),
      true
    );
    v_new_move_count := v_new_move_count + 1;
    v_new_attempt_count := v_new_attempt_count + 1;
    v_solved := v_exact = v_code_length;

  elsif v_puzzle.puzzle_type = 'sliding_lock' then
    if v_action_type <> 'slide' then raise exception 'Invalid Sliding Lock action.'; end if;
    v_block_id := p_action->>'block_id';
    v_direction := p_action->>'direction';
    v_blocks := coalesce(v_state->'blocks','[]'::jsonb);
    select b into v_block from jsonb_array_elements(v_blocks) b where b->>'id'=v_block_id limit 1;
    if v_block is null then raise exception 'Unknown lock block.'; end if;

    v_axis:=v_block->>'axis';
    v_x:=(v_block->>'x')::integer;
    v_y:=(v_block->>'y')::integer;
    v_w:=(v_block->>'w')::integer;
    v_h:=(v_block->>'h')::integer;
    v_board_w:=coalesce((v_puzzle.public_config->>'width')::integer,6);
    v_board_h:=coalesce((v_puzzle.public_config->>'height')::integer,6);
    v_distance:=coalesce((p_action->>'distance')::integer,1);

    if v_distance < 1 or v_distance > greatest(v_board_w,v_board_h) then
      raise exception 'Invalid sliding distance.';
    end if;

    v_dx:=0;
    v_dy:=0;
    if v_direction='left' and v_axis='h' then v_dx:=-1;
    elsif v_direction='right' and v_axis='h' then v_dx:=1;
    elsif v_direction='up' and v_axis='v' then v_dy:=-1;
    elsif v_direction='down' and v_axis='v' then v_dy:=1;
    else raise exception 'That block cannot move in this direction.';
    end if;

    -- Validate every crossed grid cell. A longer drag is still one puzzle move,
    -- but a block can never jump through another ward or leave the frame.
    for v_step in 1..v_distance loop
      v_nx:=v_x + v_dx * v_step;
      v_ny:=v_y + v_dy * v_step;

      if v_nx<0 or v_ny<0 or v_nx+v_w>v_board_w or v_ny+v_h>v_board_h then
        raise exception 'The block would leave the lock frame.';
      end if;

      for v_other in
        select value
        from jsonb_array_elements(v_blocks)
        where value->>'id'<>v_block_id
      loop
        if v_nx < (v_other->>'x')::integer + (v_other->>'w')::integer
           and v_nx + v_w > (v_other->>'x')::integer
           and v_ny < (v_other->>'y')::integer + (v_other->>'h')::integer
           and v_ny + v_h > (v_other->>'y')::integer then
          raise exception 'Another ward blocks that movement.';
        end if;
      end loop;
    end loop;

    select jsonb_agg(
      case when value->>'id'=v_block_id then
        jsonb_set(jsonb_set(value,'{x}',to_jsonb(v_nx),true),'{y}',to_jsonb(v_ny),true)
      else value end
    ) into v_blocks from jsonb_array_elements(v_blocks);
    v_new_state:=jsonb_set(v_state,'{blocks}',coalesce(v_blocks,'[]'::jsonb),true);

    -- Distance does not matter for the move budget: one drag/action = one move.
    v_new_move_count:=v_new_move_count+1;
    v_target_id:=coalesce(v_puzzle.public_config->>'target_block_id','A');
    select b into v_target from jsonb_array_elements(v_blocks) b where b->>'id'=v_target_id limit 1;
    v_solved := v_target is not null
      and (v_target->>'x')::integer + (v_target->>'w')::integer = v_board_w
      and (v_target->>'y')::integer = coalesce((v_puzzle.public_config->>'exit_row')::integer,(v_target->>'y')::integer);

  elsif v_puzzle.puzzle_type = 'shattered_sigil' then
    if v_action_type <> 'swap' then raise exception 'Invalid Shattered Sigil action.'; end if;
    select array_agg(value order by ordinality) into v_values
      from jsonb_array_elements_text(coalesce(v_state->'order','[]'::jsonb)) with ordinality as s(value,ordinality);
    select array_agg(value order by ordinality) into v_target_values
      from jsonb_array_elements_text(coalesce(v_secret->'target_order','[]'::jsonb)) with ordinality as s(value,ordinality);
    v_size:=coalesce((v_puzzle.public_config->>'size')::integer,3);
    if coalesce(cardinality(v_values),0) = 0
       or coalesce(cardinality(v_target_values),0) <> cardinality(v_values) then
      raise exception 'Shattered Sigil configuration is incomplete.';
    end if;
    v_from:=(p_action->>'from')::integer; v_to:=(p_action->>'to')::integer;
    if v_from is null or v_to is null
       or v_from<0 or v_to<0 or v_from>=cardinality(v_values) or v_to>=cardinality(v_values) then
      raise exception 'Invalid sigil tile.';
    end if;
    if not (
      (abs(v_from-v_to)=1 and floor(v_from::numeric/v_size)=floor(v_to::numeric/v_size))
      or abs(v_from-v_to)=v_size
    ) then raise exception 'Only adjacent fragments may trade places.'; end if;
    v_tmp:=v_values[v_from+1]; v_values[v_from+1]:=v_values[v_to+1]; v_values[v_to+1]:=v_tmp;
    v_new_state:=jsonb_set(v_state,'{order}',to_jsonb(v_values),true);
    v_new_move_count:=v_new_move_count+1;
    v_solved := v_values = v_target_values;

  elsif v_puzzle.puzzle_type = 'arcane_circuit' then
    if v_action_type <> 'rotate' then raise exception 'Invalid Arcane Circuit action.'; end if;
    select array_agg(value::integer order by ordinality) into v_rotations
      from jsonb_array_elements_text(coalesce(v_state->'rotations','[]'::jsonb)) with ordinality as r(value,ordinality);
    select array_agg(value::integer order by ordinality) into v_masks
      from jsonb_array_elements_text(coalesce(v_puzzle.public_config->'masks','[]'::jsonb)) with ordinality as r(value,ordinality);
    if cardinality(v_rotations) is null
       or cardinality(v_rotations) <> cardinality(v_masks) then
      raise exception 'Arcane Circuit configuration is incomplete.';
    end if;
    v_index:=(p_action->>'index')::integer;
    v_delta:=coalesce((p_action->>'delta')::integer,1);
    if v_index<0 or v_index>=cardinality(v_rotations) then raise exception 'Invalid circuit tile.'; end if;
    if v_index = greatest(0, coalesce((v_puzzle.public_config->>'source_index')::integer, 0))
       or exists (
         select 1
         from jsonb_array_elements_text(
           coalesce(v_puzzle.public_config->'target_indices','[]'::jsonb)
         ) as target(value)
         where target.value::integer = v_index
       )
       or exists (
         select 1
         from jsonb_array_elements_text(
           coalesce(v_puzzle.public_config->'locked_indices','[]'::jsonb)
         ) as locked(value)
         where locked.value::integer = v_index
       ) then
      raise exception 'The source and destination anchors are fixed and cannot rotate.';
    end if;
    v_rotations[v_index+1] := ((v_rotations[v_index+1] + v_delta) % 4 + 4) % 4;
    v_new_state:=jsonb_set(v_state,'{rotations}',to_jsonb(v_rotations),true);
    v_new_move_count:=v_new_move_count+1;
    v_solved := public.campaign_puzzle_circuit_reaches_targets(
      v_masks,
      v_rotations,
      greatest(1, coalesce((v_puzzle.public_config->>'width')::integer, 4)),
      greatest(0, coalesce((v_puzzle.public_config->>'source_index')::integer, 0)),
      array(
        select value::integer
        from jsonb_array_elements_text(
          coalesce(v_puzzle.public_config->'target_indices','[]'::jsonb)
        )
      )
    );

  elsif v_puzzle.puzzle_type = 'rune_sequence' then
    if v_action_type <> 'sequence_submit' then raise exception 'Invalid Rune Sequence action.'; end if;
    select array_agg(value order by ordinality) into v_solution
      from jsonb_array_elements_text(coalesce(v_secret->'sequence','[]'::jsonb)) with ordinality as s(value,ordinality);
    select array_agg(value order by ordinality) into v_guess
      from jsonb_array_elements_text(coalesce(p_action->'sequence','[]'::jsonb)) with ordinality as g(value,ordinality);
    v_level:=greatest(1,coalesce((v_state->>'level')::integer,1));
    v_base:=greatest(1,coalesce((v_puzzle.public_config->>'base_length')::integer,3));
    v_max_level:=greatest(1,coalesce((v_puzzle.public_config->>'max_level')::integer,5));
    v_needed:=v_base+v_level-1;
    if coalesce(cardinality(v_solution),0) < v_needed then
      raise exception 'Rune Sequence configuration is incomplete.';
    end if;
    v_prefix:=v_solution[1:v_needed];
    if coalesce(cardinality(v_guess),0)<>v_needed then
      raise exception 'The reproduced sequence has the wrong length.';
    end if;
    v_new_move_count:=v_new_move_count+1;
    if v_guess=v_prefix then
      if v_level>=v_max_level then
        v_solved:=true;
        v_new_state:=jsonb_set(v_state,'{last_feedback}',to_jsonb('correct'::text),true);
      else
        v_new_state:=jsonb_set(jsonb_set(v_state,'{level}',to_jsonb(v_level+1),true),'{last_feedback}',to_jsonb('correct'::text),true);
      end if;
    else
      v_new_attempt_count:=v_new_attempt_count+1;
      v_reset_on_miss:=coalesce((v_puzzle.public_config->>'reset_on_miss')::boolean,false);
      v_new_state:=jsonb_set(
        jsonb_set(v_state,'{level}',to_jsonb(case when v_reset_on_miss then 1 else v_level end),true),
        '{last_feedback}',to_jsonb('wrong'::text),true
      );
    end if;
  else
    raise exception 'Unsupported puzzle type.';
  end if;

  if not v_solved then
    if v_puzzle.move_limit is not null and v_new_move_count >= v_puzzle.move_limit then v_failed:=true; end if;
    if v_puzzle.attempt_limit is not null and v_new_attempt_count >= v_puzzle.attempt_limit then v_failed:=true; end if;
  end if;

  v_move_number:=v_new_move_count;
  update public.campaign_puzzle_runs
  set state=v_new_state,
      move_count=v_new_move_count,
      attempt_count=v_new_attempt_count,
      status=case when v_solved then 'solved' when v_failed then 'failed' else 'active' end,
      solved_at=case when v_solved then now() else solved_at end,
      failed_at=case when v_failed then now() else failed_at end,
      solved_by_user_id=case when v_solved then auth.uid() else solved_by_user_id end,
      solved_by_name=case
        when v_solved then coalesce(
          nullif(trim(v_run.controller_name), ''),
          (select nullif(trim(display_name), '') from public.profiles where id=auth.uid()),
          'Solver'
        )
        else solved_by_name
      end,
      controller_user_id=case when v_solved or v_failed then null else controller_user_id end,
      controller_name=case when v_solved or v_failed then null else controller_name end,
      control_expires_at=case when v_solved or v_failed then null else now()+interval '45 seconds' end,
      version=version+1,
      updated_at=now()
  where id=v_run.id;

  insert into public.campaign_puzzle_moves (
    run_id,puzzle_id,campaign_id,actor_id,move_number,action
  ) values (
    v_run.id,v_puzzle.id,v_puzzle.campaign_id,auth.uid(),v_move_number,p_action
  );

  if v_solved then
    update public.campaign_puzzles set status='solved', updated_at=now() where id=v_puzzle.id;
  elsif v_failed then
    update public.campaign_puzzles set status='failed', updated_at=now() where id=v_puzzle.id;
  end if;

  return jsonb_build_object(
    'status',case when v_solved then 'solved' when v_failed then 'failed' else 'active' end,
    'state',v_new_state,
    'move_count',v_new_move_count,
    'attempt_count',v_new_attempt_count,
    'solved',v_solved,
    'failed',v_failed
  );
end;
$$;

create or replace function public.delete_campaign_puzzle(p_puzzle_id uuid)
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

  select campaign_id
  into v_campaign_id
  from public.campaign_puzzles
  where id = p_puzzle_id
  for update;

  if v_campaign_id is null then
    raise exception 'Puzzle not found.';
  end if;

  if not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Game Master access required.';
  end if;

  delete from public.campaign_puzzles
  where id = p_puzzle_id;
end;
$$;

-- Supabase may grant EXECUTE to anon through default privileges. Remove it explicitly.

-- Normalize existing Arcane Circuit templates so future runs start with the
-- source and destination anchors already facing the canonical solution path.
-- For an active run, only the locked endpoint rotations are corrected; every
-- free tile keeps its current player-controlled orientation.
do $$
declare
  v_puzzle record;
  v_masks integer[];
  v_initial integer[];
  v_targets integer[];
  v_target_masks integer[];
  v_locked integer[];
  v_source integer;
  v_index integer;
  v_rotation integer;
  v_run_rotations integer[];
  v_run_id uuid;
begin
  for v_puzzle in
    select p.id, p.current_run_id, p.public_config, s.secret_config
    from public.campaign_puzzles p
    join public.campaign_puzzle_secrets s on s.puzzle_id = p.id
    where p.puzzle_type = 'arcane_circuit'
  loop
    select array_agg(value::integer order by ordinality)
      into v_masks
    from jsonb_array_elements_text(
      coalesce(v_puzzle.public_config->'masks','[]'::jsonb)
    ) with ordinality as item(value, ordinality);

    select array_agg(value::integer order by ordinality)
      into v_initial
    from jsonb_array_elements_text(
      coalesce(v_puzzle.public_config->'initial_rotations','[]'::jsonb)
    ) with ordinality as item(value, ordinality);

    select coalesce(array_agg(value::integer order by ordinality), '{}'::integer[])
      into v_targets
    from jsonb_array_elements_text(
      coalesce(v_puzzle.public_config->'target_indices','[]'::jsonb)
    ) with ordinality as item(value, ordinality);

    select array_agg(value::integer order by ordinality)
      into v_target_masks
    from jsonb_array_elements_text(
      coalesce(v_puzzle.secret_config->'target_masks','[]'::jsonb)
    ) with ordinality as item(value, ordinality);

    v_source := greatest(
      0,
      coalesce((v_puzzle.public_config->>'source_index')::integer, 0)
    );
    v_locked := array[v_source] || coalesce(v_targets, '{}'::integer[]);

    if cardinality(v_masks) is null
       or cardinality(v_initial) <> cardinality(v_masks)
       or cardinality(v_target_masks) <> cardinality(v_masks) then
      continue;
    end if;

    foreach v_index in array v_locked loop
      if v_index < 0 or v_index >= cardinality(v_masks) then
        continue;
      end if;

      for v_rotation in 0..3 loop
        if public.rotate_campaign_puzzle_mask(
          v_masks[v_index + 1],
          v_rotation
        ) = v_target_masks[v_index + 1] then
          v_initial[v_index + 1] := v_rotation;
          exit;
        end if;
      end loop;
    end loop;

    update public.campaign_puzzles
    set public_config =
      jsonb_set(
        jsonb_set(
          public_config,
          '{initial_rotations}',
          to_jsonb(v_initial),
          true
        ),
        '{locked_indices}',
        to_jsonb(v_locked),
        true
      ),
      updated_at = now()
    where id = v_puzzle.id;

    v_run_id := v_puzzle.current_run_id;
    if v_run_id is not null then
      select array_agg(value::integer order by ordinality)
        into v_run_rotations
      from public.campaign_puzzle_runs r,
           jsonb_array_elements_text(
             coalesce(r.state->'rotations','[]'::jsonb)
           ) with ordinality as item(value, ordinality)
      where r.id = v_run_id
        and r.status = 'active';

      if cardinality(v_run_rotations) = cardinality(v_initial) then
        foreach v_index in array v_locked loop
          if v_index >= 0 and v_index < cardinality(v_run_rotations) then
            v_run_rotations[v_index + 1] := v_initial[v_index + 1];
          end if;
        end loop;

        update public.campaign_puzzle_runs
        set state = jsonb_set(
              state,
              '{rotations}',
              to_jsonb(v_run_rotations),
              true
            ),
            version = version + 1,
            updated_at = now()
        where id = v_run_id
          and status = 'active';
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_campaign_puzzle_action(uuid,jsonb) from public, anon;
grant execute on function public.apply_campaign_puzzle_action(uuid,jsonb) to authenticated, service_role;

commit;
