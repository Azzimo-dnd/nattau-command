# VTT Cone (5e) / persisted spell areas

Players and GMs can use the **Cone** tool next to Ruler and Spell radius. Hold
the left mouse button over the map at the **origin**, drag to point the cone
and set its length, then release to leave the preview. To make it visible to
other participants during the drag, enable **Share live** on the toolbar.
The cone uses D&D 5e's flat-ended wedge rule: at length L, the full width
is L. It is a triangle in top-down view, not a circular-sector "pizza" end.

GM can name and color a cone in the Spell Areas card and **Pin current cone**.
The saved cone survives reload and can overlap existing circles and cones.
The existing Show/Hide/Remove buttons work unchanged; expanding **Edit**
on a saved cone changes length and heading in degrees without moving its origin.

The original `vtt_spell_areas.radius` column is retained for both:
- `shape_type = 'circle'`: circle radius
- `shape_type = 'cone'`: cone length, with direction in `direction_rad`
- Historical rows default to circle with direction 0; no existing effect is
  overwritten, removed or reinterpreted.

D&D 5e rule reference: https://roll20.net/compendium/dnd5e/Rules%3ARules%20Definitions
Foundry template types: https://foundryvtt.com/api/v11/enums/foundry.CONST.MEASURED_TEMPLATE_TYPES.html

Temporary templates use the established campaign Realtime channel and the same
heartbeat/expiry mechanism as shared circles. Persistent cones follow the
existing GM-only modification policy and scene/fog-aware player reads. Geometry
is a visual guide, not automatic target selection, damage or cover calculation.

**Deployment:** additive migration `supabase/migrations/20261022160000_vtt_cone_spell_areas.sql`
must be applied before the production app begins requesting the new columns.
