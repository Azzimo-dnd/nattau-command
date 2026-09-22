"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
  PuzzlePresence,
} from "@/lib/puzzles/puzzleTypes";

type Options = {
  campaignId: string;
  puzzleId: string;
  currentUserId: string;
  currentUserName: string;
  role: "dm" | "player";
};

export function usePuzzleRoom({
  campaignId,
  puzzleId,
  currentUserId,
  currentUserName,
  role,
}: Options) {
  const [puzzle, setPuzzle] = useState<CampaignPuzzleRow | null>(null);
  const [run, setRun] = useState<CampaignPuzzleRunRow | null>(null);
  const [watchers, setWatchers] = useState<PuzzlePresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPreview, setLastPreview] = useState<JsonRecord | null>(null);
  const [gmSolution, setGmSolution] = useState<JsonRecord | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const supabase = createClient();
    const { data, error: puzzleError } = await supabase
      .from("campaign_puzzles")
      .select(
        "id,campaign_id,title,description,puzzle_type,difficulty_label,public_config,move_limit,attempt_limit,time_limit_seconds,failure_message,is_visible,is_test_visible,status,current_run_id,sort_order,created_at,updated_at"
      )
      .eq("id", puzzleId)
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (puzzleError) {
      setError(puzzleError.message);
      if (!quiet) setLoading(false);
      return;
    }
    if (!data) {
      setPuzzle(null);
      setRun(null);
      setError("This puzzle is hidden, archived, or no longer available.");
      if (!quiet) setLoading(false);
      return;
    }

    const nextPuzzle = data as CampaignPuzzleRow;
    setPuzzle(nextPuzzle);

    if (!nextPuzzle.current_run_id) {
      setRun(null);
      setError(null);
      if (!quiet) setLoading(false);
      return;
    }

    const { data: runData, error: runError } = await supabase
      .from("campaign_puzzle_runs")
      .select(
        "id,puzzle_id,campaign_id,status,state,move_count,attempt_count,move_limit_override,started_at,deadline_at,solved_at,failed_at,solved_by_user_id,solved_by_name,controller_user_id,controller_name,control_expires_at,version,updated_at"
      )
      .eq("id", nextPuzzle.current_run_id)
      .maybeSingle();

    if (runError) setError(runError.message);
    else {
      setRun((runData as CampaignPuzzleRunRow | null) ?? null);
      setError(null);
    }
    if (!quiet) setLoading(false);
  }, [campaignId, puzzleId]);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const changes = supabase
      .channel(`campaign-puzzle-state-${puzzleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_puzzles", filter: `id=eq.${puzzleId}` },
        () => void load(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_puzzle_runs", filter: `puzzle_id=eq.${puzzleId}` },
        () => void load(true)
      )
      .subscribe();

    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 12000);

    return () => {
      window.clearInterval(fallback);
      void supabase.removeChannel(changes);
    };
  }, [load, puzzleId]);

  useEffect(() => {
    if (!run?.id) return;
    const supabase = createClient();
    let cancelled = false;
    let room: RealtimeChannel | null = null;

    const setup = async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      const activeRoom = supabase.channel(`campaign-puzzle:${run.id}`, {
        config: {
          private: true,
          broadcast: { self: false, ack: false },
          presence: { key: currentUserId },
        },
      });
      room = activeRoom;
      roomChannelRef.current = activeRoom;

      activeRoom
        .on("presence", { event: "sync" }, () => {
          const state = activeRoom.presenceState() as Record<string, PuzzlePresence[]>;
          const merged = Object.values(state).flat();
          const unique = new Map<string, PuzzlePresence>();
          for (const person of merged) unique.set(person.userId, person);
          setWatchers([...unique.values()]);
        })
        .on("broadcast", { event: "preview" }, (payload) => {
          setLastPreview((payload.payload ?? null) as JsonRecord | null);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await activeRoom.track({
              userId: currentUserId,
              name: currentUserName,
              role,
              onlineAt: new Date().toISOString(),
            } satisfies PuzzlePresence);
          }
        });
    };

    void setup();
    return () => {
      cancelled = true;
      roomChannelRef.current = null;
      if (room) void supabase.removeChannel(room);
    };
  }, [currentUserId, currentUserName, role, run?.id]);

  const sendPreview = useCallback(async (payload: JsonRecord) => {
    const channel = roomChannelRef.current;
    if (!channel) return;
    await channel.send({ type: "broadcast", event: "preview", payload });
  }, []);

  const takeControl = useCallback(async () => {
    if (!run) return false;
    setBusy(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("take_campaign_puzzle_control", {
      p_run_id: run.id,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return false;
    }
    await load(true);
    return Boolean(data);
  }, [load, run]);

  const releaseControl = useCallback(async () => {
    if (!run) return false;
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("release_campaign_puzzle_control", {
      p_run_id: run.id,
    });
    if (rpcError) {
      setError(rpcError.message);
      return false;
    }
    await load(true);
    return Boolean(data);
  }, [load, run]);

  const applyAction = useCallback(async (action: JsonRecord) => {
    if (!run) return null;
    setBusy(true);
    setError(null);
    await sendPreview({ kind: "action", action, actor: currentUserName, at: Date.now() });
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("apply_campaign_puzzle_action", {
      p_run_id: run.id,
      p_action: action,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return null;
    }
    await load(true);
    return data as JsonRecord;
  }, [currentUserName, load, run, sendPreview]);

  const revealSequence = useCallback(async () => {
    if (!run) return null;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("reveal_campaign_puzzle_sequence", {
      p_run_id: run.id,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return null;
    }
    await load(true);
    return Array.isArray(data) ? (data as string[]) : [];
  }, [load, run]);

  useEffect(() => {
    if (!run?.id || run.controller_user_id !== currentUserId || run.status !== "active") return;

    let cancelled = false;
    const runId = run.id;

    const renewControl = async () => {
      const supabase = createClient();
      const { data, error: heartbeatError } = await supabase.rpc(
        "heartbeat_campaign_puzzle_control",
        { p_run_id: runId },
      );

      if (cancelled) return;
      if (heartbeatError || data !== true) {
        await load(true);
      }
    };

    // Renew immediately. The previous implementation waited 15 seconds, while
    // the 12-second fallback refresh replaced the run object and restarted this
    // effect before the heartbeat could ever fire.
    void renewControl();
    const interval = window.setInterval(() => void renewControl(), 15000);
    const onWake = () => {
      if (document.visibilityState === "visible") void renewControl();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [currentUserId, load, run?.controller_user_id, run?.id, run?.status]);

  useEffect(() => {
    if (!run?.deadline_at || run.status !== "active") return;
    const deadline = new Date(run.deadline_at).getTime();
    const timeout = window.setInterval(async () => {
      if (Date.now() < deadline) return;
      const supabase = createClient();
      await supabase.rpc("expire_campaign_puzzle_run", { p_run_id: run.id });
      await load(true);
      window.clearInterval(timeout);
    }, 1000);
    return () => window.clearInterval(timeout);
  }, [load, run?.deadline_at, run?.id, run?.status]);

  const adjustMoveLimit = useCallback(async (delta: number) => {
    if (!run || role !== "dm" || !Number.isInteger(delta) || delta === 0) return false;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("adjust_campaign_puzzle_move_limit", {
      p_run_id: run.id,
      p_delta: delta,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return false;
    }
    await load(true);
    return true;
  }, [load, role, run]);

  const revealSolution = useCallback(async () => {
    if (!run || role !== "dm") return null;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("get_campaign_puzzle_solution", {
      p_run_id: run.id,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return null;
    }
    const solution = (data ?? null) as JsonRecord | null;
    setGmSolution(solution);
    return solution;
  }, [role, run]);

  const hideSolution = useCallback(() => setGmSolution(null), []);

  const hasControl = useMemo(
    () => Boolean(run && run.status === "active" && run.controller_user_id === currentUserId),
    [currentUserId, run]
  );

  return {
    puzzle,
    run,
    watchers,
    loading,
    busy,
    error,
    lastPreview,
    gmSolution,
    hasControl,
    refresh: load,
    takeControl,
    releaseControl,
    applyAction,
    revealSequence,
    adjustMoveLimit,
    revealSolution,
    hideSolution,
    sendPreview,
  };
}
