import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

/** Authenticate before joining a private table; never fall back to public. */
export function subscribeVttChannel(
  supabase: SupabaseClient,
  channel: RealtimeChannel,
  onStatus?: (status: string) => void,
) {
  let cancelled = false;
  void supabase.realtime.setAuth().then(() => {
    if (!cancelled) channel.subscribe(onStatus);
  }).catch(() => { if (!cancelled) onStatus?.("CHANNEL_ERROR"); });
  return () => { cancelled = true; void supabase.removeChannel(channel); };
}
