"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
} from "@/lib/puzzles/puzzleTypes";

type Options = {
  campaignId: string;
};

export function usePuzzleVault({ campaignId }: Options) {
  const [puzzles, setPuzzles] = useState<CampaignPuzzleRow[]>([]);
  const [runs, setRuns] = useState<Record<string, CampaignPuzzleRunRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const supabase = createClient();
    const { data, error: puzzleError } = await supabase
      .from("campaign_puzzles")
      .select(
        "id,campaign_id,title,description,puzzle_type,difficulty_label,public_config,move_limit,attempt_limit,time_limit_seconds,failure_message,is_visible,status,current_run_id,sort_order,created_at,updated_at"
      )
      .eq("campaign_id", campaignId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (puzzleError) {
      setError(
        puzzleError.message.includes("campaign_puzzles")
          ? "Puzzle Vault is not installed yet. Apply supabase/campaign-puzzle-vault-v1.sql."
          : puzzleError.message
      );
      if (!quiet) setLoading(false);
      return;
    }

    const puzzleRows = (data ?? []) as CampaignPuzzleRow[];
    setPuzzles(puzzleRows);

    const runIds = puzzleRows
      .map((puzzle) => puzzle.current_run_id)
      .filter((value): value is string => Boolean(value));

    if (runIds.length === 0) {
      setRuns({});
      setError(null);
      if (!quiet) setLoading(false);
      return;
    }

    const { data: runData, error: runError } = await supabase
      .from("campaign_puzzle_runs")
      .select(
        "id,puzzle_id,campaign_id,status,state,move_count,attempt_count,started_at,deadline_at,solved_at,failed_at,solved_by_user_id,solved_by_name,controller_user_id,controller_name,control_expires_at,version,updated_at"
      )
      .in("id", runIds);

    if (runError) {
      setError(runError.message);
    } else {
      const nextRuns: Record<string, CampaignPuzzleRunRow> = {};
      for (const run of (runData ?? []) as CampaignPuzzleRunRow[]) {
        nextRuns[run.id] = run;
      }
      setRuns(nextRuns);
      setError(null);
    }

    if (!quiet) setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    void load();
    const supabase = createClient();

    // A workshop page can mount more than one consumer of usePuzzleVault
    // (for example the main workshop and the maintenance panel). Supabase's
    // browser client is shared, so every subscription needs its own channel
    // topic. A fresh suffix also keeps React Strict Mode's effect replay from
    // trying to attach callbacks to a channel that is already subscribed while
    // the previous cleanup is still being removed asynchronously.
    const subscriptionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(`campaign-puzzle-vault-${campaignId}-${subscriptionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_puzzles",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void load(true)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_puzzle_runs",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void load(true)
      )
      .subscribe();

    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 15000);

    return () => {
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [campaignId, load]);

  return { puzzles, runs, loading, error, refresh: load };
}
