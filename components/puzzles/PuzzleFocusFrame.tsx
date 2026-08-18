"use client";

import { useEffect, useState, type ReactNode } from "react";

type Props = {
  title: string;
  status: string;
  movesLabel: string;
  children: ReactNode;
};

export function PuzzleFocusFrame({ title, status, movesLabel, children }: Props) {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocused(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [focused]);

  return (
    <div
      className={
        focused
          ? "fixed inset-0 z-[120] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#070a0e]"
          : "relative"
      }
    >
      {!focused ? (
        <div className="mb-3 flex items-center justify-end md:hidden">
          <button
            type="button"
            onClick={() => setFocused(true)}
            className="min-h-11 rounded-xl border border-slate-700 bg-slate-950/75 px-4 text-sm font-bold text-slate-100 shadow-lg"
          >
            Play full screen
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-[#0b1017]/95 px-3 py-2.5 backdrop-blur md:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-100">{title}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {status} · {movesLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFocused(false)}
            className="min-h-11 shrink-0 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-200"
          >
            Exit
          </button>
        </div>
      )}

      <div
        className={
          focused
            ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:contents"
            : ""
        }
      >
        {children}
      </div>
    </div>
  );
}
