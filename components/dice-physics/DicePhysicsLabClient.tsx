"use client";

import dynamic from "next/dynamic";
import type { DiceLabTheme } from "./dicePhysicsTypes";

const DynamicDicePhysicsLab = dynamic(
  () => import("./DicePhysicsLab").then((module) => module.DicePhysicsLab),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-white/10 bg-black/20 p-8 text-center">
        <div>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
          <p className="mt-4 text-sm opacity-65">Loading Three.js and Rapier…</p>
        </div>
      </div>
    ),
  }
);

export function DicePhysicsLabClient(props: {
  theme: DiceLabTheme;
  campaignName: string;
  campaignId: string;
  currentUserId: string;
}) {
  return <DynamicDicePhysicsLab {...props} />;
}
