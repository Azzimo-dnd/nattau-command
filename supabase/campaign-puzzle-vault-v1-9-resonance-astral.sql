-- Puzzle Vault v1.9 — Runic Resonance + Astral Weave
begin;

create or replace function public.campaign_puzzle_astral_is_solved(
  p_nodes jsonb,
  p_edges jsonb,
  p_bridges jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_node_ids text[];
  v_node jsonb;
  v_edge jsonb;
  v_cross text;
  v_node_id text;
  v_required integer;
  v_sum integer;
  v_count integer;
  v_first text;
  v_current text;
  v_neighbor text;
  v_visited text[];
  v_queue text[];
  v_head integer := 1;
begin
  if jsonb_typeof(coalesce(p_nodes, 'null'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_edges, 'null'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_bridges, '{}'::jsonb)) <> 'object' then
    return false;
  end if;

  select array_agg(value->>'id' order by ordinality)
    into v_node_ids
  from jsonb_array_elements(p_nodes) with ordinality as n(value, ordinality);

  if coalesce(cardinality(v_node_ids), 0) = 0 then
    return false;
  end if;

  -- Every star must receive exactly its printed number of threads.
  for v_node in select value from jsonb_array_elements(p_nodes)
  loop
    v_node_id := v_node->>'id';
    v_required := coalesce((v_node->>'required')::integer, -1);
    if v_node_id is null or v_required < 1 or v_required > 8 then
      return false;
    end if;

    v_sum := 0;
    for v_edge in select value from jsonb_array_elements(p_edges)
    loop
      v_count := coalesce((p_bridges->>(v_edge->>'id'))::integer, 0);
      if v_count < 0 or v_count > 2 then
        return false;
      end if;
      if v_edge->>'a' = v_node_id or v_edge->>'b' = v_node_id then
        v_sum := v_sum + v_count;
      end if;
    end loop;

    if v_sum <> v_required then
      return false;
    end if;
  end loop;

  -- Active threads may not cross.
  for v_edge in select value from jsonb_array_elements(p_edges)
  loop
    v_count := coalesce((p_bridges->>(v_edge->>'id'))::integer, 0);
    if v_count <= 0 then continue; end if;

    for v_cross in
      select value
      from jsonb_array_elements_text(coalesce(v_edge->'crosses', '[]'::jsonb))
    loop
      if coalesce((p_bridges->>v_cross)::integer, 0) > 0 then
        return false;
      end if;
    end loop;
  end loop;

  -- All stars must belong to one connected constellation.
  v_first := v_node_ids[1];
  v_visited := array[v_first];
  v_queue := array[v_first];

  while v_head <= coalesce(cardinality(v_queue), 0)
  loop
    v_current := v_queue[v_head];
    v_head := v_head + 1;

    for v_edge in select value from jsonb_array_elements(p_edges)
    loop
      v_count := coalesce((p_bridges->>(v_edge->>'id'))::integer, 0);
      if v_count <= 0 then continue; end if;

      v_neighbor := null;
      if v_edge->>'a' = v_current then
        v_neighbor := v_edge->>'b';
      elsif v_edge->>'b' = v_current then
        v_neighbor := v_edge->>'a';
      end if;

      if v_neighbor is not null
         and not (v_neighbor = any(v_visited)) then
        v_visited := array_append(v_visited, v_neighbor);
        v_queue := array_append(v_queue, v_neighbor);
      end if;
    end loop;
  end loop;

  return cardinality(v_visited) = cardinality(v_node_ids);
end;
$$;

create or replace function public.build_campaign_puzzle_initial_state(
  p_type text,
  p_public_config jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
begin
  case p_type
    when 'rune_cipher' then
      return jsonb_build_object('guesses', '[]'::jsonb);
    when 'sliding_lock' then
      return jsonb_build_object('blocks', coalesce(p_public_config->'blocks', '[]'::jsonb), 'selected', null);
    when 'shattered_sigil' then
      return jsonb_build_object('order', coalesce(p_public_config->'initial_order', '[]'::jsonb), 'selected', null);
    when 'arcane_circuit' then
      return jsonb_build_object('rotations', coalesce(p_public_config->'initial_rotations', '[]'::jsonb));
    when 'rune_sequence' then
      return jsonb_build_object('level', 1, 'last_feedback', null, 'reveals', 0);
    when 'runic_resonance' then
      return jsonb_build_object('lit', coalesce(p_public_config->'initial_lit', '[]'::jsonb));
    when 'astral_weave' then
      return jsonb_build_object('bridges', coalesce(p_public_config->'initial_bridges', '{}'::jsonb));
    else
      raise exception 'Unsupported puzzle type: %', p_type;
  end case;
end;
$$;

-- Extend the GM save allow-list without rewriting the rest of the hardened RPC.
do $$
declare
  v_def text;
  v_old text := 'if v_type not in (''rune_cipher'',''sliding_lock'',''shattered_sigil'',''arcane_circuit'',''rune_sequence'') then';
  v_new text := 'if v_type not in (''rune_cipher'',''sliding_lock'',''shattered_sigil'',''arcane_circuit'',''rune_sequence'',''runic_resonance'',''astral_weave'') then';
begin
  select pg_get_functiondef(
    'public.save_campaign_puzzle(text,uuid,jsonb)'::regprocedure
  ) into v_def;

  if position(v_new in v_def) > 0 then
    null;
  elsif position(v_old in v_def) > 0 then
    execute replace(v_def, v_old, v_new);
  else
    raise exception 'Could not extend save_campaign_puzzle puzzle-type allow-list.';
  end if;
end;
$$;

-- Add the two authoritative move handlers immediately before Rune Sequence.
do $$
declare
  v_def text;
  v_marker text := '  elsif v_puzzle.puzzle_type = ''rune_sequence'' then';
  v_insert text := $patch$
  elsif v_puzzle.puzzle_type = 'runic_resonance' then
    if v_action_type <> 'resonance_press' then
      raise exception 'Invalid Runic Resonance action.';
    end if;

    v_index := (p_action->>'index')::integer;
    if v_index is null
       or v_index < 0
       or v_index >= jsonb_array_length(coalesce(v_state->'lit', '[]'::jsonb)) then
      raise exception 'Invalid resonance rune.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(v_puzzle.public_config->'locked_indices', '[]'::jsonb)
      ) as locked(value)
      where locked.value::integer = v_index
    ) then
      raise exception 'That resonance rune is sealed.';
    end if;

    if jsonb_typeof(coalesce(v_puzzle.public_config->'effects', 'null'::jsonb)) <> 'array'
       or v_index >= jsonb_array_length(v_puzzle.public_config->'effects') then
      raise exception 'Runic Resonance configuration is incomplete.';
    end if;

    v_new_state := v_state;
    for i in
      select value::integer
      from jsonb_array_elements_text(v_puzzle.public_config->'effects'->v_index)
    loop
      if i < 0 or i >= jsonb_array_length(v_new_state->'lit') then
        raise exception 'Runic Resonance effect points outside the lattice.';
      end if;
      v_new_state := jsonb_set(
        v_new_state,
        array['lit', i::text],
        to_jsonb(not coalesce((v_new_state->'lit'->>i)::boolean, false)),
        true
      );
    end loop;

    v_new_move_count := v_new_move_count + 1;
    v_solved := coalesce(v_new_state->'lit', '[]'::jsonb)
      = coalesce(v_puzzle.public_config->'target_lit', '[]'::jsonb);

  elsif v_puzzle.puzzle_type = 'astral_weave' then
    if v_action_type <> 'weave_bridge' then
      raise exception 'Invalid Astral Weave action.';
    end if;

    v_block_id := trim(coalesce(p_action->>'edge_id', ''));
    v_distance := coalesce((p_action->>'count')::integer, -1);

    if v_block_id = ''
       or v_distance < 0
       or v_distance > 2
       or not exists (
         select 1
         from jsonb_array_elements(
           coalesce(v_puzzle.public_config->'edges', '[]'::jsonb)
         ) as edge(value)
         where edge.value->>'id' = v_block_id
       ) then
      raise exception 'Invalid Astral Weave thread.';
    end if;

    v_new_state := jsonb_set(
      v_state,
      array['bridges', v_block_id],
      to_jsonb(v_distance),
      true
    );
    v_new_move_count := v_new_move_count + 1;
    v_solved := public.campaign_puzzle_astral_is_solved(
      coalesce(v_puzzle.public_config->'nodes', '[]'::jsonb),
      coalesce(v_puzzle.public_config->'edges', '[]'::jsonb),
      coalesce(v_new_state->'bridges', '{}'::jsonb)
    );

$patch$ || v_marker;
begin
  select pg_get_functiondef(
    'public.apply_campaign_puzzle_action(uuid,jsonb)'::regprocedure
  ) into v_def;

  if position('v_puzzle.puzzle_type = ''runic_resonance''' in v_def) > 0 then
    null;
  elsif position(v_marker in v_def) > 0 then
    execute replace(v_def, v_marker, v_insert);
  else
    raise exception 'Could not patch apply_campaign_puzzle_action for new engines.';
  end if;
end;
$$;

revoke all on function public.campaign_puzzle_astral_is_solved(jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.campaign_puzzle_astral_is_solved(jsonb, jsonb, jsonb)
  to authenticated, service_role;

commit;
