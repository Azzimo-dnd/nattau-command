# VTT miniature selection and formation movement

## Interaction
- **Navigate / Select (default)**: left click a token to select it. A click never moves it.
- **Shift/Ctrl/Meta + click**: add/remove a token from selection.
- **Shift + drag on empty floor**: draw a selection rectangle; tokens with centers inside are added.
- **Move selection** (GM-only explicit mode): hold left mouse button on a selected token and drag. The complete selected formation moves as one.
- A small pointer threshold suppresses unintended tiny drags.
- A formation previews only at free grid locations. A blocked/out-of-bounds destination displays a warning.
- Mouse release causes one atomic SQL call `move_vtt_token_formation`. If it fails, the preview returns to the original positions.
- **Reveal/Hide** in Selection can be used without triggering movement.
- Existing terrain dragging remains under the separate Terrain editor mode.

## Server protections

The function migration `supabase/migrations/20261022094425_vtt_group_formation_move.sql` was applied to the existing Supabase project
with a user-requested app feature change, leaving scene/token data unmodified.

- Runs SECURITY INVOKER: normal RLS applies.
- Explicitly requires campaign DM access to the scene and validates selected IDs.
- Locks token rows in the scene during the check and writes all selected positions atomically.
- Checks entire footprint against unselected actors (including hidden GM actors),
  selected actors and scene boundaries, not just destination center points.
- Rejects collisions or out-of-bounds positions for the whole formation.
- `anon`/PUBLIC EXECUTE revoked; authenticated role still needs GM checks.
- UI code remains on the test branch; no production app merge/deploy.

## Testing

The isolated Postgres tests cover atomic shifts, collision rejection, out-of-bounds
rejection, forged token IDs, duplicate IDs and authorization. Pure movement
tests cover formation preservation and rectangle selection. Final live mouse
gesture checks still require a GM in the Vercel preview.
