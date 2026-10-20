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
2. Apply `supabase/vtt-terrain-asset-studio-v0-1.sql` in a **development Supabase branch**, not production, and smoke-test GM permissions.
3. Confirm normal players cannot access the studio, table, or storage bucket.
4. Upload and reload a model, then edit metadata, delete it and verify storage cleanup.
5. Only after acceptance apply the migration and merge/deploy as separate approved work.

Existing VTT scenes and tokens are deliberately untouched.
