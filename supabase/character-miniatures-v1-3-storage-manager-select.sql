-- Character Miniatures v1.3 — allow GM-managed Storage uploads to return their object row under RLS
begin;

-- Supabase Storage may need SELECT visibility for the object row it just created
-- (and upsert explicitly requires SELECT + UPDATE). The campaign-member read policy
-- intentionally only exposes registered/current objects, so give the GM a separate
-- management-only SELECT lane for paths they are already authorized to manage.
drop policy if exists "GM miniature management read" on storage.objects;
create policy "GM miniature management read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'character-miniatures'
  and public.can_manage_character_miniature_object(name)
);

commit;
