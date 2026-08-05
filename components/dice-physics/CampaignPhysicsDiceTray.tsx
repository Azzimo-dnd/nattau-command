"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSharedDiceSoundEngine } from "./diceSound";
import { PhysicsDiceScene } from "./PhysicsDiceScene";
import type {
  DiceLabStatus,
  DiceLabTheme,
  PhysicsRollRequest,
  PhysicsRollResult,
} from "./dicePhysicsTypes";

export function CampaignPhysicsDiceTray({
  theme,
  request,
  onComplete,
  heightClass = "h-[430px] sm:h-[520px]",
}: {
  theme: DiceLabTheme;
  request: PhysicsRollRequest | null;
  onComplete: (result: PhysicsRollResult) => void;
  heightClass?: string;
}) {
  const [status, setStatus] = useState<DiceLabStatus>("idle");
  const soundEngine = useMemo(() => getSharedDiceSoundEngine(), []);
  const latestRequestRef = useRef<PhysicsRollRequest | null>(request);

  useEffect(() => {
    latestRequestRef.current = request;
    if (!request) setStatus("idle");
  }, [request]);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border shadow-2xl ${heightClass} ${
        theme === "barovia"
          ? "border-[#522d3a] bg-[#090608]"
          : "border-slate-700 bg-[#090d11]"
      }`}
    >
      {request ? (
        <PhysicsDiceScene
          request={request}
          theme={theme}
          onStatus={setStatus}
          onComplete={onComplete}
          onImpact={(force) => {
            if (latestRequestRef.current?.settings.sound) soundEngine.impact(force);
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div>
            <p
              className={`font-serif text-2xl font-black ${
                theme === "barovia" ? "text-[#ead7dc]" : "text-slate-100"
              }`}
            >
              The physical tray is ready
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 opacity-55">
              The result will be read from the upper faces only after every die has stopped.
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/75 backdrop-blur-md">
          Rapier physics · 60 Hz
        </div>
        <div
          className={`rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] backdrop-blur-md ${
            theme === "barovia"
              ? "border-[#a64d66]/35 bg-[#39101f]/75 text-[#efb5c5]"
              : "border-yellow-400/25 bg-slate-950/75 text-yellow-300"
          }`}
        >
          {status}
        </div>
      </div>
    </div>
  );
}
