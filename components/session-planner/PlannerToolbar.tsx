"use client";

import { getPlannerTheme } from "./plannerTheme";
import type {
  AvailabilityBrush,
  HeatMode,
  PlannerVariant,
  SelectionMode,
} from "./plannerTypes";

type PlannerToolbarProps = {
  variant: PlannerVariant;
  brush: AvailabilityBrush;
  selectionMode: SelectionMode;
  heatMode: HeatMode;
  rangeStart: string | null;
  busy: boolean;
  touchMode: boolean;
  selectedTouchCount: number;
  onBrushChange: (brush: AvailabilityBrush) => void;
  onSelectionModeChange: (mode: SelectionMode) => void;
  onHeatModeChange: (mode: HeatMode) => void;
  onApplyWeekends: () => void;
  onClearMonth: () => void;
};

const brushes: Array<{
  value: AvailabilityBrush;
  label: string;
  className: string;
}> = [
  {
    value: "online",
    label: "Online",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  },
  {
    value: "in_person",
    label: "In person",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  {
    value: "both",
    label: "Both",
    className:
      "border-cyan-500/30 bg-gradient-to-r from-blue-500/10 to-emerald-500/10 text-cyan-100",
  },
  {
    value: "unavailable",
    label: "Unavailable",
    className: "border-red-500/30 bg-red-500/10 text-red-200",
  },
  {
    value: "erase",
    label: "Erase",
    className: "border-slate-600 bg-black/25 text-slate-300",
  },
];

export function PlannerToolbar({
  variant,
  brush,
  selectionMode,
  heatMode,
  rangeStart,
  busy,
  touchMode,
  selectedTouchCount,
  onBrushChange,
  onSelectionModeChange,
  onHeatModeChange,
  onApplyWeekends,
  onClearMonth,
}: PlannerToolbarProps) {
  const theme = getPlannerTheme(variant);

  return (
    <section className={`rounded-3xl border p-5 ${theme.panel}`}>
      <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
        <div>
          <p className={`text-xs uppercase tracking-[0.3em] ${theme.accentText}`}>
            {touchMode ? "Mobile selection" : "Availability brush"}
          </p>

          {touchMode ? (
            <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${theme.panelMuted} ${theme.body}`}>
              Tap any future dates to select them. Then use the fixed action bar
              above the mobile navigation to apply a status to every selected
              date at once. Dragging is disabled, so the page can scroll normally.
              {selectedTouchCount > 0 && (
                <strong className={`ml-1 ${theme.heading}`}>
                  {selectedTouchCount} selected.
                </strong>
              )}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {brushes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  disabled={busy}
                  onClick={() => onBrushChange(item.value)}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold transition disabled:opacity-50 ${item.className} ${
                    brush === item.value
                      ? `ring-2 ${theme.accentRing} ring-offset-2 ring-offset-slate-950`
                      : "opacity-75 hover:opacity-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!touchMode && (
          <div>
            <p className={`text-xs uppercase tracking-[0.3em] ${theme.subtle}`}>
              Selection
            </p>
            <div className={`mt-3 flex rounded-xl border p-1 ${theme.panelMuted}`}>
              {(["paint", "range"] as SelectionMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSelectionModeChange(mode)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold capitalize transition ${
                    selectionMode === mode
                      ? `${theme.accentSoft} ${theme.accentText}`
                      : `${theme.subtle} hover:opacity-100`
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!touchMode && selectionMode === "range" && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${theme.voteAccent}`}>
          {rangeStart
            ? "Now choose the final day. Every date between them will receive the selected brush."
            : "Choose the first day of the range, then choose the final day."}
        </div>
      )}

      <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 ${theme.border}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
            Group heat
          </span>
          {(["best", "online", "in_person"] as HeatMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onHeatModeChange(mode)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                heatMode === mode
                  ? `${theme.accentBorder} ${theme.accentSoft} ${theme.accentText}`
                  : `${theme.panelMuted} ${theme.subtle}`
              }`}
            >
              {mode === "in_person" ? "In person" : mode}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onApplyWeekends}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${theme.panelMuted} ${theme.body}`}
          >
            Apply to future weekends
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClearMonth}
            className={`rounded-xl border px-3 py-2 text-xs font-bold text-red-300 transition disabled:opacity-50 ${theme.panelMuted}`}
          >
            Clear my month
          </button>
        </div>
      </div>
    </section>
  );
}
