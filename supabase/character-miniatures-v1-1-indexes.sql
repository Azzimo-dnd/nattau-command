-- Character Miniatures v1.1 — cover foreign keys flagged by the database advisor
begin;

create index if not exists character_miniatures_player_id_idx
  on public.character_miniatures (player_id);

create index if not exists character_miniatures_uploaded_by_idx
  on public.character_miniatures (uploaded_by);

commit;
