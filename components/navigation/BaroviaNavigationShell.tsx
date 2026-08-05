"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { NavIcon } from "./NavIcon";
import {
  CampaignChatNotificationsProvider,
  CampaignChatUnreadBadge,
  useCampaignChatUnread,
} from "@/components/notifications/CampaignChatNotifications";
import { NavigationSignOut } from "./NavigationSignOut";
import { CampaignActivityHeartbeat } from "@/components/campaign-admin/CampaignActivityHeartbeat";
import type {
  AppRole,
  NavigationItem,
} from "./navigationTypes";
import styles from "./BaroviaNavigationShell.module.css";

type BaroviaNavigationShellProps = {
  children: ReactNode;
  role: AppRole;
  displayName?: string | null;
  canSwitchCampaign: boolean;
  enableSignOut?: boolean;
};

const primaryItems: NavigationItem[] = [
  {
    label: "Home",
    href: "/campaigns/barovia",
    icon: "home",
    exact: true,
  },
  {
    label: "Tarokka",
    href: "/campaigns/barovia/tarokka",
    icon: "fate",
  },
  {
    label: "Gathering",
    href: "/campaigns/barovia/session-planner",
    icon: "session",
  },
  {
    label: "Lost Souls",
    href: "/campaigns/barovia/characters",
    icon: "account",
  },
];

const desktopItems: NavigationItem[] = [
  ...primaryItems,
  {
    label: "Whispers",
    href: "/campaigns/barovia/whispers",
    icon: "chat",
  },
  {
    label: "The Duality",
    href: "/campaigns/barovia/dice",
    icon: "dice",
  },
  {
    label: "Atlas of the Mists",
    href: "/campaigns/barovia/map",
    icon: "map",
  },
];

function isActive(pathname: string, item: NavigationItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function DesktopItem({
  item,
  pathname,
}: {
  item: NavigationItem;
  pathname: string;
}) {
  const active = isActive(pathname, item);

  return (
    <Link
      href={item.href}
      className={`relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
        active
          ? "bg-[#5a1825]/45 text-[#efc7d1]"
          : "text-[#9f959a] hover:bg-[#2a171e]/80 hover:text-[#e5d6dc]"
      }`}
    >
      {active && (
        <span className="absolute left-0 h-6 w-0.5 rounded-r-full bg-[#b65e75]" />
      )}
      <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.href === "/campaigns/barovia/whispers" && (
        <CampaignChatUnreadBadge campaignSlug="barovia" theme="barovia" />
      )}
    </Link>
  );
}

function DesktopSidebar({
  pathname,
  role,
  displayName,
  canSwitchCampaign,
  enableSignOut,
}: {
  pathname: string;
  role: AppRole;
  displayName?: string | null;
  canSwitchCampaign: boolean;
  enableSignOut: boolean;
}) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 hidden w-[272px] flex-col border-r border-[#38222b] lg:flex ${styles.sidebar}`}>
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-[#38222b] px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#7b3a4e] bg-[#5a1825]/30 font-serif text-lg font-black text-[#efc7d1] shadow-lg shadow-black/30">
          BM
        </div>
        <div className="min-w-0">
          <p className="truncate font-serif text-sm font-black tracking-[0.14em] text-[#ead7dc]">
            BEYOND THE MISTS
          </p>
          <p className="mt-1 truncate text-[10px] uppercase tracking-[0.22em] text-[#8e707a]">
            Barovia · Daggerheart
          </p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#76515d]">
          The Mists
        </p>
        <div className="space-y-1">
          {desktopItems.map((item) => (
            <DesktopItem key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        {role === "dm" && (
          <section className="mt-7">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#76515d]">
              Game Master
            </p>
            <div className="space-y-2">
              <Link
                href="/campaigns/barovia/gm/members"
                className={`relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                  pathname.startsWith("/campaigns/barovia/gm/members")
                    ? "bg-[#5a1825]/45 text-[#efc7d1]"
                    : "text-[#9f959a] hover:bg-[#2a171e]/80 hover:text-[#e5d6dc]"
                }`}
              >
                {pathname.startsWith("/campaigns/barovia/gm/members") && (
                  <span className="absolute left-0 h-6 w-0.5 rounded-r-full bg-[#b65e75]" />
                )}
                <NavIcon name="account" className="h-5 w-5 shrink-0" />
                <span>Souls & Invitations</span>
              </Link>
              <div className="rounded-2xl border border-[#4b2935] bg-black/15 p-4">
                <p className="text-sm font-semibold text-[#d7bbc3]">
                  Campaign administration
                </p>
                <p className="mt-2 text-xs leading-5 text-[#8f8187]">
                  Manage access, test accounts, planning participation and player invitation codes.
                </p>
              </div>
            </div>
          </section>
        )}
      </nav>

      <div className="shrink-0 border-t border-[#38222b] p-3">
        {canSwitchCampaign && (
          <Link
            href="/campaigns"
            className="mb-2 flex min-h-11 items-center gap-3 rounded-xl border border-[#4b2935] bg-black/20 px-3 text-sm font-semibold text-[#cda6b0] transition hover:border-[#7b3a4e] hover:text-[#ecd5dc]"
          >
            <NavIcon name="campaigns" className="h-5 w-5" />
            Switch campaign
          </Link>
        )}

        <Link
          href="/account"
          className="mb-2 flex items-center gap-3 rounded-xl border border-[#39232c] bg-black/20 px-3 py-3 transition hover:border-[#633345]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5a1825]/35 text-sm font-bold text-[#e4bbc5]">
            {(displayName?.trim()?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#e3d5d9]">
              {displayName || "Wanderer"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#80636d]">
              {role === "dm" ? "Game Master" : "Player"}
            </p>
          </div>
        </Link>

        {enableSignOut && <NavigationSignOut />}
      </div>
    </aside>
  );
}

function MobileTopBar({ role }: { role: AppRole }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b border-[#3d252f] bg-[#0d090c]/92 px-4 backdrop-blur-xl lg:hidden">
      <Link href="/campaigns/barovia" className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#7a3a4e] bg-[#5a1825]/30 font-serif text-sm font-black text-[#efc7d1]">
          BM
        </span>
        <span>
          <span className="block font-serif text-xs font-black tracking-[0.13em] text-[#ead7dc]">
            BEYOND THE MISTS
          </span>
          <span className="mt-0.5 block text-[9px] uppercase tracking-[0.2em] text-[#80636d]">
            {role === "dm" ? "Game Master" : "Barovia"}
          </span>
        </span>
      </Link>
    </header>
  );
}

function MobileBottomNavigation({
  pathname,
  moreOpen,
  setMoreOpen,
}: {
  pathname: string;
  moreOpen: boolean;
  setMoreOpen: (value: boolean) => void;
}) {
  const { unreadMessages } = useCampaignChatUnread("barovia");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#3d252f] bg-[#0c080b]/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {primaryItems.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition ${
                active
                  ? "bg-[#5a1825]/40 text-[#efc7d1]"
                  : "text-[#77666c] active:bg-[#2a171e] active:text-[#ddd0d4]"
              }`}
            >
              <NavIcon name={item.icon} className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition ${
            moreOpen
              ? "bg-[#5a1825]/40 text-[#efc7d1]"
              : "text-[#77666c] active:bg-[#2a171e] active:text-[#ddd0d4]"
          }`}
        >
          <span className="relative">
            <NavIcon name="more" className="h-5 w-5" />
            {unreadMessages > 0 && (
              <CampaignChatUnreadBadge
                campaignSlug="barovia"
                theme="barovia"
                className="absolute -right-3 -top-2"
              />
            )}
          </span>
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

function MobileMoreSheet({
  open,
  onClose,
  canSwitchCampaign,
  displayName,
  role,
  enableSignOut,
}: {
  open: boolean;
  onClose: () => void;
  canSwitchCampaign: boolean;
  displayName?: string | null;
  role: AppRole;
  enableSignOut: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />
      <section className="absolute inset-x-0 bottom-0 max-h-[84vh] overflow-y-auto rounded-t-[28px] border-t border-[#55303e] bg-[#140d12] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#52323d]" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#9c5367]">
              Beyond the Mists
            </p>
            <h2 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">
              More
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#51303c] bg-black/20 text-[#a78f97]"
          >
            <NavIcon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            href="/campaigns/barovia/whispers"
            className="relative flex min-h-20 flex-col justify-between rounded-2xl border border-[#432832] bg-black/20 p-3 text-[#d1b6be]"
          >
            <div className="flex items-start justify-between gap-2">
              <NavIcon name="chat" className="h-5 w-5" />
              <CampaignChatUnreadBadge campaignSlug="barovia" theme="barovia" />
            </div>
            <span className="mt-3 text-sm font-semibold">Whispers</span>
          </Link>

          <Link
            href="/campaigns/barovia/dice"
            className="flex min-h-20 flex-col justify-between rounded-2xl border border-[#432832] bg-black/20 p-3 text-[#d1b6be]"
          >
            <NavIcon name="dice" className="h-5 w-5" />
            <span className="mt-3 text-sm font-semibold">The Duality</span>
          </Link>

          <Link
            href="/campaigns/barovia/map"
            className="flex min-h-20 flex-col justify-between rounded-2xl border border-[#432832] bg-black/20 p-3 text-[#d1b6be]"
          >
            <NavIcon name="map" className="h-5 w-5" />
            <span className="mt-3 text-sm font-semibold">Atlas</span>
          </Link>

          {role === "dm" && (
            <Link
              href="/campaigns/barovia/gm/members"
              className="flex min-h-20 flex-col justify-between rounded-2xl border border-[#694053] bg-[#2a111a]/65 p-3 text-[#e2bdc7]"
            >
              <NavIcon name="account" className="h-5 w-5" />
              <span className="mt-3 text-sm font-semibold">Souls & Invitations</span>
            </Link>
          )}

          {canSwitchCampaign && (
            <Link
              href="/campaigns"
              className="flex min-h-20 flex-col justify-between rounded-2xl border border-[#432832] bg-black/20 p-3 text-[#d1b6be]"
            >
              <NavIcon name="campaigns" className="h-5 w-5" />
              <span className="mt-3 text-sm font-semibold">Campaigns</span>
            </Link>
          )}

          <Link
            href="/account"
            className="col-span-2 flex items-center gap-3 rounded-2xl border border-[#432832] bg-black/20 p-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5a1825]/35 font-bold text-[#e4bbc5]">
              {(displayName?.trim()?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#e3d5d9]">
                {displayName || "Wanderer"}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#80636d]">
                {role === "dm" ? "Game Master" : "Player"}
              </p>
            </div>
          </Link>
        </div>

        {enableSignOut && (
          <div className="mt-5 border-t border-[#38222b] pt-4">
            <NavigationSignOut mobile />
          </div>
        )}
      </section>
    </div>
  );
}

function BaroviaNavigationContent({
  children,
  role,
  displayName,
  canSwitchCampaign,
  enableSignOut = true,
}: BaroviaNavigationShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const pageKey = useMemo(() => pathname, [pathname]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pageKey]);

  useEffect(() => {
    if (!moreOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [moreOpen]);

  return (
    <div className={`min-h-screen text-[#eadfe3] ${styles.shell}`}>
      <CampaignActivityHeartbeat campaignSlug="barovia" />
      <DesktopSidebar
        pathname={pathname}
        role={role}
        displayName={displayName}
        canSwitchCampaign={canSwitchCampaign}
        enableSignOut={enableSignOut}
      />

      <div className="min-h-screen lg:pl-[272px]">
        <MobileTopBar role={role} />
        <div className="min-h-screen pb-24 lg:pb-0">{children}</div>
      </div>

      <MobileBottomNavigation
        pathname={pathname}
        moreOpen={moreOpen}
        setMoreOpen={setMoreOpen}
      />

      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        canSwitchCampaign={canSwitchCampaign}
        displayName={displayName}
        role={role}
        enableSignOut={enableSignOut}
      />
    </div>
  );
}


export function BaroviaNavigationShell(props: BaroviaNavigationShellProps) {
  return (
    <CampaignChatNotificationsProvider
      campaignSlug="barovia"
      chatHref="/campaigns/barovia/whispers"
      theme="barovia"
    >
      <BaroviaNavigationContent {...props} />
    </CampaignChatNotificationsProvider>
  );
}
