-- Character Miniature Skins v1.1 — covering indexes for player/creator foreign keys
begin;

create index if not exists character_miniature_paint_jobs_player_id_idx
  on public.character_miniature_paint_jobs (player_id);

create index if not exists character_miniature_paint_jobs_created_by_idx
  on public.character_miniature_paint_jobs (created_by);

commit;
