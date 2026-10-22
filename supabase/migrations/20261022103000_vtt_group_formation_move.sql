-- Atomically move a GM-selected formation. RLS is preserved (SECURITY INVOKER).
-- Tokens keep their existing grid sizes/rotations and relative offsets.
begin;

create or replace function public.move_vtt_token_formation(
  p_scene_id uuid,
  p_token_ids uuid[],
  p_dx integer,
  p_dz integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_campaign_id uuid;
  v_width integer;
  v_height integer;
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required.'; end if;
  if p_token_ids is null or cardinality(p_token_ids) < 1 or cardinality(p_token_ids) > 50
     or p_dx is null or p_dz is null or abs(p_dx) > 100 or abs(p_dz) > 100 then
    raise exception 'Invalid formation move.';
  end if;
  if (select count(distinct k) from unnest(p_token_ids) as k) <> cardinality(p_token_ids)
     or array_position(p_token_ids,null::uuid) is not null then
    raise exception 'Invalid or duplicate miniature IDs.';
  end if;
  select s.campaign_id,s.grid_width,s.grid_height into v_campaign_id,v_width,v_height
  from public.vtt_scenes s where s.id=p_scene_id;
  if not found or not public.is_campaign_dm(v_campaign_id) then
    raise exception 'GM access to this scene required.';
  end if;

  -- Serialize competing group moves within the same scene, including hidden actors.
  perform 1 from public.vtt_tokens where scene_id=p_scene_id order by id for update;
  select count(*) into v_count from public.vtt_tokens
  where scene_id=p_scene_id and id=any(p_token_ids);
  if v_count <> cardinality(p_token_ids) then
    raise exception 'Some miniature IDs are missing from this scene.';
  end if;

  if exists (
    select 1 from public.vtt_tokens t
    where t.scene_id=p_scene_id and t.id=any(p_token_ids)
    and (t.x+p_dx-t.size_squares/2 < -v_width/2.0-1e-8
      or t.x+p_dx+t.size_squares/2 > v_width/2.0+1e-8
      or t.z+p_dz-t.size_squares/2 < -v_height/2.0-1e-8
      or t.z+p_dz+t.size_squares/2 > v_height/2.0+1e-8)
  ) then raise exception 'Formation extends outside the battlefield.'; end if;

  -- No overlaps with stationary tokens or between selected group members.
  if exists (
    with proposed as (
      select t.id,t.size_squares,
        t.x + case when t.id=any(p_token_ids) then p_dx else 0 end as x,
        t.z + case when t.id=any(p_token_ids) then p_dz else 0 end as z,
        t.id=any(p_token_ids) as moving
      from public.vtt_tokens t where t.scene_id=p_scene_id
    )
    select 1 from proposed a join proposed b on a.id < b.id
    where (a.moving or b.moving)
      and abs(a.x-b.x) < (a.size_squares+b.size_squares)/2.0-1e-8
      and abs(a.z-b.z) < (a.size_squares+b.size_squares)/2.0-1e-8
  ) then raise exception 'Destination occupied; choose empty squares for the whole formation.'; end if;

  update public.vtt_tokens
  set x=x+p_dx,z=z+p_dz,revision=revision+1,updated_at=now()
  where scene_id=p_scene_id and id=any(p_token_ids);
  return v_count;
end;
$function$;

revoke all on function public.move_vtt_token_formation(uuid,uuid[],integer,integer) from public,anon;
grant execute on function public.move_vtt_token_formation(uuid,uuid[],integer,integer) to authenticated,service_role;
commit;
