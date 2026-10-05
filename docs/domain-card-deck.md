# Character creation: shared domain deck

The guided character creation wizard uses the physical-style Domain Deck directly in Step 8 (`Domain Cards`). Eligible level 1 cards are loaded from the character's two class domains, while the existing class and subclass card-count rules are preserved. Standard characters choose two cards; School of Knowledge chooses three.

The same `DaggerheartDomainDeck` component powers both the isolated preview and the real creation flow, so visual fixes and interaction changes are not duplicated. In the wizard, selected cards are written straight into the character draft with their compendium identity, source, effective metadata, effects and actions; removing a card returns it to the deck. Wizard validation still requires the exact starting-card count, level 1 cards from the class domains, and Bare Bones when a character starts without armor.

Ownership labels come from saved active player characters in the same campaign. They use the character name and, when different, the campaign player display name. Multiple holders are listed; the edited character is excluded. Both loadout and vault count as owning a card. Unsaved choices do not reserve cards.

Players can inspect occupied cards. Selecting a shared copy requires acknowledging that the choice was discussed with the player or GM. This is a social confirmation, not a GM approval workflow or exclusive reservation. Availability refreshes on focus, every 20 seconds, and before selection. A failed availability request prevents selection rather than reporting the card as free.

## Database support

`supabase/migrations/20261005093155_daggerheart_domain_card_usage.sql` adds a narrow read-only RPC. It exposes card identity, character name and campaign display name to active members of that campaign, without granting access to full character sheets. It does not modify saved characters or tables.

The RPC has now been applied to the shared Supabase project and its two functions were verified to exist. Dependencies `private.is_active_daggerheart_campaign_member(uuid)` and `private.campaign_display_name(uuid, uuid, text)` were verified before applying it. The public wrapper is `SECURITY INVOKER`; the private projection performs the active-campaign-membership check and is not granted to anonymous users.

## Verification

- The Vercel preview build passed, including TypeScript.
- The real wizard renders `DaggerheartDomainCardPicker` in Step 8 and persists chosen cards into the existing character draft.
- The shared RPC prerequisite is installed and ready for signed-in preview testing.
- Four domain-deck tests previously passed, including real character labels, legacy card matching, same-campaign ownership projection and denial of anonymous/inactive/cross-campaign access.
- Supabase security advisor was checked after the migration; it did not flag the new public wrapper as an anonymous or authenticated `SECURITY DEFINER` function. Existing unrelated project warnings remain outside this feature's scope.

Manual signed-in checks before merge: create a standard character and select/remove two cards; use a School of Knowledge build with three slots; test Bare Bones without armor; browse on mobile; choose an occupied card with and without confirmation; rename a holder and refresh; confirm another campaign's characters never appear; save the character and confirm the chosen cards appear correctly on the play sheet.

## Isolated UI playground

`/login/domain-deck-test` is available only on Vercel preview deployments and local development (404 in production). It exercises the same deck component using clearly labelled demonstration cards, editable owner names, multiple holders, two/three-card hands and availability failure simulation. No character data is read or written.

For final acceptance, use the signed-in Barovia Character Manager creation flow rather than the playground. The playground remains useful for quick visual and mobile regression checks without touching character data.
