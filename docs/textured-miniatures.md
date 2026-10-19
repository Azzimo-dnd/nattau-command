# Textured miniatures and visual scale

The GM character miniature manager and enemy studio accept STL and self-contained glTF 2.0 binary (`.glb`) files up to 50 MB. GLB imports retain every scene mesh, node transform, material and embedded texture. Source files remain unchanged; the web copy records calibration in `asset.extras.nattauMiniature` and keeps the original binary chunk byte for byte.

## Using the import

1. Choose a character in **GM → Miniatures**, or open **GM → Enemy studio**.
2. Choose an STL or GLB. For GLB, export embedded PNG/JPEG textures without Draco or KTX2 compression.
3. Select a reference campaign and miniature. Pippo is preferred when present. The reference appears on the right at its saved default scale; another accessible campaign can supply the reference.
4. Use **Match Pippo's height**, then adjust **Default visual scale** between 10% and 1000%. Height includes weapons and bases, so unusual poses can need manual correction. **Fit view** reframes both models.
5. **Upload miniature & save scale** stores the calibrated web model. The source and web files are uploaded before the character's current version changes.

On the VTT, **Selection → Visual scale** adjusts one or multiple selected tokens from 10% to 1000%, relative to the saved default. **Creature size** still determines the occupied grid squares. Changing visual scale keeps that footprint unchanged. Reset returns to 100% of the import's calibration. Existing scene save/copy/duplicate operations retain the token scale.

Rendering multiplies the normalized base footprint (0.82 grid units), saved visual scale, token scale, and creature size. It therefore works across models exported with different coordinate units. This follows the useful separation between artwork scale and grid dimensions described in [Foundry's token documentation](https://foundryvtt.com/article/tokens/).

## Compatibility and limits

- Existing STL uploads, indexed web GLBs and per-triangle painted skins keep their original triangle order and painting workflow.
- Imported GLB materials render in the preview, character gallery and VTT. Hidden GM tokens receive independent material instances so their transparency does not affect visible tokens sharing the same asset.
- The triangle painter cannot edit imported GLB textures. Change those in a 3D editor and import a new version. The enemy library displays **Original materials** for GLB imports.
- External texture/buffer links, textual `.gltf`, OBJ/MTL bundles, Draco meshes and KTX2 textures are not supported in this version. Embedded PNG/JPEG GLB is the portable option. Models are shown in their static pose.
- Scaling is visual and grid-relative, not a physical millimetre conversion. The reference comparison is a guide for character proportions.
- If the registration response is lost, the uploaded files are retained because the database may already have committed. Refresh before retrying. Failures before registration clean up the files uploaded by that attempt.

## Database rollout

`supabase/character-miniatures-v2-textured-glb.sql` adds `register_character_miniature_asset`. It validates GM access, active campaign membership, exact source/web paths, supported formats, file sizes and existence of both storage objects; a transaction lock serializes new uploads per character. The existing STL RPC and RLS/storage policies remain compatible with the production client.

Applied through the migration service on 2026-10-19 as `20261019202327_character_miniatures_textured_glb`. Verified the function exists with an empty search path, authenticated execution and no anonymous execution. Tests used isolated databases and synthetic models; no campaign miniature was replaced during verification. New environments need this SQL after the existing miniature migrations.

## Verification

```sh
npm test
npm run build
```

The model tests check binary preservation, all mesh transforms/materials, grounding, scale validation and independent hidden-token materials. PGlite tests execute the registration SQL with the existing table schema, verify atomic version switching and reject unauthorized/cross-campaign/missing-file calls.

The optional browser suite bundles the real viewer, VTT, character manager and enemy studio with local fixtures and mocked Supabase calls. It does not expose a production route or write to live storage. It checks texture decoding after save/reload, comparison with Pippo, manual percentage entry, unchanged token footprint, mobile layout, both upload payloads, failed registration, and STL conversion with painted skins.

```sh
# Optional test tools; production dependencies are unchanged.
npm install --no-save --package-lock=false playwright esbuild
npx playwright install chromium
node tests/miniature-browser-check.mjs
```

The runner uses localhost port 4173 and writes screenshots to `/tmp/miniature-browser`. `PLAYWRIGHT_MODULE_PATH`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and `MINIATURE_BROWSER_OUTPUT` can point to existing test tools and an output directory. Browser checks use generated test meshes, not the actual Pippo asset; the reference name and roster are mocked.
