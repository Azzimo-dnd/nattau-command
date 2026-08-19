-- Character Miniature Skins v1.3 — only orphan paint objects may be cleaned up directly
begin;

create or replace function public.can_cleanup_character_paint_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select public.can_manage_character_paint_object(object_name)
    and not exists (
      select 1
      from public.character_miniature_paint_jobs pj
      where pj.storage_path = object_name
    );
$$;

revoke all on function public.can_cleanup_character_paint_object(text) from public, anon;
grant execute on function public.can_cleanup_character_paint_object(text) to authenticated, service_role;

drop policy if exists "Character miniature paint cleanup" on storage.objects;
create policy "Character miniature paint cleanup"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'character-miniature-paints'
  and public.can_cleanup_character_paint_object(name)
);

commit;
