import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/components/navigation/navigationTypes";

export type CurrentAppUser = {
  id: string;
  email: string | null;
  displayName: string;
  role: AppRole;
};

type ProfileRow = {
  display_name: string | null;
  role: string | null;
};

export const getCurrentAppUser = cache(
  async (): Promise<CurrentAppUser | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data } = await supabase
      .from("profiles")
      .select("display_name, role")
      .eq("id", user.id)
      .maybeSingle();

    const profile = data as ProfileRow | null;
    const role: AppRole = profile?.role === "dm" ? "dm" : "player";

    return {
      id: user.id,
      email: user.email ?? null,
      displayName:
        profile?.display_name?.trim() || user.email || "Expedition Member",
      role,
    };
  }
);
