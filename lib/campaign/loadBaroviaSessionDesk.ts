import { createClient } from "@/lib/supabase/server";
import type { SessionPlannerData } from "@/components/session-planner/plannerTypes";
import type { TarokkaCycle, TarokkaProgressRow } from "@/components/tarokka/tarokkaTypes";
import { buildBaroviaSessionOverview, sessionDeskWindow, type OmenUsage, type TarokkaReadiness } from "./baroviaSessionDesk";

/** Called only after the route has verified Barovia GM membership; RLS/RPCs also enforce access. */
export async function loadBaroviaSessionDesk(campaignId: string) {
  const client = await createClient();
  const now = new Date();
  const [plannerResult, progressResult, cycleResult] = await Promise.allSettled([
    client.rpc("get_session_planner_data", { p_campaign_slug: "barovia", p_month_start: sessionDeskWindow(now).monthStart }),
    client.rpc("get_tarokka_cycle_progress", { p_campaign_id: campaignId }),
    client.from("tarokka_cycles").select("id,campaign_id,cycle_number,title,is_active,draws_open,started_at,closed_at")
      .eq("campaign_id", campaignId).eq("is_active", true).maybeSingle(),
  ]);
  const planner = plannerResult.status === "fulfilled" && !plannerResult.value.error
    ? plannerResult.value.data as SessionPlannerData | null : null;
  let tarokka: TarokkaReadiness | null = null;
  if (progressResult.status === "fulfilled" && !progressResult.value.error &&
      cycleResult.status === "fulfilled" && !cycleResult.value.error) {
    const cycle = cycleResult.value.data as TarokkaCycle | null;
    const progress = (progressResult.value.data ?? []) as TarokkaProgressRow[];
    const drawIds = progress.flatMap((row) => row.draw_id ? [row.draw_id] : []);
    tarokka = { cycle, progress, usage: [] };
    if (cycle && drawIds.length) {
      try {
        const result = await client.from("tarokka_draws").select("id,cycle_id,used_at,revealed_at")
          .eq("campaign_id", campaignId).eq("cycle_id", cycle.id).is("voided_at", null).in("id", drawIds);
        if (result.error) tarokka = null;
        else tarokka.usage = (result.data ?? []) as OmenUsage[];
      } catch {
        tarokka = null;
      }
    }
  }
  return buildBaroviaSessionOverview({ campaignId, planner, tarokka, now });
}
