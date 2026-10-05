# Character creation: shared domain deck

The creation wizard shows eligible level 1 domain cards as a horizontal deck with domain filters, search, a full rules dialog, previous/next navigation, and a starting hand. Existing class and subclass card-count rules are preserved.

Ownership labels come from saved active player characters in the same campaign. They use the character name and, when different, the campaign player display name. Multiple holders are listed; the edited character is excluded. Both loadout and vault count as owning a card. Unsaved choices do not reserve cards.

Players can inspect occupied cards. Selecting a shared copy requires acknowledging that the choice was discussed with the player or GM. This is a social confirmation, not a GM approval workflow or exclusive reservation. Availability refreshes on focus, every 20 seconds, and before selection. A failed availability request prevents selection rather than reporting the card as free.

## Deployment prerequisite

`supabase/migrations/20261005093155_daggerheart_domain_card_usage.sql` adds a narrow read-only RPC. It exposes card identity, character name and campaign display name to active members of that campaign, without granting access to full character sheets. It does not modify saved characters or tables.

The migration is prepared but has NOT been applied to the shared production database. Apply it to the intended test database before testing actual card selection. Do not merge this feature into production before the RPC is available. Dependencies `private.is_active_daggerheart_campaign_member(uuid)` and `private.campaign_display_name(uuid, uuid, text)` were verified to exist in the current project.

## Verification

- TypeScript check passed.
- Focused ESLint check passed.
- Four domain-deck tests passed, including real character labels, legacy card matching, same-campaign ownership projection and denial of anonymous/inactive/cross-campaign access.
- Browser verification remains pending: the local environment has no Supabase frontend variables and its Chromium process failed to start successfully. No visual or signed-in end-to-end result is claimed.

Manual preview checks: select/remove two cards; use a School of Knowledge build with three slots; browse on mobile; choose an occupied card with and without confirmation; rename a holder and refresh; confirm another campaign's characters never appear.

## Isolated UI playground

`/login/domain-deck-test` is available only on Vercel preview deployments and local development (404 in production). It exercises the same deck component using clearly labelled demonstration cards, editable owner names, multiple holders, two/three-card hands and availability failure simulation. No character data is read or written. This enables UI testing before the RPC is installed; it does not verify the signed-in wizard or database integration.
