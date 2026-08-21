"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type HistoryDiceMode = "normal" | "advantage" | "disadvantage";

export type VttDiceHistoryRow = {
  id: string;
  scene_id: string;
  roll_key: string;
  roller_id: string | null;
  roller_name: string;
  expression: string;
  mode: HistoryDiceMode;
  modifier: number;
  total: number;
  details: Record<string, unknown>;
  created_at: string;
};

type SaveVttDiceRoll = {
  rollKey: string;
  sceneId: string;
  expression: string;
  mode: HistoryDiceMode;
  modifier: number;
  total: number;
  details: Record<string, unknown>;
};

function friendlyError(message: string) {
  if (message.includes("vtt_dice_rolls")) {
    return "VTT dice history is not installed yet. Apply supabase/vtt-dice-v0-4-2-history.sql before testing persistent history.";
  }
  return message;
}

export function useVttDiceHistory(sceneId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [rolls, setRolls] = useState<VttDiceHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!sceneId) {
      setRolls([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (!quiet) setLoading(true);
    const response = await supabase
      .from("vtt_dice_rolls")
      .select("id,scene_id,roll_key,roller_id,roller_name,expression,mode,modifier,total,details,created_at")
      .eq("scene_id", sceneId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (response.error) {
      setError(friendlyError(response.error.message));
    } else {
      setRolls((response.data ?? []) as VttDiceHistoryRow[]);
      setError(null);
    }
    if (!quiet) setLoading(false);
  }, [sceneId, supabase]);

  useEffect(() => {
    void load();
    if (!sceneId) return;

    const channel = supabase
      .channel(`vtt-dice-history-${sceneId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vtt_dice_rolls",
          filter: `scene_id=eq.${sceneId}`,
        },
        () => {
          void load(true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, sceneId, supabase]);

  const saveRoll = useCallback(async (roll: SaveVttDiceRoll) => {
    setSaving(true);
    setError(null);
    const response = await supabase
      .from("vtt_dice_rolls")
      .insert({
        scene_id: roll.sceneId,
        roll_key: roll.rollKey,
        expression: roll.expression,
        mode: roll.mode,
        modifier: roll.modifier,
        total: roll.total,
        details: roll.details,
      })
      .select("id,scene_id,roll_key,roller_id,roller_name,expression,mode,modifier,total,details,created_at")
      .single();

    setSaving(false);
    if (response.error) {
      setError(friendlyError(response.error.message));
      return false;
    }

    const saved = response.data as VttDiceHistoryRow;
    setRolls((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)].slice(0, 100));
    return true;
  }, [supabase]);

  const clearScene = useCallback(async () => {
    if (!sceneId) return false;
    setClearing(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from("vtt_dice_rolls")
      .delete()
      .eq("scene_id", sceneId);

    setClearing(false);
    if (deleteError) {
      setError(friendlyError(deleteError.message));
      return false;
    }

    setRolls([]);
    return true;
  }, [sceneId, supabase]);

  return {
    rolls,
    loading,
    saving,
    clearing,
    error,
    refresh: load,
    saveRoll,
    clearScene,
  };
}
