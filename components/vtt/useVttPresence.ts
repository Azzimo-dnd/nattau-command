"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type VttPresenceMember = {
  userId: string;
  name: string;
  role: "dm" | "player";
};

type Props = {
  campaignId: string;
  currentUserId: string;
  currentUserName: string;
  isDm: boolean;
};

export function useVttPresence({ campaignId, currentUserId, currentUserName, isDm }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<VttPresenceMember[]>([]);

  useEffect(() => {
    const channel = supabase.channel(`vtt-presence-${campaignId}`, {
      config: { presence: { key: currentUserId } },
    });

    const sync = () => {
      const state = channel.presenceState<Record<string, unknown>>();
      const next: VttPresenceMember[] = [];
      for (const [userId, entries] of Object.entries(state)) {
        const entry = Array.isArray(entries) ? entries[0] as { name?: string; role?: string } | undefined : undefined;
        if (!entry) continue;
        next.push({
          userId,
          name: entry.name?.trim() || "Campaign member",
          role: entry.role === "dm" ? "dm" : "player",
        });
      }
      next.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "dm" ? -1 : 1));
      setMembers(next);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: currentUserName, role: isDm ? "dm" : "player", online_at: new Date().toISOString() });
        }
      });

    return () => { void supabase.removeChannel(channel); };
  }, [campaignId, currentUserId, currentUserName, isDm, supabase]);

  return members;
}
