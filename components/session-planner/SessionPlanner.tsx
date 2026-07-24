"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { DayInspector } from "./DayInspector";
import { PlannerCalendar } from "./PlannerCalendar";
import { PlannerToolbar } from "./PlannerToolbar";
import { ProposalBoard } from "./ProposalBoard";
import {
  addMonths,
  dateToKey,
  enumerateDateRange,
  formatMonthTitle,
  getMonthDateKeys,
  isPastDate,
  isWeekend,
  monthStart,
} from "./plannerDateUtils";
import type {
  AvailabilityBrush,
  AvailabilityEntry,
  HeatMode,
  ProposalMode,
  ProposalVoteValue,
  SelectionMode,
  SessionPlannerData,
  SessionPlannerUser,
} from "./plannerTypes";

type SessionPlannerProps = {
  currentUser: SessionPlannerUser;
};

export function SessionPlanner({ currentUser }: SessionPlannerProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const [data, setData] = useState<SessionPlannerData | null>(null);
  const [brush, setBrush] = useState<AvailabilityBrush>("both");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("range");
  const [heatMode, setHeatMode] = useState<HeatMode>("best");
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const draggingRef = useRef(false);
  const dragDatesRef = useRef<Set<string>>(new Set());
  const dragBrushRef = useRef<AvailabilityBrush>(brush);

  const monthKey = dateToKey(visibleMonth);

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      setSelectionMode("paint");
    }
  }, []);

  const loadData = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setLoading(true);
      }

      const supabase = createClient();
      const { data: plannerData, error } = await supabase.rpc(
        "get_session_planner_data",
        { p_month_start: monthKey }
      );

      if (error) {
        setErrorMessage(
          error.message.includes("get_session_planner_data")
            ? "Session Planner database functions are missing. Run supabase/session-planner.sql first."
            : error.message
        );
      } else {
        setData(plannerData as SessionPlannerData);
        setErrorMessage(null);
      }

      setLoading(false);
    },
    [monthKey]
  );

  useEffect(() => {
    setRangeStart(null);
    setSelectedDate(null);
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busy) {
        void loadData(true);
      }
    }, 20000);

    return () => window.clearInterval(interval);
  }, [busy, loadData]);

  const applyLocalAvailability = useCallback(
    (dateKeys: string[], mode: AvailabilityBrush) => {
      const editableDates =
        mode === "erase"
          ? dateKeys
          : dateKeys.filter((dateKey) => !isPastDate(dateKey));

      if (editableDates.length === 0) return;

      setData((current) => {
        if (!current) return current;

        const selected = new Set(editableDates);
        const remaining = current.availability.filter(
          (entry) =>
            entry.user_id !== currentUser.id ||
            !selected.has(entry.availability_date)
        );

        if (mode === "erase") {
          return { ...current, availability: remaining };
        }

        const now = new Date().toISOString();
        const additions: AvailabilityEntry[] = editableDates.map((dateKey) => ({
          user_id: currentUser.id,
          availability_date: dateKey,
          availability_mode: mode,
          updated_at: now,
        }));

        return {
          ...current,
          availability: [...remaining, ...additions],
        };
      });
    },
    [currentUser.id]
  );

  const persistAvailability = useCallback(
    async (dateKeys: string[], mode: AvailabilityBrush) => {
      const uniqueDates = [...new Set(dateKeys)].filter(
        (dateKey) => mode === "erase" || !isPastDate(dateKey)
      );

      if (uniqueDates.length === 0) {
        setErrorMessage("Past dates cannot be changed.");
        setSuccessMessage(null);
        return;
      }

      setBusy(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const supabase = createClient();
      const { error } = await supabase.rpc("set_session_availability", {
        p_dates: uniqueDates,
        p_mode: mode,
      });

      if (error) {
        setErrorMessage(error.message);
        await loadData(true);
      } else {
        setSuccessMessage(
          mode === "erase"
            ? `Cleared ${uniqueDates.length} day${uniqueDates.length === 1 ? "" : "s"}.`
            : `Availability saved for ${uniqueDates.length} day${uniqueDates.length === 1 ? "" : "s"}.`
        );
      }

      setBusy(false);
    },
    [loadData]
  );

  useEffect(() => {
    function finishPainting() {
      if (!draggingRef.current) return;

      draggingRef.current = false;
      const dates = [...dragDatesRef.current];
      dragDatesRef.current.clear();
      void persistAvailability(dates, dragBrushRef.current);
    }

    window.addEventListener("pointerup", finishPainting);
    window.addEventListener("pointercancel", finishPainting);

    return () => {
      window.removeEventListener("pointerup", finishPainting);
      window.removeEventListener("pointercancel", finishPainting);
    };
  }, [persistAvailability]);

  function addPaintDate(dateKey: string) {
    if (isPastDate(dateKey) || dragDatesRef.current.has(dateKey)) return;

    dragDatesRef.current.add(dateKey);
    applyLocalAvailability([dateKey], dragBrushRef.current);
    setSelectedDate(dateKey);
  }

  function handlePaintPointerDown(
    dateKey: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (busy || isPastDate(dateKey)) return;

    event.preventDefault();
    dragBrushRef.current = brush;

    if (event.pointerType !== "mouse") {
      applyLocalAvailability([dateKey], brush);
      setSelectedDate(dateKey);
      void persistAvailability([dateKey], brush);
      return;
    }

    draggingRef.current = true;
    dragDatesRef.current.clear();
    addPaintDate(dateKey);
  }

  function handlePaintPointerEnter(
    dateKey: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (!draggingRef.current || event.buttons !== 1) return;
    addPaintDate(dateKey);
  }

  function handleRangeClick(dateKey: string) {
    if (isPastDate(dateKey)) {
      setErrorMessage("Past dates cannot be selected.");
      setSuccessMessage(null);
      return;
    }

    setSelectedDate(dateKey);

    if (!rangeStart) {
      setRangeStart(dateKey);
      return;
    }

    const dates = enumerateDateRange(rangeStart, dateKey);
    applyLocalAvailability(dates, brush);
    setRangeStart(null);
    void persistAvailability(dates, brush);
  }

  function changeSelectionMode(mode: SelectionMode) {
    setSelectionMode(mode);
    setRangeStart(null);
  }

  function applyToWeekends() {
    const dates = getMonthDateKeys(visibleMonth).filter(
      (dateKey) => isWeekend(dateKey) && !isPastDate(dateKey)
    );
    applyLocalAvailability(dates, brush);
    void persistAvailability(dates, brush);
  }

  function clearMonth() {
    const ownDates = (data?.availability ?? [])
      .filter((entry) => entry.user_id === currentUser.id)
      .map((entry) => entry.availability_date);

    if (ownDates.length === 0) {
      setSuccessMessage("You have no availability to clear in this month.");
      return;
    }

    if (!window.confirm("Clear all of your availability in this month?")) {
      return;
    }

    applyLocalAvailability(ownDates, "erase");
    void persistAvailability(ownDates, "erase");
  }

  async function createProposal(
    dateKey: string,
    mode: ProposalMode,
    message: string
  ) {
    if (isPastDate(dateKey)) {
      setErrorMessage("Past dates cannot be proposed for a session.");
      setSuccessMessage(null);
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("create_session_proposal", {
      p_date: dateKey,
      p_mode: mode,
      p_message: message || null,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage("The date is now open for voting.");
      await loadData(true);
    }

    setBusy(false);
  }

  async function vote(proposalId: string, value: ProposalVoteValue) {
    setBusyProposalId(proposalId);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("cast_session_proposal_vote", {
      p_proposal_id: proposalId,
      p_vote: value,
    });

    if (error) setErrorMessage(error.message);
    else await loadData(true);

    setBusyProposalId(null);
  }

  async function removeVote(proposalId: string) {
    setBusyProposalId(proposalId);
    const supabase = createClient();
    const { error } = await supabase.rpc("remove_session_proposal_vote", {
      p_proposal_id: proposalId,
    });

    if (error) setErrorMessage(error.message);
    else await loadData(true);

    setBusyProposalId(null);
  }

  async function cancelProposal(proposalId: string) {
    if (!window.confirm("Cancel this proposed date?")) return;

    setBusyProposalId(proposalId);
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_session_proposal", {
      p_proposal_id: proposalId,
    });

    if (error) setErrorMessage(error.message);
    else await loadData(true);

    setBusyProposalId(null);
  }

  async function confirmProposal(proposalId: string) {
    if (
      !window.confirm(
        "Confirm this date as the next session? The planner will publish it at the campaign default time of 19:00 Europe/Warsaw."
      )
    ) {
      return;
    }

    setBusyProposalId(proposalId);
    const supabase = createClient();
    const { error } = await supabase.rpc("confirm_session_proposal", {
      p_proposal_id: proposalId,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage("The next session has been confirmed and published.");
      await loadData(true);
    }

    setBusyProposalId(null);
  }

  const currentMonthDistance = useMemo(() => {
    const today = monthStart(new Date());
    return (
      (visibleMonth.getFullYear() - today.getFullYear()) * 12 +
      visibleMonth.getMonth() -
      today.getMonth()
    );
  }, [visibleMonth]);

  return (
    <div className="space-y-6">
      <ProposalBoard
        proposals={data?.proposals ?? []}
        currentUser={currentUser}
        busyProposalId={busyProposalId}
        onVote={vote}
        onRemoveVote={removeVote}
        onConfirm={confirmProposal}
        onCancel={cancelProposal}
      />

      <PlannerToolbar
        brush={brush}
        selectionMode={selectionMode}
        heatMode={heatMode}
        rangeStart={rangeStart}
        busy={busy}
        onBrushChange={setBrush}
        onSelectionModeChange={changeSelectionMode}
        onHeatModeChange={setHeatMode}
        onApplyWeekends={applyToWeekends}
        onClearMonth={clearMonth}
      />

      {(errorMessage || successMessage) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            errorMessage
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-green-500/30 bg-green-500/10 text-green-200"
          }`}
        >
          {errorMessage ?? successMessage}
        </div>
      )}

      <section className="rounded-3xl border border-slate-800 bg-slate-900/45 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-yellow-500">
              Shared calendar
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-100">
              {formatMonthTitle(visibleMonth)}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentMonthDistance <= -1}
              onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 text-xl text-slate-300 transition hover:border-yellow-500/40 hover:text-yellow-200 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setVisibleMonth(monthStart(new Date()))}
              className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-yellow-500/40 hover:text-yellow-200"
            >
              Today
            </button>
            <button
              type="button"
              disabled={currentMonthDistance >= 12}
              onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 text-xl text-slate-300 transition hover:border-yellow-500/40 hover:text-yellow-200 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Next month"
            >
              ›
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadData()}
              className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-bold text-slate-400 transition hover:text-slate-200 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className={loading && !data ? "animate-pulse opacity-60" : ""}>
            <PlannerCalendar
              month={visibleMonth}
              currentUserId={currentUser.id}
              memberCount={data?.members.length ?? 0}
              availability={data?.availability ?? []}
              proposals={data?.proposals ?? []}
              selectedDate={selectedDate}
              rangeStart={rangeStart}
              heatMode={heatMode}
              selectionMode={selectionMode}
              onPaintPointerDown={handlePaintPointerDown}
              onPaintPointerEnter={handlePaintPointerEnter}
              onRangeClick={handleRangeClick}
              onInspect={setSelectedDate}
            />
          </div>

          <DayInspector
            dateKey={selectedDate}
            members={data?.members ?? []}
            availability={data?.availability ?? []}
            proposals={data?.proposals ?? []}
            currentUser={currentUser}
            busy={busy}
            onCreateProposal={createProposal}
          />
        </div>
      </section>

      <section className="grid gap-3 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-5">
        <Legend label="Online" className="border-blue-500/30 bg-blue-500/10" />
        <Legend
          label="In person"
          className="border-emerald-500/30 bg-emerald-500/10"
        />
        <Legend
          label="Both"
          className="border-cyan-500/30 bg-gradient-to-r from-blue-500/10 to-emerald-500/10"
        />
        <Legend
          label="Unavailable"
          className="border-red-500/30 bg-red-500/10"
        />
        <Legend
          label="No response"
          className="border-slate-700 bg-slate-950/40"
        />
      </section>
    </div>
  );
}

function Legend({ label, className }: { label: string; className: string }) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${className}`}>
      {label}
    </div>
  );
}
