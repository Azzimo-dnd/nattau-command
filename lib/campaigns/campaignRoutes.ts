export type ProtectedCampaignSlug = "nattau" | "barovia";

const nattauLegacyPrefixes = [
  "/characters",
  "/council",
  "/dice",
  "/fate",
  "/gm-chat",
  "/map",
  "/puzzles",
  "/resources",
  "/session-planner",
  "/settlement",
  "/vtt",
  "/war-room",
  "/gm/dice-lab",
  "/gm/miniatures",
  "/gm/puzzles",
  "/gm/session",
  "/gm/vtt",
] as const;

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Returns the campaign whose membership must be present before a route is
 * allowed to render. Nattau still has legacy top-level routes, so those are
 * explicitly mapped here instead of being treated as global app pages.
 */
export function campaignSlugForProtectedPath(
  pathname: string
): ProtectedCampaignSlug | null {
  if (matchesPrefix(pathname, "/campaigns/barovia")) return "barovia";
  if (matchesPrefix(pathname, "/campaigns/nattau")) return "nattau";

  if (nattauLegacyPrefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
    return "nattau";
  }

  return null;
}
