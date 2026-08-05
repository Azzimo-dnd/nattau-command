"use client";

import dynamic from "next/dynamic";
import type {
  DiceLabTheme,
  PhysicsRollRequest,
  PhysicsRollResult,
} from "./dicePhysicsTypes";

const DynamicTray = dynamic(
  () =>
    import("./CampaignPhysicsDiceTray").then(
      (module) => module.CampaignPhysicsDiceTray
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[430px] items-center justify-center rounded-3xl border border-white/10 bg-black/25 sm:h-[520px]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
          <p className="mt-4 text-sm opacity-60">Loading the physics engine…</p>
        </div>
      </div>
    ),
  }
);

export function CampaignPhysicsDiceTrayClient(props: {
  theme: DiceLabTheme;
  request: PhysicsRollRequest | null;
  onComplete: (result: PhysicsRollResult) => void;
  heightClass?: string;
}) {
  return <DynamicTray {...props} />;
}
