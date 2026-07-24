"use client";

import type {
  AvailabilityBrush,
  HeatMode,
  SelectionMode,
} from "./plannerTypes";

type PlannerToolbarProps = {
  brush: AvailabilityBrush;
  selectionMode: SelectionMode;
  heatMode: HeatMode;
  rangeStart: string | null;
  busy: boolean;
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
    className: "border-slate-600 bg-slate-950/60 text-slate-300",
  },
];

export function PlannerToolbar({
  brush,
  selectionMode,
  heatMode,
  rangeStart,
  busy,
  onBrushChange,
  onSelectionModeChange,
  onHeatModeChange,
  onApplyWeekends,
  onClearMonth,
}: PlannerToolbarProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-yellow-500">
            Availability brush
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {brushes.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={busy}
                onClick={() => onBrushChange(item.value)}
                className={`rounded-xl border px-3 py-2 text-sm font-bold transition disabled:opacity-50 ${item.className} ${
                  brush === item.value
                    ? "ring-2 ring-yellow-300/70 ring-offset-2 ring-offset-slate-950"
                    : "opacity-75 hover:opacity-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Selection
          </p>
          <div className="mt-3 flex rounded-xl border border-slate-700 bg-slate-950/60 p-1">
            {(["paint", "range"] as SelectionMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSelectionModeChange(mode)}
                className={`rounded-lg px-4 py-2 text-sm font-bold capitalize transition ${
                  selectionMode === mode
                    ? "bg-yellow-500/15 text-yellow-200"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectionMode === "range" && (
        <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3 text-sm text-purple-200">
          {rangeStart
            ? "Now choose the final day. Every date between them will receive the selected brush."
            : "Choose the first day of the range, then choose the final day."}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Group heat
          </span>
          {(["best", "online", "in_person"] as HeatMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onHeatModeChange(mode)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                heatMode === mode
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
                  : "border-slate-700 bg-slate-950/50 text-slate-500 hover:text-slate-300"
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
            className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-yellow-500/30 hover:text-yellow-200 disabled:opacity-50"
          >
            Apply to all weekends
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClearMonth}
            className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-bold text-slate-400 transition hover:border-red-500/30 hover:text-red-300 disabled:opacity-50"
          >
            Clear my month
          </button>
        </div>
      </div>
    </section>
  );
}
