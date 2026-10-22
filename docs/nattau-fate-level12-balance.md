# Nattau Fate Tarot — High-level reward rebalance

## Why
At 10–12th level a single `+1d4` on a check or `2 × proficiency bonus`
damage prevention can be negligible. This targeted pass only changes 7 of the
24 *active* reward faces (12 active cards × 2 orientations). Ten unfinished
arcana remain inactive and unchanged.

**Scale numbers at the moment the one-use reward is triggered**, using the
character's then-current level and proficiency bonus; do not freeze values at
the draw's date. All restrictions (once, trigger, caster/target, duration)
remain unless explicitly described below.

| Arcana / face | Before | After | At level 12 (PB +4) |
|---|---|---|---|
| Magician upright | +1d4 to one Arcana/Investigation/tool check | +2 × PB | +8 to eligible check |
| Lovers reversed | +1d4 to ally's failed ability check | +2 × PB | +8 to ally's check |
| Chariot reversed | +10 ft speed for one turn, ignore difficult terrain | +5 ft × PB | +20 ft |
| Wheel of Fortune upright | Reroll one non-d20 damage/healing/random die, use new value | Choose one target of damage/healing: reroll up to PB dice, keep the higher value of each, AND add character level to that target's damage or healing; alternatively reroll one random-effect die, new result mandatory | Up to 4 improved dice plus 12 damage/healing to **one target**, not a blanket AoE bonus |
| Death reversed | Regain 1 spent Hit Die after a short rest | Once during a short rest, regain up to PB expended Hit Dice; may spend any immediately for normal healing | Restore up to 4 Hit Dice, optionally heal with them |
| Tower reversed | Reduce damage after failed Dex save by 2 × PB | Reduce event damage after resistance/vulnerability by level × PB, minimum 0 | **48 damage prevented** |
| Star reversed | Maximize one healing die | Maximize up to PB healing dice affecting you AND regain character level extra HP, capped by max HP | Maximize up to 4 healing dice, plus 12 HP |

## Rewards deliberately unchanged
- Fool (both): d20 reroll, alternative check
- Magician reversed: resourceful tool substitution
- High Priestess (both): true GM answer / situational advantage
- Lovers upright: Inspiration for another character
- Chariot upright: free half-speed disengaged advance
- Strength (both): advantage on STR / remain at 1 HP
- Hermit (both): reliable information
- Wheel reversed: turn a natural 1 into 10
- Hanged Man (both): second approach / grant another PC advantage
- Death upright: remove a debilitating condition
- Tower upright: cancel a critical hit
- Star upright: floor a d20 roll at 10

### Design cautions
- A single high-damage spell can affect many targets; **Wheel** improves only
  one affected creature, never every creature in the area.
- The **Tower** is strong because it is single-use, limited to a failed Dex
  save and cannot restore hit points after damage. Apply resistance first.
- `PB × level` gets much larger in tier 4 (e.g. 20 × 6 = 120); review again
  when the party nears level 17, rather than inflating all face rewards now.
- These one-off rewards supplement core class features; they do not change
  D&D advancement, proficiency or saving throw rules.

## Migration and already claimed cards
Migration: `supabase/migrations/20261022123840_nattau_fate_high_level_balance.sql`.

The **fate_cards** table is the live deck, but each reveal copies the selected
reward into **fate_draws.reward_description_snapshot**. This is intentional.

The migration updates the live face definitions and only matching snapshots
from cycle **6 — Battle of UĆ**, which was active during review. Older
cycles and unused card faces are untouched. In particular, Rabarbar's already
drawn **Tower, reversed** displays the GM-approved formula after application.

The current production Supabase database has **not** been modified by writing
this feature branch. Apply the migration only when the GM approves the balance
and the deploy is ready.

## Production migration (2026-10-22)
The approved migration was applied to the production Supabase database as
`supabase/migrations/20261022123840_nattau_fate_high_level_balance.sql`. Post-migration inspection confirmed 7 revised active faces,
1 updated Tower reversed snapshot in Battle of UĆ, and unchanged totals of
22 card definitions and 20 draw records. Older draw snapshots were not rewritten.
