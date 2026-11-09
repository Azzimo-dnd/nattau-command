# Nattau Settlement — Siege aftermath (testing branch)

## Confirmed story state
- The settlement survived the Imperial siege (22 October 2026), with morale held by Torsten's funeral speech.
- ~40 civilian deaths (including seven from booby-trapped Imperial bodies), 60 flying-galleon crew, five of KaRolK's soldiers, and Kealith. Mira is missing; Kevin was restored by Mother Tyllen.
- Most residential homes were burned; the warehouse and part of the stores burned; the flying galleon exploded.
- Pippo has pledged workers and materials, **but completion dates, precise resource costs and actual rebuilding progress have not been established**.
- Exact surviving population, post-battle military fortification condition and current food balance are **not known**. We display "Count pending", "Under assessment" and "Supplies damaged" instead of fabricating precise values.

## User-facing behavior
- Historical cartography stays unchanged and is visibly labeled **before the siege**.
- Building markers reflect current conditions when confirmed; otherwise their badges read **Last known** and use subdued pins.
- The dashboard summarizes population, morale, stores, defenses, losses and rebuilding.
- GM can update overview fields, edit any location's name/category/status/coordinates/icon/description/notes/progress and add locations.
- Non-GM members can view but cannot edit. Database RLS enforces this, even for direct client API calls.
- Rebuild progress is GM-managed display-only metadata; the app does **not** spend RP or invent automated project timers.

## DB architecture & testing
- Full historical location catalog remains a fallback in `components/settlement/settlementData.ts`.
- `campaign_settlement_buildings` stores canonical GM edits and new buildings, keyed by (campaign_id, building_key). Overrides are merged with the historical catalog at read time.
- `campaign_settlement_overview` stores eight summary values. Both tables have per-campaign member SELECT and GM-only INSERT/UPDATE policies; no DELETE endpoint in v1.
- Migration `supabase/migrations/20261023123000_nattau_settlement_aftermath.sql` initializes three **confirmed-damage** buildings and overview **only for Nattau**, never Barovia. Seed uses ON CONFLICT DO NOTHING to preserve manual changes.
- **The migration is intentionally not applied to production on this testing branch.** Until applied, the view displays truthful post-siege fallback and GM saves are disabled with a clear warning. Preview is for layout and content review; end-to-end persistence tests require a separately authorized DB migration.
- Production and Barovia are unchanged by PR #40 until it is explicitly approved, merged and migrated.

## Acceptance checklist
1. Nattau player sees post-siege dashboard, red destroyed galleon/residential district, orange damaged warehouse.
2. Historical unchanged landmarks are marked "Last known", not incorrectly confirmed as intact.
3. GM preview shows migration-pending notice and disabled editing before DB migration.
4. After an approved migration: GM can edit status, 0–100% rebuilding progress, notes and overview; reload to verify persistence.
5. GM can add a location without modifying static source.
6. Player cannot see edit buttons, and direct RLS INSERT/UPDATE is denied.
7. Barovia cannot access Nattau settlement records via a Barovia user.
8. Confirm no automatic RP spending, no rewritten Chronicle history, no unexpected updates to strategic units.
