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
import { getPlannerTheme } from "./plannerTheme";
import type {
  AvailabilityEntry,
  AvailabilityMode,
  HeatMode,
  PlannerMember,
  PlannerVariant,
  SelectionMode,
  SessionProposal,
} from "./plannerTypes";

type PlannerCalendarProps = {
  variant: PlannerVariant;
  month: Date;
  currentUserId: string;
  members: PlannerMember[];
  availability: AvailabilityEntry[];
  proposals: SessionProposal[];
  selectedDate: string | null;
  selectedTouchDates: Set<string>;
  rangeStart: string | null;
  heatMode: HeatMode;
  selectionMode: SelectionMode;
  touchMode: boolean;
  onPaintPointerDown: (
    dateKey: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;
  onPaintPointerEnter: (
    dateKey: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;
  onRangeClick: (dateKey: string) => void;
  onToggleTouchDate: (dateKey: string) => void;
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
      return "";
  }
}

function heatClasses(value: number, total: number, variant: PlannerVariant) {
  if (total <= 0 || value <= 0) return "";

  const ratio = value / total;
  if (variant === "barovia") {
    if (ratio >= 1) return "ring-2 ring-[#d2a5b2]/70 shadow-lg shadow-black/30";
    if (ratio >= 0.75) return "ring-1 ring-[#93465c]/70";
    if (ratio >= 0.5) return "ring-1 ring-[#6f5962]/50";
    return "";
  }

  if (ratio >= 1) return "ring-2 ring-yellow-300/70 shadow-lg shadow-yellow-950/25";
  if (ratio >= 0.75) return "ring-1 ring-yellow-500/50";
  if (ratio >= 0.5) return "ring-1 ring-slate-500/50";
  return "";
}

export function PlannerCalendar({
  variant,
  month,
  currentUserId,
  members,
  availability,
  proposals,
  selectedDate,
  selectedTouchDates,
  rangeStart,
  heatMode,
  selectionMode,
  touchMode,
  onPaintPointerDown,
  onPaintPointerEnter,
  onRangeClick,
  onToggleTouchDate,
  onInspect,
}: PlannerCalendarProps) {
  const theme = getPlannerTheme(variant);
  const dateKeys = getMonthDateKeys(month);
  const leadingBlanks = getLeadingBlankCount(month);
  const memberIds = new Set(members.map((member) => member.id));
  const ownByDate = new Map(
    availability
      .filter((entry) => entry.user_id === currentUserId)
      .map((entry) => [entry.availability_date, entry.availability_mode])
  );

  return (
    <div className={`touch-pan-y overflow-hidden rounded-3xl border ${theme.panel}`}>
      <div className={`grid grid-cols-7 border-b bg-black/20 ${theme.border}`}>
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className={`px-0.5 py-2 text-center text-[9px] font-bold uppercase tracking-wide sm:px-3 sm:py-3 sm:text-xs ${theme.subtle}`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <div
            key={`blank-${index}`}
            className={`min-h-[5.4rem] border-b border-r bg-black/10 sm:min-h-32 ${theme.border}`}
          />
        ))}

        {dateKeys.map((dateKey) => {
          const dayEntries = availability.filter(
            (entry) =>
              entry.availability_date === dateKey && memberIds.has(entry.user_id)
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
          const hasVotingProposal = proposals.some(
            (proposal) =>
              proposal.proposed_date === dateKey && proposal.status === "voting"
          );
          const isConfirmed = proposals.some(
            (proposal) =>
              proposal.proposed_date === dateKey && proposal.status === "confirmed"
          );
          const isInspected = selectedDate === dateKey;
          const isTouchSelected = selectedTouchDates.has(dateKey);
          const isRangeStart = rangeStart === dateKey;
          const isPast = isPastDate(dateKey);

          function activateDate() {
            if (isPast) return;
            if (touchMode) {
              onToggleTouchDate(dateKey);
              return;
            }
            if (selectionMode === "range") {
              onRangeClick(dateKey);
            }
          }

          return (
            <div
              key={dateKey}
              role="button"
              tabIndex={isPast ? -1 : 0}
              aria-disabled={isPast}
              aria-pressed={touchMode ? isTouchSelected : undefined}
              title={isPast ? "Past dates cannot be edited." : undefined}
              onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
                if (
                  !isPast &&
                  !touchMode &&
                  selectionMode === "paint" &&
                  event.pointerType === "mouse"
                ) {
                  onPaintPointerDown(dateKey, event);
                }
              }}
              onPointerEnter={(event: ReactPointerEvent<HTMLDivElement>) => {
                if (!isPast && !touchMode && selectionMode === "paint") {
                  onPaintPointerEnter(dateKey, event);
                }
              }}
              onClick={() => activateDate()}
              onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                if (isPast || (event.key !== "Enter" && event.key !== " ")) {
                  return;
                }
                event.preventDefault();
                activateDate();
              }}
              className={`group relative min-h-[5.4rem] select-none border-b border-r p-1.5 text-left transition sm:min-h-32 sm:p-3 ${theme.border} ${
                ownMode ? ownModeClasses(ownMode) : "bg-black/10"
              } ${heatClasses(heatValue, members.length, variant)} ${
                isInspected ? `z-10 outline outline-2 ${theme.selectedOutline}` : ""
              } ${
                isTouchSelected
                  ? `z-20 outline outline-[3px] ${theme.rangeOutline} brightness-125`
                  : ""
              } ${isRangeStart ? `outline outline-2 ${theme.rangeOutline}` : ""} ${
                isPast
                  ? "cursor-not-allowed opacity-40 grayscale-[0.35]"
                  : "cursor-pointer active:scale-[0.98]"
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className={`text-sm font-black sm:text-base ${theme.heading}`}>
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
                  className={`flex h-6 w-6 items-center justify-center rounded-full border bg-black/40 text-[11px] opacity-80 transition sm:opacity-0 sm:group-hover:opacity-100 ${theme.border} ${theme.subtle}`}
                  aria-label={`Inspect ${dateKey}`}
                >
                  i
                </button>
              </div>

              <div className="mt-1.5 space-y-1 text-[8px] sm:mt-3 sm:text-xs">
                <div className="flex items-center justify-between rounded-md border border-blue-500/15 bg-blue-500/5 px-1 py-0.5 text-blue-300 sm:rounded-lg sm:px-1.5 sm:py-1">
                  <span className="hidden sm:inline">Online</span>
                  <span className="sm:hidden">O</span>
                  <strong>{onlineCount}</strong>
                </div>
                <div className="flex items-center justify-between rounded-md border border-emerald-500/15 bg-emerald-500/5 px-1 py-0.5 text-emerald-300 sm:rounded-lg sm:px-1.5 sm:py-1">
                  <span className="hidden sm:inline">In person</span>
                  <span className="sm:hidden">P</span>
                  <strong>{inPersonCount}</strong>
                </div>
              </div>

              {ownMode && (
                <span className="absolute bottom-1 left-1 max-w-[calc(100%-2rem)] truncate rounded-full border border-slate-700 bg-black/70 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-slate-200 sm:bottom-2 sm:left-2 sm:px-2 sm:text-[9px]">
                  {ownMode === "in_person" ? "Person" : ownMode}
                </span>
              )}

              {isPast && !ownMode && (
                <span className={`absolute bottom-1 left-1 rounded-full border bg-black/55 px-1.5 py-0.5 text-[7px] font-bold uppercase sm:bottom-2 sm:left-2 sm:text-[9px] ${theme.border} ${theme.subtle}`}>
                  Past
                </span>
              )}

              {(hasVotingProposal || isConfirmed) && (
                <span
                  className={`absolute bottom-1 right-1 rounded-full border px-1 py-0.5 text-[7px] font-black uppercase tracking-wide sm:bottom-2 sm:right-2 sm:px-2 sm:text-[9px] ${
                    isConfirmed ? theme.confirmAccent : theme.voteAccent
                  }`}
                >
                  {isConfirmed ? "Session" : "Vote"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
