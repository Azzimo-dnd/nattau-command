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

The Alpha Grid scene is currently **inactive and hidden from players**;
its two old dice results remain GM-only even if the GM publishes it later.
The currently active shared scene is **Temple Platz** (Battle of UĆ);
it has 119 existing rolls, which must remain visible to the participants.

## Security and UX additions

- An optional GM **Public roll / GM secret** switch. New GM rolls are shared
  by default in a published scene; players always roll publicly.
- Public rolls continue to broadcast animation and result to the scene.
- A GM secret roll is animated only on the GM's client and saved as a private
  history entry, not broadcast to other viewers.
- Hidden/unpublished-scene GM rolls are secret even if the switch remains on.
- A new DB column `visible_to_players` is enforced by a scene-aware
  RLS SELECT policy; older rows from *hidden scenes* remain secret, while
  already shared battle rolls preserve their visibility.
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
`supabase/migrations/20261023092158_vtt_dice_roll_privacy.sql` has been
applied to production Supabase. Applying this migration is a release step;
the branch preview cannot use the new history fields against the old schema.

## Concurrent physical rolls (PR #38 extension)

The earlier VTT dice hook kept one global `activeRoll` and deliberately
ignored any overlapping remote `roll-start` event. This could hide player
throws from other participants even though completed rolls were in history.

Now multiple `rollId` entries run independently:
- **Up to 12 simultaneous active throws**, each with its own isolated Rapier
  physics world, stable 4×3 floor lane and readable participant nameplate.
- A result or timeout removes only that particular throw. Result notifications
  are individually deduplicated and up to twelve cards are shown in a compact, scrollable set
  for 10 seconds each; older entries remain in the persistent scene history.
- The **authoritative face values** still come from the person who rolled, not
  from other clients' non-identical local physics simulations.
- A participant cannot accidentally start another local roll before theirs
  completes; another participant is free to roll at the same time.
- GM-secret rolls are *never* broadcast to other participants.
- If 12 active rolls are already visible, the local roller receives an
  explicit capacity message. For the planned 7 players plus GM there are
  available lanes.

The new feature does **not** automatically enable a hidden scene for
players. `Temple Platz` is already active and player-visible, so this
is the best scene for a multi-client verification.

All preview build and source tests are helpful, but physical animation
synchronization still needs a **two-browser, two-account manual test** against
a shared scene before promotion to production. This PR remains a draft pending deployment; the production Supabase privacy migration has been installed.

## Production verification (2026-10-23)

Database migration installed as `supabase/migrations/20261023092158_vtt_dice_roll_privacy.sql`.
Live verification: 119 existing public rolls on Temple Platz retained, two GM-only
legacy rolls on Alpha Grid retained, total 121; 3 scenes and 25 tokens unchanged.
Existing per-campaign display-name lookup preserved, with GM-secret rows filtered
by RLS and the trigger RPC EXECUTE privilege revoked from anonymous clients.
