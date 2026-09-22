-- Puzzle Vault v1.8 — Arcane Circuit v3 stable-network validation
begin;

create or replace function public.campaign_puzzle_circuit_is_solved(
  p_masks integer[],
  p_rotations integer[],
  p_width integer,
  p_source_index integer,
  p_target_indices integer[]
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_count integer := coalesce(cardinality(p_masks), 0);
  v_height integer;
  v_visited boolean[];
  v_queue integer[];
  v_head integer := 1;
  v_current integer;
  v_neighbor integer;
  v_current_mask integer;
  v_neighbor_mask integer;
  v_row integer;
  v_col integer;
  v_target integer;
  v_visited_count integer := 0;
  v_edge_count integer := 0;
  v_has_leak boolean := false;
begin
  if v_count = 0
     or p_width is null
     or p_width < 1
     or cardinality(p_rotations) <> v_count
     or p_source_index is null
     or p_source_index < 0
     or p_source_index >= v_count
     or coalesce(cardinality(p_target_indices), 0) = 0 then
    return false;
  end if;

  v_height := ceil(v_count::numeric / p_width)::integer;
  v_visited := array_fill(false, array[v_count]);
  v_queue := array[p_source_index];
  v_visited[p_source_index + 1] := true;

  while v_head <= coalesce(cardinality(v_queue), 0) loop
    v_current := v_queue[v_head];
    v_head := v_head + 1;
    v_visited_count := v_visited_count + 1;
    v_row := v_current / p_width;
    v_col := v_current % p_width;
    v_current_mask := public.rotate_campaign_puzzle_mask(
      p_masks[v_current + 1],
      p_rotations[v_current + 1]
    );

    -- North
    if (v_current_mask & 1) <> 0 then
      if v_row <= 0 then
        v_has_leak := true;
      else
        v_neighbor := v_current - p_width;
        v_neighbor_mask := public.rotate_campaign_puzzle_mask(
          p_masks[v_neighbor + 1],
          p_rotations[v_neighbor + 1]
        );
        if (v_neighbor_mask & 4) = 0 then
          v_has_leak := true;
        else
          if v_current < v_neighbor then v_edge_count := v_edge_count + 1; end if;
          if not v_visited[v_neighbor + 1] then
            v_visited[v_neighbor + 1] := true;
            v_queue := array_append(v_queue, v_neighbor);
          end if;
        end if;
      end if;
    end if;

    -- East
    if (v_current_mask & 2) <> 0 then
      if v_col >= p_width - 1 or v_current + 1 >= v_count then
        v_has_leak := true;
      else
        v_neighbor := v_current + 1;
        v_neighbor_mask := public.rotate_campaign_puzzle_mask(
          p_masks[v_neighbor + 1],
          p_rotations[v_neighbor + 1]
        );
        if (v_neighbor_mask & 8) = 0 then
          v_has_leak := true;
        else
          if v_current < v_neighbor then v_edge_count := v_edge_count + 1; end if;
          if not v_visited[v_neighbor + 1] then
            v_visited[v_neighbor + 1] := true;
            v_queue := array_append(v_queue, v_neighbor);
          end if;
        end if;
      end if;
    end if;

    -- South
    if (v_current_mask & 4) <> 0 then
      if v_row >= v_height - 1 or v_current + p_width >= v_count then
        v_has_leak := true;
      else
        v_neighbor := v_current + p_width;
        v_neighbor_mask := public.rotate_campaign_puzzle_mask(
          p_masks[v_neighbor + 1],
          p_rotations[v_neighbor + 1]
        );
        if (v_neighbor_mask & 1) = 0 then
          v_has_leak := true;
        else
          if v_current < v_neighbor then v_edge_count := v_edge_count + 1; end if;
          if not v_visited[v_neighbor + 1] then
            v_visited[v_neighbor + 1] := true;
            v_queue := array_append(v_queue, v_neighbor);
          end if;
        end if;
      end if;
    end if;

    -- West
    if (v_current_mask & 8) <> 0 then
      if v_col <= 0 then
        v_has_leak := true;
      else
        v_neighbor := v_current - 1;
        v_neighbor_mask := public.rotate_campaign_puzzle_mask(
          p_masks[v_neighbor + 1],
          p_rotations[v_neighbor + 1]
        );
        if (v_neighbor_mask & 2) = 0 then
          v_has_leak := true;
        else
          if v_current < v_neighbor then v_edge_count := v_edge_count + 1; end if;
          if not v_visited[v_neighbor + 1] then
            v_visited[v_neighbor + 1] := true;
            v_queue := array_append(v_queue, v_neighbor);
          end if;
        end if;
      end if;
    end if;
  end loop;

  foreach v_target in array p_target_indices loop
    if v_target < 0
       or v_target >= v_count
       or not coalesce(v_visited[v_target + 1], false) then
      return false;
    end if;
  end loop;

  if v_has_leak then return false; end if;

  -- The powered component is connected because it was discovered from one
  -- source. A connected undirected graph is a tree exactly when E = V - 1.
  if v_edge_count <> v_visited_count - 1 then
    return false;
  end if;

  return true;
end;
$$;

-- Switch the authoritative move validator to the stable-network rule while
-- preserving every other puzzle action and the per-run move budget patch.
do $$
declare
  v_def text;
  v_old text := 'v_solved := public.campaign_puzzle_circuit_reaches_targets(';
  v_new text := 'v_solved := public.campaign_puzzle_circuit_is_solved(';
begin
  select pg_get_functiondef(
    'public.apply_campaign_puzzle_action(uuid,jsonb)'::regprocedure
  ) into v_def;

  if position(v_new in v_def) > 0 then
    null;
  elsif position(v_old in v_def) > 0 then
    execute replace(v_def, v_old, v_new);
  else
    raise exception 'Could not patch Arcane Circuit completion validator.';
  end if;
end;
$$;

revoke all on function public.campaign_puzzle_circuit_is_solved(
  integer[], integer[], integer, integer, integer[]
) from public, anon;
grant execute on function public.campaign_puzzle_circuit_is_solved(
  integer[], integer[], integer, integer, integer[]
) to authenticated, service_role;

commit;
