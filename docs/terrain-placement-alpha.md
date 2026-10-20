# Terrain Placement Alpha — UC battle board

This milestone connects **saved** models from Terrain Asset Studio with GM VTT scenes.
The saved GLB remains in the private `vtt-terrain-assets` bucket. Each scene object
is a `vtt_scene_terrain_instances` record with its own location, rotation and scale.

## GM workflow

1. Sign in as campaign GM and open the VTT on the feature-branch preview.
2. Scroll to **Terrain · Saved 3D props** in the GM side panel.
3. Select a saved model such as Small Cargo Crate; this activates the **Terrain** toolbar mode.
4. Click the map floor to place it. Repeat for more instances.
5. Choose **Move existing** to work with placed props without creating new ones on the floor.
   Hold left click on a 3D crate and **drag it directly on the map**. Release the mouse to
   commit one position update. The model follows the pointer and preserves the grab offset.
   If saving fails, the preview reverts and the GM sees the database error.
6. **Snap movement to grid squares** is optional (off by default for smooth placement).
   You can also select props from **Placed objects**, rotate by 45°, edit scale and press
   **Apply scale**, duplicate or delete.
7. Choose **Place new** again to return to stamping copies onto empty floor cells.
8. Reload; positions are stored per scene in Supabase.

The migration `supabase/migrations/20261020111442_vtt_scene_terrain_instances_alpha.sql` was applied to the current Supabase database on
2026-10-20 after the owner requested the VTT integration. It is an additive table
and four GM-only row policies. No existing VTT scenes, tokens, or terrain assets
were modified. The production *application* has not been merged/deployed.

## Limitations and safety

- Only campaign GMs can read / edit scene terrain. There is **no player-read policy**
  and terrain is not rendered in the player view until reviewed against fog of war.
- No collisions, line of sight or automatic cover rules yet.
- Scene placement uses model dimensions from the library and a centered, grounded GLB.
- Deleting an asset with instances is intentionally blocked by the foreign-key
  restriction; remove its scene instances before deleting the source model.
- In the preview you must be signed in with GM access to the relevant campaign.
- Production database is shared with preview, so GM test placements persist there.

## Interaction safeguards

- Moving a prop temporarily disables the orbit camera; camera navigation works normally afterwards.
- A short press selects a prop without moving it (pointer-movement threshold).
- Only the final dragged position is sent to Supabase, not every pointer-move frame.
- Releasing outside the canvas or cancelling a browser pointer gesture resets the unsaved preview.
- Terrain placement and editing are GM-only; no player scene access is enabled yet.
