# VTT dice — shared and secret rolls

## Current behavior (verified 2026-10-22)

The VTT already has a scene-specific dice history saved in `public.vtt_dice_rolls`.
History stores roller, expression, total, modifier, mode, detailed physical dice
faces and metadata. The VTT shows the most recent 100 rows for the open scene;
the database is not limited to 100. Records are deleted when the scene is
deleted; only the GM can clear a scene's history.

On an **active scene visible to players**, both GM and players join a private
Supabase channel `vtt:dice:{sceneId}`. A `roll-start` broadcasts the dice
appearance, physical dice specifications and throw settings so other viewers
see a 3D reenactment; a `roll-result` contains the authoritative total
calculated on the thrower's client. Participants also see an on-screen toast
with the roller's name, expression and result.

3D physics is simulated locally on each participant's hardware. The **result
sent by the roller is authoritative**; local physics may not reproduce
identical final resting faces under differing client simulation timesteps.
The new result toast therefore includes the authoritative per-die values,
which are also visible in persistent history.

The existing Alpha Grid scene is active but **not visible to players**, so
its dice are GM-only until the GM enables scene visibility. It currently
has two historical GM rolls.

## Proposed security and UX additions — branch only, no production migration

- An optional GM **Public roll / GM secret** switch. New GM rolls are shared
  by default in a published scene; players always roll publicly.
- Public rolls continue to broadcast animation and result to the scene.
- A GM secret roll is animated only on the GM's client and saved as a private
  history entry, not broadcast to other viewers.
- Hidden/unpublished-scene GM rolls are secret even if the switch remains on.
- A new DB column `visible_to_players` is enforced by a scene-aware
  RLS SELECT policy; older rows are conservatively classified secret.
- The trigger prevents players saving private rolls; new public rolls from
  older clients remain public by DB default, to allow an additive migration
  before a frontend deploy.
- In History the GM sees all rows with a SECRET badge; players see only public
  entries even after the scene is later made visible.

## Testing

`tests/vtt-dice-visibility.test.ts` exercises scene publish/unpublish,
shared GM/player rolls, secret GM rolls, legacy privacy, and the trigger/RLS.
`npm test` and `npm run build` are required before any production release.

**Do not deploy code before migration**
`supabase/migrations/20261022183500_vtt_dice_roll_privacy.sql` has been
applied to the environment. The migration has not been applied to the
production Supabase project yet; the branch preview builds, but its history
query cannot fully function against the old schema until then.
