"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CampaignDiceRollRow,
  NewCampaignDiceRoll,
} from "./diceTypes";

type UseCampaignDiceLogOptions = {
  campaignId: string;
  currentUserId: string;
};

export function useCampaignDiceLog({
  campaignId,
  currentUserId,
}: UseCampaignDiceLogOptions) {
  const [rolls, setRolls] = useState<CampaignDiceRollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRolls = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);

      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("campaign_dice_rolls")
        .select(
          "id,campaign_id,user_id,roller_name,system_key,roll_kind,title,expression,total,outcome,visibility,details,created_at"
        )
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (loadError) {
        setError(
          loadError.message.includes("campaign_dice_rolls")
            ? "Dice history is not installed yet. Run supabase/multi-campaign-dice-rolls.sql."
            : loadError.message
        );
      } else {
        setRolls((data ?? []) as CampaignDiceRollRow[]);
        setError(null);
      }

      if (!quiet) setLoading(false);
    },
    [campaignId]
  );

  useEffect(() => {
    void loadRolls();

    const supabase = createClient();
    const channel = supabase
      .channel(`campaign-dice-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_dice_rolls",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          void loadRolls(true);
        }
      )
      .subscribe();

    const fallbackInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadRolls(true);
      }
    }, 15000);

    return () => {
      window.clearInterval(fallbackInterval);
      void supabase.removeChannel(channel);
    };
  }, [campaignId, loadRolls]);

  const saveRoll = useCallback(
    async (roll: NewCampaignDiceRoll) => {
      setSaving(true);
      setError(null);

      const supabase = createClient();
      const { data, error: saveError } = await supabase
        .from("campaign_dice_rolls")
        .insert({
          campaign_id: campaignId,
          roll_kind: roll.roll_kind,
          title: roll.title,
          expression: roll.expression ?? null,
          total: roll.total ?? null,
          outcome: roll.outcome ?? null,
          visibility: roll.visibility,
          details: roll.details ?? {},
        })
        .select(
          "id,campaign_id,user_id,roller_name,system_key,roll_kind,title,expression,total,outcome,visibility,details,created_at"
        )
        .single();

      setSaving(false);

      if (saveError) {
        setError(saveError.message);
        return null;
      }

      const saved = data as CampaignDiceRollRow;
      setRolls((current) => [
        saved,
        ...current.filter((entry) => entry.id !== saved.id),
      ].slice(0, 50));
      return saved;
    },
    [campaignId]
  );

  const deleteRoll = useCallback(async (rollId: string) => {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("campaign_dice_rolls")
      .delete()
      .eq("id", rollId);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    setRolls((current) => current.filter((entry) => entry.id !== rollId));
    return true;
  }, []);

  const clearMyRolls = useCallback(async () => {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("campaign_dice_rolls")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", currentUserId);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    setRolls((current) =>
      current.filter((entry) => entry.user_id !== currentUserId)
    );
    return true;
  }, [campaignId, currentUserId]);

  return {
    rolls,
    loading,
    saving,
    error,
    setError,
    refresh: loadRolls,
    saveRoll,
    deleteRoll,
    clearMyRolls,
  };
}
