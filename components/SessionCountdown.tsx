"use client";

import { useEffect, useState } from "react";
import { campaign } from "@/config/campaign";

export function SessionCountdown() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      const diff =
        campaign.nextSession.getTime() - new Date().getTime();

      if (diff <= 0) {
        setTimeLeft("The session has begun!");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff / (1000 * 60 * 60)) % 24
      );
      const minutes = Math.floor(
        (diff / (1000 * 60)) % 60
      );
      const seconds = Math.floor(
        (diff / 1000) % 60
      );

      setTimeLeft(
        `${days}d ${hours}h ${minutes}m ${seconds}s`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="rounded-2xl border border-yellow-600/30 bg-slate-900 p-5">
      <p className="text-xs uppercase tracking-[0.4em] text-yellow-500">
        Next Session
      </p>

      <h2 className="mt-2 text-3xl font-bold">
        {timeLeft}
      </h2>

      <p className="mt-2 text-slate-400">
        Prepare your equipment. Baldar is watching.
      </p>
    </section>
  );
}