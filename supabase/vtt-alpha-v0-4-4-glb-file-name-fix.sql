-- Nattau VTT Alpha v0.4.4 — restore browser GLB filenames after player-visibility migration
-- v0.4.3 intentionally tightened scene access but accidentally copied the pre-v0.1.1
-- filename expression. Keep the visibility checks and restore the corrected GLB filename mapping.

begin;

create or replace function public.list_vtt_scene_tokens(p_scene_id uuid)
returns table (
  id uuid,
  name text,
  source_kind text,
  x double precision,
  z double precision,
  rotation double precision,
  scale double precision,
  size_squares double precision,
  visible_to_players boolean,
  model_storage_path text,
  model_file_name text,
  model_format text,
  paint_storage_path text,
  revision bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_scene_active boolean;
  v_scene_visible boolean;
  v_is_dm boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select s.campaign_id, s.is_active, s.visible_to_players
    into v_campaign_id, v_scene_active, v_scene_visible
  from public.vtt_scenes s
  where s.id = p_scene_id;

  if v_campaign_id is null then raise exception 'Scene not found.'; end if;

  v_is_dm := public.is_campaign_dm(v_campaign_id);
  if not v_is_dm then
    if not public.is_campaign_member(v_campaign_id) then
      raise exception 'Campaign access required.';
    end if;
    if not v_scene_active or not v_scene_visible then
      raise exception 'VTT scene is not currently available to players.';
    end if;
  end if;

  return query
  select
    t.id,
    t.name,
    case when t.character_miniature_id is not null then 'character' else 'enemy' end,
    t.x,t.z,t.rotation,t.scale,t.size_squares,t.visible_to_players,
    case when t.character_miniature_id is not null
      then coalesce(cm.web_storage_path, cm.storage_path)
      else coalesce(em.web_storage_path, em.storage_path)
    end,
    case when t.character_miniature_id is not null
      then case when cm.web_storage_path is not null then regexp_replace(cm.original_name,'\.stl$','.web.glb','i') else cm.original_name end
      else case when em.web_storage_path is not null then regexp_replace(em.original_name,'\.stl$','.web.glb','i') else em.original_name end
    end,
    case when t.character_miniature_id is not null
      then case when cm.web_storage_path is not null then 'glb' else 'stl' end
      else case when em.web_storage_path is not null then 'glb' else 'stl' end
    end,
    case when t.character_miniature_id is not null then cp.storage_path else ep.storage_path end,
    t.revision
  from public.vtt_tokens t
  left join public.character_miniatures cm on cm.id=t.character_miniature_id
  left join public.vtt_enemy_models em on em.id=t.enemy_model_id
  left join public.character_miniature_paint_jobs cp on cp.miniature_id=cm.id and cp.is_default=true
  left join public.vtt_enemy_paint_jobs ep on ep.enemy_model_id=em.id and ep.is_default=true
  where t.scene_id=p_scene_id and (v_is_dm or t.visible_to_players=true)
  order by t.created_at,t.id;
end;
$$;

revoke all on function public.list_vtt_scene_tokens(uuid) from public, anon;
grant execute on function public.list_vtt_scene_tokens(uuid) to authenticated, service_role;

commit;
