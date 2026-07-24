"use client";

import { useEffect, useMemo, useState } from "react";
import type { CampaignSessionStatus } from "@/lib/campaign/sessionTypes";

type RemainingTime = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  hasStarted: boolean;
};

type NextSessionCountdownProps = {
  status: CampaignSessionStatus;
  target: string | null;
  message: string;
};

function calculateRemaining(target: string): RemainingTime | null {
  const targetTime = new Date(target).getTime();

  if (!Number.isFinite(targetTime)) {
    return null;
  }

  const rawDifference = targetTime - Date.now();
  const difference = Math.max(0, rawDifference);

  return {
    days: Math.floor(difference / 86_400_000),
    hours: Math.floor((difference % 86_400_000) / 3_600_000),
    minutes: Math.floor((difference % 3_600_000) / 60_000),
    seconds: Math.floor((difference % 60_000) / 1_000),
    hasStarted: rawDifference <= 0,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function NextSessionCountdown({
  status,
  target,
  message,
}: NextSessionCountdownProps) {
  const isScheduled = status === "scheduled" && Boolean(target);
  const [remaining, setRemaining] = useState<RemainingTime | null>(null);

  useEffect(() => {
    if (!isScheduled || !target) {
      setRemaining(null);
      return;
    }

    const scheduledTarget = target;

    function update() {
      setRemaining(calculateRemaining(scheduledTarget));
    }

    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [isScheduled, target]);

  const sessionLabel = useMemo(() => {
    if (!isScheduled || !target) return null;

    const date = new Date(target);
    if (!Number.isFinite(date.getTime())) return null;

    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }, [isScheduled, target]);

  if (!isScheduled || !sessionLabel) {
    return (
      <div className="min-w-0 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 lg:min-w-[320px]">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Next Session
        </p>
        <div className="mt-3 flex items-start gap-3">
          <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-lg text-yellow-300">
            ?
          </span>
          <div>
            <p className="font-bold text-slate-100">Not announced yet</p>
            <p className="mt-1 max-w-sm text-sm leading-5 text-slate-400">
              {message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const units = remaining
    ? [
        [pad(remaining.days), "days"],
        [pad(remaining.hours), "hours"],
        [pad(remaining.minutes), "min"],
        [pad(remaining.seconds), "sec"],
      ]
    : [
        ["--", "days"],
        ["--", "hours"],
        ["--", "min"],
        ["--", "sec"],
      ];

  return (
    <div className="min-w-0 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 lg:min-w-[320px]">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        Next Session
      </p>
      <p className="mt-2 font-bold text-slate-100">{sessionLabel}</p>
      {message && (
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
          {message}
        </p>
      )}

      {remaining?.hasStarted ? (
        <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-center text-sm font-bold text-green-300">
          The appointed hour has arrived.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {units.map(([value, label]) => (
            <div key={label} className="rounded-xl bg-slate-900 px-2 py-2">
              <p className="text-lg font-black text-yellow-300">{value}</p>
              <p className="text-[9px] uppercase tracking-wide text-slate-600">
                {label}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
