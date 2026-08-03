"use client";

import { getPlannerTheme } from "./plannerTheme";
import type {
  AvailabilityBrush,
  PlannerVariant,
} from "./plannerTypes";

type MobileSelectionDockProps = {
  variant: PlannerVariant;
  selectedCount: number;
  busy: boolean;
  onApply: (mode: AvailabilityBrush) => void;
  onCancel: () => void;
};

const actions: Array<{
  mode: AvailabilityBrush;
  label: string;
  className: string;
}> = [
  {
    mode: "online",
    label: "Online",
    className: "border-blue-500/40 bg-blue-500/15 text-blue-100",
  },
  {
    mode: "in_person",
    label: "In person",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  },
  {
    mode: "both",
    label: "Both",
    className:
      "border-cyan-400/40 bg-gradient-to-r from-blue-500/15 to-emerald-500/15 text-cyan-50",
  },
  {
    mode: "unavailable",
    label: "Can't",
    className: "border-red-500/40 bg-red-500/15 text-red-100",
  },
  {
    mode: "erase",
    label: "Clear",
    className: "border-slate-600 bg-black/25 text-slate-200",
  },
];

export function MobileSelectionDock({
  variant,
  selectedCount,
  busy,
  onApply,
  onCancel,
}: MobileSelectionDockProps) {
  const theme = getPlannerTheme(variant);

  if (selectedCount === 0) return null;

  return (
    <section
      className={`fixed inset-x-2 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[65] rounded-2xl border p-3 shadow-2xl backdrop-blur-xl lg:hidden ${theme.dock}`}
      aria-label="Apply availability to selected dates"
    >
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.24em] ${theme.accentText}`}>
              {selectedCount} {selectedCount === 1 ? "night" : "nights"} selected
            </p>
            <p className={`mt-1 text-xs ${theme.subtle}`}>
              Apply one status to every selected date.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${theme.panelMuted} ${theme.body}`}
          >
            Cancel
          </button>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {actions.map((action) => (
            <button
              key={action.mode}
              type="button"
              disabled={busy}
              onClick={() => onApply(action.mode)}
              className={`min-h-12 rounded-xl border px-1 text-[11px] font-bold leading-tight transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-50 ${action.className}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
