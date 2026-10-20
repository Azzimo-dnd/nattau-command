# Terrain Asset Studio Alpha

Application code is developed on `feature/vtt-terrain-asset-studio-alpha`. The add-only database migration was independently approved and applied to production.

## Scope
- Eight reproducible procedural terrain presets for the UC loading plaza.
- Local previews and GLB export; GM-only saved library after installing the SQL.
- No scene placement, movement blocking, player visibility, or VTT modifications.
- Models use Y up, centered X/Z, base at Y=0; one world unit equals one VTT grid square.
- Procedural source recipe includes a deterministic seed; generated GLBs are not player character miniatures.

## Migration and rollout
Migration file: `supabase/migrations/20261020102957_vtt_terrain_asset_studio_alpha.sql` (version aligned with Supabase history).
1. Check the generated models and route in a preview build.
2. The user explicitly authorized applying this additive migration to the existing production database (no extra paid branch). Audit the SQL and run GM RLS checks; keep application code on preview until separately approved.
3. Confirm normal players cannot access the studio, table, or storage bucket (policies installed; authenticated browser smoke test remains).
4. Upload and reload a model, then edit metadata, delete it and verify storage cleanup.
5. Database migration is now applied and verified. After GM browser smoke tests, merge/deploy the application only with separate approval.

Existing VTT scenes and tokens are deliberately untouched.

## Current development constraints
- The production Supabase project currently has no disposable database branch.
- Branch creation is billed hourly; it requires the user's explicit approval of the quoted cost.
- Never auto-apply migrations through branch CI or Vercel Preview. Production migration was explicitly authorized for this one change.
- Vercel previews inherit the current Supabase environment by default. A truly isolated end-to-end browser test requires a separate branch URL and publishable key plus a DM login in that branch.
- Running PostgreSQL tests in CI does not prove an authenticated browser's file-storage policies work against Supabase Storage.
- Current terrain storage limit is 50 MiB, matching the existing buckets. Larger GLBs (>6 MB) should use resumable TUS uploads in a future iteration; the current standard-upload path is not a reliable 50 MiB transfer test.
- Failed registration attempts compensate by removing uploaded files. Failed storage cleanups expose the orphan path for manual cleanup in the Supabase dashboard.
