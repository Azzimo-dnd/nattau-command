"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { NavIcon } from "./NavIcon";
import { NavigationSignOut } from "./NavigationSignOut";
import {
  getNavigationSections,
  isRouteActive,
  mobilePrimaryItems,
} from "./navigationConfig";
import type {
  AppRole,
  NavigationItem,
  NavigationSection,
} from "./navigationTypes";
import styles from "./NavigationShell.module.css";

const STORAGE_KEY = "nattau-navigation-collapsed";
const MOBILE_HIDDEN_HREFS = new Set([
  ...mobilePrimaryItems.map((item) => item.href),
  "/account",
]);

type AppNavigationShellProps = {
  children: ReactNode;
  role: AppRole;
  displayName?: string | null;
  enableSignOut?: boolean;
};

function DesktopNavigationItem({
  item,
  pathname,
  collapsed,
}: {
  item: NavigationItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isRouteActive(pathname, item);

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`relative flex min-h-11 items-center rounded-xl transition ${
        collapsed ? "justify-center px-2" : "gap-3 px-3"
      } ${
        active
          ? `bg-yellow-500/10 text-yellow-300 ${styles.activeGlow}`
          : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
      }`}
    >
      {active && (
        <span className="absolute left-0 h-6 w-0.5 rounded-r-full bg-yellow-400" />
      )}
      <NavIcon
        name={item.icon}
        className={`h-5 w-5 shrink-0 ${active ? "text-yellow-300" : ""}`}
      />
      {!collapsed && (
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {item.label}
        </span>
      )}
    </Link>
  );
}

function DesktopSidebar({
  role,
  displayName,
  collapsed,
  setCollapsed,
  pathname,
  enableSignOut,
  sections,
}: {
  role: AppRole;
  displayName?: string | null;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  pathname: string;
  enableSignOut: boolean;
  sections: NavigationSection[];
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 hidden border-r border-slate-800/90 lg:flex lg:flex-col ${styles.sidebarBackground} transition-[width] duration-300 ${
        collapsed ? "w-[84px]" : "w-[272px]"
      }`}
    >
      <div
        className={`flex h-20 shrink-0 items-center border-b border-slate-800/80 ${
          collapsed ? "justify-center px-3" : "gap-3 px-5"
        }`}
      >
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 ${styles.brandMark}`}
        >
          <span className="font-serif text-lg font-black">NC</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-serif text-sm font-black tracking-[0.16em] text-yellow-300">
              NATTAU COMMAND
            </p>
            <p className="mt-1 truncate text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Kainite Expedition
            </p>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.label}>
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-8 bg-slate-800" />
              ) : (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">
                  {section.label}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <DesktopNavigationItem
                    key={`${section.label}-${item.href}-${item.label}`}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-slate-800/80 p-3">
        {!collapsed && (
          <Link
            href="/account"
            className="mb-2 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3 transition hover:border-yellow-600/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-sm font-bold text-yellow-300">
              {(displayName?.trim()?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-200">
                {displayName || "Expedition Member"}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {role === "dm" ? "Game Master" : "Player"}
              </p>
            </div>
          </Link>
        )}

        {enableSignOut && <NavigationSignOut collapsed={collapsed} />}

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`mt-2 flex h-10 items-center rounded-xl text-slate-500 transition hover:bg-slate-800/70 hover:text-slate-200 ${
            collapsed ? "w-full justify-center" : "w-full gap-3 px-3"
          }`}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <NavIcon
            name="collapse"
            className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

function MobileTopBar({ role }: { role: AppRole }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b border-slate-800/90 bg-slate-950/90 px-4 backdrop-blur-xl lg:hidden">
      <Link href="/" className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-yellow-500/30 bg-yellow-500/10 font-serif text-sm font-black text-yellow-300">
          NC
        </span>
        <span>
          <span className="block font-serif text-xs font-black tracking-[0.14em] text-yellow-300">
            NATTAU COMMAND
          </span>
          <span className="mt-0.5 block text-[9px] uppercase tracking-[0.2em] text-slate-500">
            {role === "dm" ? "Game Master" : "Kainite Expedition"}
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
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-800/90 bg-slate-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {mobilePrimaryItems.map((item) => {
          const active = isRouteActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition ${
                active
                  ? "bg-yellow-500/10 text-yellow-300"
                  : "text-slate-500 active:bg-slate-800 active:text-slate-200"
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
          aria-expanded={moreOpen}
          aria-controls="mobile-more-navigation"
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition ${
            moreOpen
              ? "bg-yellow-500/10 text-yellow-300"
              : "text-slate-500 active:bg-slate-800 active:text-slate-200"
          }`}
        >
          <NavIcon name="more" className="h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

function MobileMoreSheet({
  open,
  onClose,
  sections,
  pathname,
  role,
  displayName,
  enableSignOut,
}: {
  open: boolean;
  onClose: () => void;
  sections: NavigationSection[];
  pathname: string;
  role: AppRole;
  displayName?: string | null;
  enableSignOut: boolean;
}) {
  const secondarySections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => !MOBILE_HIDDEN_HREFS.has(item.href)
          ),
        }))
        .filter((section) => section.items.length > 0),
    [sections]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/75 backdrop-blur-sm ${styles.sheetBackdrop}`}
      />
      <section
        id="mobile-more-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
        className={`absolute inset-x-0 bottom-0 max-h-[84vh] overflow-y-auto rounded-t-[28px] border-t border-slate-700 bg-slate-900 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl ${styles.sheetPanel}`}
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-700" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-yellow-500">Navigation</p>
            <h2 className="mt-2 text-2xl font-black text-slate-100">More</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 text-slate-400 transition active:bg-slate-800"
          >
            <NavIcon name="close" className="h-5 w-5" />
          </button>
        </div>

        <Link
          href="/account"
          className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-500/10 font-bold text-yellow-300">
            {(displayName?.trim()?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-100">
              {displayName || "Expedition Member"}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {role === "dm" ? "Game Master" : "Player"}
            </p>
          </div>
        </Link>

        <div className="mt-6 space-y-6">
          {secondarySections.map((section) => (
            <section key={section.label}>
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                {section.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {section.items.map((item) => {
                  const active = isRouteActive(pathname, item);
                  return (
                    <Link
                      key={`${section.label}-${item.href}-${item.label}`}
                      href={item.href}
                      className={`flex min-h-20 flex-col justify-between rounded-2xl border p-3 transition active:scale-[0.98] ${
                        active
                          ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                          : "border-slate-800 bg-slate-950/50 text-slate-300"
                      }`}
                    >
                      <NavIcon name={item.icon} className="h-5 w-5" />
                      <span className="mt-3 text-sm font-semibold">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {enableSignOut && (
          <div className="mt-6 border-t border-slate-800 pt-4">
            <NavigationSignOut mobile />
          </div>
        )}
      </section>
    </div>
  );
}

export function AppNavigationShell({
  children,
  role,
  displayName,
  enableSignOut = true,
}: AppNavigationShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsedState] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const sections = useMemo(() => getNavigationSections(role), [role]);

  useEffect(() => {
    setCollapsedState(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  function setCollapsed(value: boolean) {
    setCollapsedState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }

  return (
    <div className={`min-h-screen text-slate-100 ${styles.shellBackground}`}>
      <DesktopSidebar
        role={role}
        displayName={displayName}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        pathname={pathname}
        enableSignOut={enableSignOut}
        sections={sections}
      />
      <div
        className={`min-h-screen transition-[padding] duration-300 ${
          collapsed ? "lg:pl-[84px]" : "lg:pl-[272px]"
        }`}
      >
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
        sections={sections}
        pathname={pathname}
        role={role}
        displayName={displayName}
        enableSignOut={enableSignOut}
      />
    </div>
  );
}
