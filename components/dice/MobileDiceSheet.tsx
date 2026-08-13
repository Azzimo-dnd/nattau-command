"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

export function MobileDiceSheet({
  open,
  title,
  onClose,
  children,
  tone = "nattau",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  tone?: "nattau" | "barovia";
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose, open]);

  if (!open) return null;

  const border = tone === "barovia" ? "border-[#713143]" : "border-slate-700";
  const background = tone === "barovia" ? "bg-[#120d11]" : "bg-slate-950";
  const accent = tone === "barovia" ? "text-[#efb5c5]" : "text-yellow-300";

  return (
    <div className="fixed inset-0 z-[90] xl:hidden">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <section
        className={`absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-hidden rounded-t-3xl border-x border-t ${border} ${background} shadow-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-inherit px-4 py-3">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${accent}`}>
              Dice cockpit
            </p>
            <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-xl text-white/80"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="max-h-[calc(88dvh-68px)] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </section>
    </div>
  );
}
