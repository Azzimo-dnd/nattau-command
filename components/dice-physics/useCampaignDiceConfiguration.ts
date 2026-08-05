"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_CAMPAIGN_DICE_PHYSICS,
  DEFAULT_DICE_APPEARANCE,
  normalizeCampaignDicePhysics,
} from "./dicePhysicsDefaults";
import { isDiceCosmeticId, isDiceNumberSize } from "./diceCosmetics";
import type {
  CampaignDicePhysicsSettings,
  DiceAppearanceSettings,
} from "./dicePhysicsTypes";

type UseCampaignDiceConfigurationOptions = {
  campaignId: string;
  currentUserId: string;
};

type PhysicsRow = {
  throw_force: number;
  spin_force: number;
  die_friction: number;
  tray_friction: number;
  restitution: number;
  linear_damping: number;
  angular_damping: number;
  gravity: number;
  cocked_threshold: number;
};

type PreferenceRow = {
  cosmetic_id: string;
  number_size: string;
  sound_enabled: boolean;
};

const LOCAL_PREFIX = "campaign-companion:dice-preferences";

function localKey(campaignId: string, currentUserId: string) {
  return `${LOCAL_PREFIX}:${campaignId}:${currentUserId}`;
}

function rowToPhysics(row: PhysicsRow | null): CampaignDicePhysicsSettings {
  if (!row) return DEFAULT_CAMPAIGN_DICE_PHYSICS;
  return normalizeCampaignDicePhysics({
    throwForce: row.throw_force,
    spinForce: row.spin_force,
    dieFriction: row.die_friction,
    trayFriction: row.tray_friction,
    restitution: row.restitution,
    linearDamping: row.linear_damping,
    angularDamping: row.angular_damping,
    gravity: row.gravity,
    cockedThreshold: row.cocked_threshold,
  });
}

function preferenceFromUnknown(value: unknown): DiceAppearanceSettings {
  if (!value || typeof value !== "object") return DEFAULT_DICE_APPEARANCE;
  const record = value as Record<string, unknown>;
  return {
    cosmeticId: isDiceCosmeticId(record.cosmeticId)
      ? record.cosmeticId
      : DEFAULT_DICE_APPEARANCE.cosmeticId,
    numberSize: isDiceNumberSize(record.numberSize)
      ? record.numberSize
      : DEFAULT_DICE_APPEARANCE.numberSize,
    sound:
      typeof record.sound === "boolean"
        ? record.sound
        : DEFAULT_DICE_APPEARANCE.sound,
  };
}

function rowToPreference(row: PreferenceRow | null): DiceAppearanceSettings {
  if (!row) return DEFAULT_DICE_APPEARANCE;
  return {
    cosmeticId: isDiceCosmeticId(row.cosmetic_id)
      ? row.cosmetic_id
      : DEFAULT_DICE_APPEARANCE.cosmeticId,
    numberSize: isDiceNumberSize(row.number_size)
      ? row.number_size
      : DEFAULT_DICE_APPEARANCE.numberSize,
    sound: row.sound_enabled,
  };
}

function missingTableMessage(message: string) {
  return message.includes("campaign_dice_physics_settings") ||
    message.includes("campaign_dice_preferences")
    ? "Shared player dice configuration is not installed yet. Run supabase/campaign-physics-dice-integration-v1.sql."
    : message;
}

export function useCampaignDiceConfiguration({
  campaignId,
  currentUserId,
}: UseCampaignDiceConfigurationOptions) {
  const [physics, setPhysics] = useState<CampaignDicePhysicsSettings>(
    DEFAULT_CAMPAIGN_DICE_PHYSICS
  );
  const [appearance, setAppearance] = useState<DiceAppearanceSettings>(
    DEFAULT_DICE_APPEARANCE
  );
  const [loading, setLoading] = useState(true);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [savingPhysics, setSavingPhysics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPhysics = useCallback(async () => {
    const supabase = createClient();
    const response = await supabase
      .from("campaign_dice_physics_settings")
      .select(
        "throw_force,spin_force,die_friction,tray_friction,restitution,linear_damping,angular_damping,gravity,cocked_threshold"
      )
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (response.error) {
      setError(missingTableMessage(response.error.message));
      return false;
    }

    setPhysics(rowToPhysics(response.data as PhysicsRow | null));
    return true;
  }, [campaignId]);

  const loadPreference = useCallback(async () => {
    const supabase = createClient();
    const response = await supabase
      .from("campaign_dice_preferences")
      .select("cosmetic_id,number_size,sound_enabled")
      .eq("campaign_id", campaignId)
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (response.error) {
      setError(missingTableMessage(response.error.message));
      return false;
    }

    if (response.data) {
      const resolved = rowToPreference(response.data as PreferenceRow);
      setAppearance(resolved);
      try {
        window.localStorage.setItem(
          localKey(campaignId, currentUserId),
          JSON.stringify(resolved)
        );
      } catch {
        // Database persistence still works when local storage is unavailable.
      }
    }
    return true;
  }, [campaignId, currentUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const stored = window.localStorage.getItem(localKey(campaignId, currentUserId));
      if (stored) setAppearance(preferenceFromUnknown(JSON.parse(stored)));
    } catch {
      // Local fallback is optional; database values remain authoritative.
    }

    await Promise.all([loadPhysics(), loadPreference()]);
    setLoading(false);
  }, [campaignId, currentUserId, loadPhysics, loadPreference]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`campaign-dice-config-${campaignId}-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_dice_physics_settings",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          void loadPhysics();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_dice_preferences",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload: any) => {
          const row = (payload.new ?? payload.old) as { user_id?: string };
          if (row.user_id === currentUserId) void loadPreference();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, currentUserId, loadPhysics, loadPreference]);

  const saveAppearance = useCallback(
    async (next: DiceAppearanceSettings) => {
      const sanitized = preferenceFromUnknown(next);
      setAppearance(sanitized);
      setSavingAppearance(true);
      setError(null);

      try {
        window.localStorage.setItem(
          localKey(campaignId, currentUserId),
          JSON.stringify(sanitized)
        );
      } catch {
        // Continue with Supabase.
      }

      const supabase = createClient();
      const { error: saveError } = await supabase
        .from("campaign_dice_preferences")
        .upsert(
          {
            campaign_id: campaignId,
            user_id: currentUserId,
            cosmetic_id: sanitized.cosmeticId,
            number_size: sanitized.numberSize,
            sound_enabled: sanitized.sound,
          },
          { onConflict: "campaign_id,user_id" }
        );

      setSavingAppearance(false);
      if (saveError) {
        setError(missingTableMessage(saveError.message));
        return false;
      }
      return true;
    },
    [campaignId, currentUserId]
  );

  const savePhysics = useCallback(
    async (next: CampaignDicePhysicsSettings) => {
      const sanitized = normalizeCampaignDicePhysics(next);
      setSavingPhysics(true);
      setError(null);
      const supabase = createClient();
      const { error: saveError } = await supabase
        .from("campaign_dice_physics_settings")
        .upsert(
          {
            campaign_id: campaignId,
            throw_force: sanitized.throwForce,
            spin_force: sanitized.spinForce,
            die_friction: sanitized.dieFriction,
            tray_friction: sanitized.trayFriction,
            restitution: sanitized.restitution,
            linear_damping: sanitized.linearDamping,
            angular_damping: sanitized.angularDamping,
            gravity: sanitized.gravity,
            cocked_threshold: sanitized.cockedThreshold,
          },
          { onConflict: "campaign_id" }
        );

      setSavingPhysics(false);
      if (saveError) {
        setError(missingTableMessage(saveError.message));
        return false;
      }
      setPhysics(sanitized);
      return true;
    },
    [campaignId]
  );

  return {
    physics,
    appearance,
    loading,
    savingAppearance,
    savingPhysics,
    error,
    setError,
    refresh: load,
    saveAppearance,
    savePhysics,
  };
}
