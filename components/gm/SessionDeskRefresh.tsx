"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function SessionDeskRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}
    className="min-h-11 rounded-xl border border-[#6d4054] bg-[#28151f] px-4 text-sm font-bold text-[#e0bdcc] transition hover:bg-[#3b1e2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b91] disabled:opacity-50">
    {pending ? "Refreshing…" : "Refresh overview"}
  </button>;
}
