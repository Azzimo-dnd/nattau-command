"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  WEEKDAY_LABELS,
  getLeadingBlankCount,
  getMonthDateKeys,
  isPastDate,
} from "./plannerDateUtils";
import type {
  AvailabilityEntry,
  AvailabilityMode,
  HeatMode,
  SessionProposal,
} from "./plannerTypes";

type PlannerCalendarProps = {
  month: Date;
  currentUserId: string;
  memberCount: number;
  availability: AvailabilityEntry[];
  proposals: SessionProposal[];
  selectedDate: string | null;
  rangeStart: string | null;
  heatMode: HeatMode;
  selectionMode: "paint" | "range";
  onPaintPointerDown: (
    dateKey: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;
  onPaintPointerEnter: (
    dateKey: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;
  onRangeClick: (dateKey: string) => void;
  onInspect: (dateKey: string) => void;
};

function ownModeClasses(mode: AvailabilityMode | undefined) {
  switch (mode) {
    case "online":
      return "border-blue-400/60 bg-blue-500/15";
    case "in_person":
      return "border-emerald-400/60 bg-emerald-500/15";
    case "both":
      return "border-cyan-300/70 bg-gradient-to-br from-blue-500/15 to-emerald-500/15";
    case "unavailable":
      return "border-red-500/40 bg-red-500/10";
    default:
      return "border-slate-800 bg-slate-950/35";
  }
}

function heatClasses(value: number, total: number) {
  if (total <= 0 || value <= 0) {
    return "";
  }

  const ratio = value / total;
  if (ratio >= 1) {
    return "ring-2 ring-yellow-300/70 shadow-lg shadow-yellow-950/25";
  }
  if (ratio >= 0.75) {
    return "ring-1 ring-yellow-500/50";
  }
  if (ratio >= 0.5) {
    return "ring-1 ring-slate-500/50";
  }
  return "";
}

export function PlannerCalendar({
  month,
  currentUserId,
  memberCount,
  availability,
  proposals,
  selectedDate,
  rangeStart,
  heatMode,
  selectionMode,
  onPaintPointerDown,
  onPaintPointerEnter,
  onRangeClick,
  onInspect,
}: PlannerCalendarProps) {
  const dateKeys = getMonthDateKeys(month);
  const leadingBlanks = getLeadingBlankCount(month);
  const ownByDate = new Map(
    availability
      .filter((entry) => entry.user_id === currentUserId)
      .map((entry) => [entry.availability_date, entry.availability_mode])
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70">
      <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/45">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-3 sm:py-3 sm:text-xs"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <div
            key={`blank-${index}`}
            className="min-h-24 border-b border-r border-slate-800/70 bg-slate-950/20 sm:min-h-32"
          />
        ))}

        {dateKeys.map((dateKey) => {
          const dayEntries = availability.filter(
            (entry) => entry.availability_date === dateKey
          );
          const onlineCount = dayEntries.filter(
            (entry) =>
              entry.availability_mode === "online" ||
              entry.availability_mode === "both"
          ).length;
          const inPersonCount = dayEntries.filter(
            (entry) =>
              entry.availability_mode === "in_person" ||
              entry.availability_mode === "both"
          ).length;
          const heatValue =
            heatMode === "online"
              ? onlineCount
              : heatMode === "in_person"
                ? inPersonCount
                : Math.max(onlineCount, inPersonCount);
          const ownMode = ownByDate.get(dateKey);
          const dayNumber = Number(dateKey.slice(-2));
          const hasProposal = proposals.some(
            (proposal) =>
              proposal.proposed_date === dateKey &&
              (proposal.status === "voting" || proposal.status === "confirmed")
          );
          const isConfirmed = proposals.some(
            (proposal) =>
              proposal.proposed_date === dateKey &&
              proposal.status === "confirmed"
          );
          const isSelected = selectedDate === dateKey;
          const isRangeStart = rangeStart === dateKey;

          return (
            <div
              key={dateKey}
              role="button"
              tabIndex={0}
              onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) =>
                selectionMode === "paint"
                  ? onPaintPointerDown(dateKey, event)
                  : undefined
              }
              onPointerEnter={(event: ReactPointerEvent<HTMLDivElement>) =>
                selectionMode === "paint"
                  ? onPaintPointerEnter(dateKey, event)
                  : undefined
              }
              onClick={() =>
                selectionMode === "range" ? onRangeClick(dateKey) : undefined
              }
              onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (selectionMode === "range") {
                  onRangeClick(dateKey);
                }
              }}
              className={`group relative min-h-24 select-none border-b border-r p-2 text-left transition sm:min-h-32 sm:p-3 ${ownModeClasses(
                ownMode
              )} ${heatClasses(heatValue, memberCount)} ${
                isSelected ? "z-10 outline outline-2 outline-purple-400/70" : ""
              } ${isRangeStart ? "outline outline-2 outline-yellow-300" : ""} ${
                isPastDate(dateKey) ? "opacity-65" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-sm font-black text-slate-200 sm:text-base">
                  {dayNumber}
                </span>
                <button
                  type="button"
                  onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) =>
                    event.stopPropagation()
                  }
                  onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                    event.stopPropagation();
                    onInspect(dateKey);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 text-[11px] text-slate-500 opacity-70 transition hover:border-purple-500/50 hover:text-purple-300 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`Inspect ${dateKey}`}
                >
                  i
                </button>
              </div>

              <div className="mt-3 space-y-1.5 text-[10px] sm:text-xs">
                <div className="flex items-center justify-between rounded-lg border border-blue-500/15 bg-blue-500/5 px-1.5 py-1 text-blue-300">
                  <span>Online</span>
                  <strong>{onlineCount}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-1.5 py-1 text-emerald-300">
                  <span className="truncate">In person</span>
                  <strong>{inPersonCount}</strong>
                </div>
              </div>

              {ownMode && (
                <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-3rem)] truncate rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-300 sm:bottom-2 sm:left-2 sm:text-[9px]">
                  You: {ownMode.replace("_", " ")}
                </span>
              )}

              {hasProposal && (
                <span
                  className={`absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full ${
                    isConfirmed
                      ? "bg-yellow-300 shadow shadow-yellow-500"
                      : "bg-purple-400 shadow shadow-purple-500"
                  }`}
                  title={isConfirmed ? "Confirmed session" : "Open proposal"}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
