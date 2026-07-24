"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NavIcon } from "./NavIcon";

type NavigationSignOutProps = {
  collapsed?: boolean;
  mobile?: boolean;
};

export function NavigationSignOut({
  collapsed = false,
  mobile = false,
}: NavigationSignOutProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isSigningOut}
      title={collapsed ? "Sign out" : undefined}
      className={`group flex items-center rounded-xl border border-transparent text-slate-400 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-wait disabled:opacity-60 ${
        mobile
          ? "w-full gap-3 px-4 py-3 text-left"
          : collapsed
            ? "h-11 w-full justify-center"
            : "w-full gap-3 px-3 py-2.5 text-left"
      }`}
    >
      <NavIcon name="logout" className="h-5 w-5 shrink-0" />
      {!collapsed && (
        <span className="text-sm font-medium">
          {isSigningOut ? "Signing out..." : "Sign out"}
        </span>
      )}
    </button>
  );
}
