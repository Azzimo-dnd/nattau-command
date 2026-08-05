"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000;

export function CampaignActivityHeartbeat({
  campaignSlug,
}: {
  campaignSlug: string;
}) {
  useEffect(() => {
    let active = true;

    async function touch() {
      if (!active || document.visibilityState === "hidden") return;
      const supabase = createClient();
      await supabase.rpc("touch_campaign_activity", {
        p_campaign_slug: campaignSlug,
      } as never);
    }

    void touch();
    const interval = window.setInterval(() => void touch(), HEARTBEAT_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void touch();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [campaignSlug]);

  return null;
}
