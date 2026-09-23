"use client";

import type { CSSProperties, ReactNode } from "react";
import type { DaggerheartCompendiumCategory } from "@/lib/daggerheart/compendium";

const domainSlug: Record<string, string> = {
  Arcana: "arcana",
  Blade: "blade",
  Bone: "bone",
  Codex: "codex",
  Grace: "grace",
  Midnight: "midnight",
  Sage: "sage",
  Splendor: "splendor",
  Valor: "valor",
  Dread: "dread",
};

export function DaggerheartDomainIcon({
  domain,
  className = "size-4",
}: {
  domain: string;
  className?: string;
}) {
  const slug = domainSlug[domain];
  if (!slug) return null;

  const style: CSSProperties = {
    backgroundColor: "currentColor",
    WebkitMaskImage: `url("/daggerheart/domains/${slug}.svg")`,
    maskImage: `url("/daggerheart/domains/${slug}.svg")`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };

  return <span aria-hidden="true" className={`inline-block shrink-0 ${className}`} style={style} />;
}

function IconFrame({ children, className = "size-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 fill-none stroke-current ${className}`}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function DaggerheartCategoryIcon({
  category,
  className,
}: {
  category: DaggerheartCompendiumCategory;
  className?: string;
}) {
  if (category === "class" || category === "subclass") {
    return (
      <IconFrame className={className}>
        <path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z" />
        <path d="m12 7 1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4L12 7Z" />
      </IconFrame>
    );
  }

  if (category === "ancestry") {
    return (
      <IconFrame className={className}>
        <circle cx="12" cy="7" r="3" />
        <path d="M5.5 20c.8-4.2 3-6.4 6.5-6.4s5.7 2.2 6.5 6.4" />
        <path d="M7 4.5 4.5 3M17 4.5 19.5 3" />
      </IconFrame>
    );
  }

  if (category === "community") {
    return (
      <IconFrame className={className}>
        <path d="m3 11 9-7 9 7" />
        <path d="M5.5 10v10h13V10M9 20v-6h6v6" />
      </IconFrame>
    );
  }

  if (category === "transformation") {
    return (
      <IconFrame className={className}>
        <path d="M18.5 14.5A7 7 0 1 1 9.5 5a6 6 0 0 0 9 9.5Z" />
        <path d="m17.5 4 .5 1.5L19.5 6 18 6.5 17.5 8 17 6.5 15.5 6l1.5-.5.5-1.5Z" />
      </IconFrame>
    );
  }

  if (category === "domain_card") {
    return (
      <IconFrame className={className}>
        <rect x="5" y="4" width="11" height="15" rx="1.5" />
        <path d="M9 8h3M9 12h4M9 16h2" />
        <path d="M16 7h3v13H9v-1" />
      </IconFrame>
    );
  }

  if (category === "beastform") {
    return (
      <IconFrame className={className}>
        <circle cx="7" cy="8" r="1.8" />
        <circle cx="12" cy="6" r="1.8" />
        <circle cx="17" cy="8" r="1.8" />
        <path d="M7.5 17.5c0-2.7 2-5 4.5-5s4.5 2.3 4.5 5c0 1.5-1.1 2.5-2.5 2.5-.8 0-1.4-.4-2-.9-.6.5-1.2.9-2 .9-1.4 0-2.5-1-2.5-2.5Z" />
      </IconFrame>
    );
  }

  if (category === "martial_stance") {
    return (
      <IconFrame className={className}>
        <path d="m7 4 3 3-4.5 4.5L3 9l4-5ZM17 4l-3 3 4.5 4.5L21 9l-4-5Z" />
        <path d="m8 13 4 4 4-4M12 17v4" />
      </IconFrame>
    );
  }

  if (category === "weapon_primary") {
    return (
      <IconFrame className={className}>
        <path d="m18.5 3-7 7 2.5 2.5 7-7L21 3h-2.5Z" />
        <path d="m9.5 10.5 4 4M8 12l4 4M10 16l-5 5M4 18l2 2" />
      </IconFrame>
    );
  }

  if (category === "weapon_secondary") {
    return (
      <IconFrame className={className}>
        <path d="m15.5 3-5 8 2.5 2.5 6-7L19 3h-3.5Z" />
        <path d="m9 11 4 4M10.5 15.5 6 20" />
        <path d="M4 14.5c1.8-.9 3.5-.9 5 0-1 2.8-2.7 4.8-5 5.8-1.1-2.1-1.1-4 0-5.8Z" />
      </IconFrame>
    );
  }

  if (category === "armor") {
    return (
      <IconFrame className={className}>
        <path d="M12 3 20 6v5c0 5-3 8.2-8 10-5-1.8-8-5-8-10V6l8-3Z" />
        <path d="M8 9h8M12 6.5v10" />
      </IconFrame>
    );
  }

  if (category === "loot_item") {
    return (
      <IconFrame className={className}>
        <path d="M4 9h16v10H4zM3 9l2-4h14l2 4" />
        <path d="M9 9v3h6V9M12 12v4" />
      </IconFrame>
    );
  }

  return (
    <IconFrame className={className}>
      <path d="M9 3h6M10 3v5l-5 9a2.5 2.5 0 0 0 2.2 4h9.6A2.5 2.5 0 0 0 19 17l-5-9V3" />
      <path d="M7.5 15h9" />
      <path d="M10 12.5h4" />
    </IconFrame>
  );
}
