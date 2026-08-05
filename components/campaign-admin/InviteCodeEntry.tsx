"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteCodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function continueToInvite() {
    const cleaned = code.trim().replace(/\s+/g, "").toUpperCase();
    if (!cleaned) return;
    router.push(`/campaign-invite/${encodeURIComponent(cleaned)}`);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(99,102,241,0.18),transparent_35%),linear-gradient(180deg,transparent,rgba(0,0,0,0.5))]" />
      <section className="relative w-full max-w-lg rounded-[30px] border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-black/40 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-indigo-300">
          Campaign Companion
        </p>
        <h1 className="mt-4 font-serif text-3xl font-black">
          Enter invitation code
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Paste the code sent by your Game Master. The invitation will reveal only the campaign connected to that code.
        </p>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") continueToInvite();
          }}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="NATTAU-AB12-CD34-EF56"
          className="mt-6 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-center font-mono text-sm font-black tracking-[0.08em] outline-none placeholder:text-slate-600 focus:border-indigo-500 sm:text-base"
        />
        <button
          type="button"
          onClick={continueToInvite}
          disabled={!code.trim()}
          className="mt-4 min-h-12 w-full rounded-xl border border-indigo-500/50 bg-indigo-500/15 px-5 text-sm font-black text-indigo-100 disabled:opacity-40"
        >
          Continue to invitation
        </button>
      </section>
    </main>
  );
}
