# Shared VTT measurements and persistent spell areas

## Status

Implemented on branch `feature/vtt-terrain-asset-studio-alpha`. The Vercel preview is independent of the
production app. The schema migration `supabase/migrations/20261022115551_vtt_spell_areas.sql`
must be applied to the **existing** Supabase project before persistent areas
can be saved or listed. Never reapply after it is already in migration history.

## Ruler and spell radius (live)

- Open an active, player-visible scene and choose **Ruler** or **Spell radius / Area**.
- By default, only the person drawing sees the measurement.
- Enable **Share live** to publish the current measurement through the private
  campaign Realtime channel to other participants on the same scene.
- A moving radius/ruler is sent at approximately 10 frames/second, with the
  final endpoint sent on release. **Clear** or changing tools retracts your
  shared measurement.
- A stationary shared measurement periodically sends a heartbeat. If a sender
  disconnects unexpectedly, viewers discard the abandoned measurement after
  approximately 20 seconds.
- Other participants' shared measurements are rendered independently; they do
  not replace your own ruler or radius. These are ephemeral and not persisted.

## Multiple persistent overlapping spell areas

1. As GM, draw a radius using the **Spell radius / Area** tool.
2. In **Spell areas**, enter a name, pick a color and choose whether players may
   see it.
3. Click **Pin current spell radius**. The result becomes a separate saved circle
   on the scene, retaining its original position and radius after page reload.
4. Repeat for Fire, Poison, Frost, Shadow, Holy and Blood effects, or multiple
   circles of the same type. Areas can overlap without replacing each other.
5. The GM can **Hide**, **Show** or **Remove** each pinned area independently.
   Hiding is a visibility change, not deletion.

## Safety and permissions

- A player reads only pinned areas on the active, player-visible scene that
  have `visible_to_players = true` **and** whose centers are revealed by fog
  of war (plus any client fog overlay masking their unrevealed portions).
- Only a campaign GM may insert, update or delete pinned areas, verified by
  Postgres RLS. Positions/labels/colors/radii are validated at the database.
- The preview shares a database with production. Schema changes must be
  additive and non-destructive, preserving all scene, token and fog data.
- GLB terrain and token interactions are separate from this feature.

## Verification

CI runs unit and isolated PostgreSQL tests for multiple areas, player/GM
policies, hidden areas, invalid geometry, shared measurement validation and
existing VTT behavior. A live GM/player, two-browser smoke test is additionally
needed after the migration is applied to verify Realtime delivery and fog
visibility against actual data.
