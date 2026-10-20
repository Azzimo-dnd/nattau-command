# Terrain Asset Studio Alpha

This feature is developed on `feature/vtt-terrain-asset-studio-alpha`, separate from production.

## Scope
- Eight reproducible procedural terrain presets for the UC loading plaza.
- Local previews and GLB export; GM-only saved library after installing the SQL.
- No scene placement, movement blocking, player visibility, or VTT modifications.
- Models use Y up, centered X/Z, base at Y=0; one world unit equals one VTT grid square.
- Procedural source recipe includes a deterministic seed; generated GLBs are not player character miniatures.

## Safe rollout
1. Check the generated models and route in a preview build.
2. Apply `supabase/migrations/20261020103000_vtt_terrain_asset_studio_alpha.sql` in a **development Supabase branch**, not production, and smoke-test GM permissions.
3. Confirm normal players cannot access the studio, table, or storage bucket.
4. Upload and reload a model, then edit metadata, delete it and verify storage cleanup.
5. Only after acceptance apply the migration and merge/deploy as separate approved work.

Existing VTT scenes and tokens are deliberately untouched.

## Current development constraints
- The production Supabase project currently has no disposable database branch.
- Branch creation is billed hourly; it requires the user's explicit approval of the quoted cost.
- Do not apply this migration to the production project as part of branch CI or the preview deployment.
- Vercel previews inherit the current Supabase environment by default. A truly isolated end-to-end browser test requires a separate branch URL and publishable key plus a DM login in that branch.
- Running PostgreSQL tests in CI does not prove an authenticated browser's file-storage policies work against Supabase Storage.
- Large GLBs (>6 MB) should eventually use resumable TUS uploads; the current standard-upload path should not be treated as a reliable 75 MB transfer test.
- Failed registration attempts compensate by removing uploaded files. Failed storage cleanups expose the orphan path for manual cleanup in the Supabase dashboard.
