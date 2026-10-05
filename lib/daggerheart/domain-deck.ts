import type { DaggerheartCompendiumEntry } from "./compendium";

export type DomainCardIdentity = {
  compendium_id?: string | null;
  slug?: string | null;
  source_key?: string | null;
  name: string;
  domain?: string | null;
};
export type DomainCardUsage = DomainCardIdentity & {
  character_id: string;
  character_name: string;
  player_name: string;
};
const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";

// Older sheets may predate compendium IDs. Never match different sources by name.
export function sameDomainCard(a: DomainCardIdentity, b: DomainCardIdentity) {
  if (a.compendium_id && b.compendium_id) return a.compendium_id === b.compendium_id;
  if (a.source_key && b.source_key && a.source_key !== b.source_key) return false;
  if (a.slug && b.slug) return a.slug === b.slug;
  return Boolean(normalize(a.name) && normalize(a.domain)) &&
    normalize(a.name) === normalize(b.name) && normalize(a.domain) === normalize(b.domain);
}
export function entryIdentity(entry: DaggerheartCompendiumEntry): DomainCardIdentity {
  return { ...entry, compendium_id: entry.id };
}
export function cardHolders(card: DomainCardIdentity, usage: DomainCardUsage[], characterId?: string) {
  return usage.filter((row) => row.character_id !== characterId && sameDomainCard(card, row))
    .filter((row, index, all) => all.findIndex((other) => other.character_id === row.character_id) === index);
}
export function holderLabel(holder: DomainCardUsage) {
  return holder.player_name && holder.player_name !== holder.character_name
    ? `${holder.character_name} (${holder.player_name})` : holder.character_name;
}
