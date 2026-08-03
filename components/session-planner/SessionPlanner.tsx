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
import { BestDates } from "./BestDates";
import { DayInspector } from "./DayInspector";
import { MobileSelectionDock } from "./MobileSelectionDock";
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
import { getPlannerTheme } from "./plannerTheme";
import type {
  AvailabilityBrush,
  AvailabilityEntry,
  HeatMode,
  PlannerVariant,
  ProposalMode,
  ProposalVoteValue,
  SelectionMode,
  SessionPlannerData,
  SessionPlannerUser,
} from "./plannerTypes";

type SessionPlannerProps = {
  campaignSlug: string;
  variant: PlannerVariant;
  currentUser: SessionPlannerUser;
};

export function SessionPlanner({
  campaignSlug,
  variant,
  currentUser,
}: SessionPlannerProps) {
  const theme = getPlannerTheme(variant);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const [data, setData] = useState<SessionPlannerData | null>(null);
  const [brush, setBrush] = useState<AvailabilityBrush>("both");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("range");
  const [heatMode, setHeatMode] = useState<HeatMode>("best");
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTouchDates, setSelectedTouchDates] = useState<Set<string>>(
    () => new Set()
  );
  const [touchMode, setTouchMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const draggingRef = useRef(false);
  const dragDatesRef = useRef<Set<string>>(new Set());
  const dragBrushRef = useRef<AvailabilityBrush>(brush);
  const monthKey = dateToKey(visibleMonth);

  const playerMembers = useMemo(
    () =>
      (data?.members ?? []).filter(
        (member) =>
          member.role === "player" && member.planning_enabled !== false
      ),
    [data?.members]
  );

  const currentUserCountsTowardPlanning =
    currentUser.role === "dm" || data?.current_user_planning_enabled !== false;

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse), (max-width: 767px)");

    function updateInputMode() {
      const mobile = media.matches;
      setTouchMode(mobile);
      setSelectionMode(mobile ? "range" : "paint");
      if (!mobile) setSelectedTouchDates(new Set());
    }

    updateInputMode();
    media.addEventListener?.("change", updateInputMode);
    return () => media.removeEventListener?.("change", updateInputMode);
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const loadData = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);

      const supabase = createClient();
      const { data: plannerData, error } = await supabase.rpc(
        "get_session_planner_data",
        {
          p_campaign_slug: campaignSlug,
          p_month_start: monthKey,
        }
      );

      if (error) {
        setErrorMessage(
          error.message.includes("get_session_planner_data")
            ? "Multi-campaign planner functions are missing. Run supabase/multi-campaign-session-planner.sql."
            : error.message
        );
      } else {
        setData(plannerData as SessionPlannerData);
        setErrorMessage(null);
      }

      setLoading(false);
    },
    [campaignSlug, monthKey]
  );

  useEffect(() => {
    setRangeStart(null);
    setSelectedDate(null);
    setSelectedTouchDates(new Set());
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

        return { ...current, availability: [...remaining, ...additions] };
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
        return false;
      }

      setBusy(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const supabase = createClient();
      const { error } = await supabase.rpc("set_session_availability", {
        p_campaign_slug: campaignSlug,
        p_dates: uniqueDates,
        p_mode: mode,
      });

      if (error) {
        setErrorMessage(error.message);
        await loadData(true);
        setBusy(false);
        return false;
      }

      setSuccessMessage(
        mode === "erase"
          ? `Cleared ${uniqueDates.length} date${uniqueDates.length === 1 ? "" : "s"}.`
          : `Availability saved for ${uniqueDates.length} date${uniqueDates.length === 1 ? "" : "s"}.`
      );
      setBusy(false);
      return true;
    },
    [campaignSlug, loadData]
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
  }

  function handlePaintPointerDown(
    dateKey: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (busy || touchMode || event.pointerType !== "mouse" || isPastDate(dateKey)) {
      return;
    }

    event.preventDefault();
    dragBrushRef.current = brush;
    draggingRef.current = true;
    dragDatesRef.current.clear();
    addPaintDate(dateKey);
  }

  function handlePaintPointerEnter(
    dateKey: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (touchMode || !draggingRef.current || event.buttons !== 1) return;
    addPaintDate(dateKey);
  }

  function handleRangeClick(dateKey: string) {
    if (isPastDate(dateKey)) return;

    if (!rangeStart) {
      setRangeStart(dateKey);
      return;
    }

    const dates = enumerateDateRange(rangeStart, dateKey).filter(
      (key) => !isPastDate(key)
    );
    applyLocalAvailability(dates, brush);
    setRangeStart(null);
    void persistAvailability(dates, brush);
  }

  function toggleTouchDate(dateKey: string) {
    if (!touchMode || busy || isPastDate(dateKey)) return;

    setSelectedTouchDates((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  async function applyTouchSelection(mode: AvailabilityBrush) {
    const dates = [...selectedTouchDates];
    if (dates.length === 0) return;

    applyLocalAvailability(dates, mode);
    const saved = await persistAvailability(dates, mode);
    if (saved) setSelectedTouchDates(new Set());
  }

  function changeSelectionMode(mode: SelectionMode) {
    setSelectionMode(mode);
    setRangeStart(null);
  }

  function applyToWeekends() {
    const dates = getMonthDateKeys(visibleMonth).filter(
      (dateKey) => isWeekend(dateKey) && !isPastDate(dateKey)
    );

    if (touchMode) {
      setSelectedTouchDates(new Set(dates));
      return;
    }

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

    if (!window.confirm("Clear all of your availability in this month?")) return;

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
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_session_proposal", {
      p_campaign_slug: campaignSlug,
      p_date: dateKey,
      p_mode: mode,
      p_message: message || null,
    });

    if (error) setErrorMessage(error.message);
    else {
      setSuccessMessage(
        variant === "barovia"
          ? "The night is now open for voting."
          : "The date is now open for voting."
      );
      await loadData(true);
    }
    setBusy(false);
  }

  async function vote(proposalId: string, value: ProposalVoteValue) {
    setBusyProposalId(proposalId);
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("cast_session_proposal_vote", {
      p_campaign_slug: campaignSlug,
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
      p_campaign_slug: campaignSlug,
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
      p_campaign_slug: campaignSlug,
      p_proposal_id: proposalId,
    });
    if (error) setErrorMessage(error.message);
    else await loadData(true);
    setBusyProposalId(null);
  }

  async function confirmProposal(proposalId: string) {
    const accepted = window.confirm(
      variant === "barovia"
        ? "Confirm this as the chosen night for the Barovia campaign? Other open Barovia proposals will be closed."
        : "Confirm this as the chosen date? Other open Nattau proposals will be closed."
    );
    if (!accepted) return;

    setBusyProposalId(proposalId);
    const supabase = createClient();
    const { error } = await supabase.rpc("confirm_session_proposal", {
      p_campaign_slug: campaignSlug,
      p_proposal_id: proposalId,
    });
    if (error) setErrorMessage(error.message);
    else {
      setSuccessMessage("The campaign date has been confirmed.");
      await loadData(true);
    }
    setBusyProposalId(null);
  }

  function inspectBestDate(dateKey: string) {
    setSelectedDate(dateKey);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`${campaignSlug}-planner-calendar`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    <div className="space-y-6 pb-12 lg:pb-0">
      {currentUser.role === "player" && !currentUserCountsTowardPlanning && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm leading-6 text-cyan-100">
          This is a test profile. You may use every planner feature, but your
          availability and votes do not affect player totals or rankings.
        </div>
      )}

      <ProposalBoard
        variant={variant}
        proposals={data?.proposals ?? []}
        currentUser={currentUser}
        eligibleVoterIds={playerMembers.map((member) => member.id)}
        currentUserCountsTowardPlanning={currentUserCountsTowardPlanning}
        busyProposalId={busyProposalId}
        onVote={vote}
        onRemoveVote={removeVote}
        onConfirm={confirmProposal}
        onCancel={cancelProposal}
      />

      <BestDates
        variant={variant}
        month={visibleMonth}
        members={playerMembers}
        availability={data?.availability ?? []}
        proposals={data?.proposals ?? []}
        currentUser={currentUser}
        busy={busy}
        onInspect={inspectBestDate}
        onCreateProposal={createProposal}
      />

      <PlannerToolbar
        variant={variant}
        brush={brush}
        selectionMode={selectionMode}
        heatMode={heatMode}
        rangeStart={rangeStart}
        busy={busy}
        touchMode={touchMode}
        selectedTouchCount={selectedTouchDates.size}
        onBrushChange={setBrush}
        onSelectionModeChange={changeSelectionMode}
        onHeatModeChange={setHeatMode}
        onApplyWeekends={applyToWeekends}
        onClearMonth={clearMonth}
      />

      <section
        id={`${campaignSlug}-planner-calendar`}
        className={`scroll-mt-20 rounded-3xl border p-2 sm:p-5 ${theme.panel}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-2 pt-2 sm:px-0 sm:pt-0">
          <div>
            <p className={`text-xs uppercase tracking-[0.32em] ${theme.accentText}`}>
              {theme.calendarEyebrow}
            </p>
            <h2 className={`mt-2 text-2xl font-black sm:text-3xl ${theme.heading}`}>
              {formatMonthTitle(visibleMonth)}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={currentMonthDistance <= -1}
              onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-black/25 text-xl disabled:opacity-30 ${theme.border} ${theme.body}`}
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setVisibleMonth(monthStart(new Date()))}
              className={`min-h-10 rounded-xl border bg-black/25 px-3 text-xs font-bold sm:px-4 sm:text-sm ${theme.border} ${theme.body}`}
            >
              Today
            </button>
            <button
              type="button"
              disabled={currentMonthDistance >= 12}
              onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-black/25 text-xl disabled:opacity-30 ${theme.border} ${theme.body}`}
              aria-label="Next month"
            >
              ›
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadData()}
              className={`hidden min-h-10 rounded-xl border bg-black/25 px-3 text-xs font-bold disabled:opacity-50 sm:block ${theme.border} ${theme.subtle}`}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className={loading && !data ? "animate-pulse opacity-60" : ""}>
            <PlannerCalendar
              variant={variant}
              month={visibleMonth}
              currentUserId={currentUser.id}
              members={playerMembers}
              availability={data?.availability ?? []}
              proposals={data?.proposals ?? []}
              selectedDate={selectedDate}
              selectedTouchDates={selectedTouchDates}
              rangeStart={rangeStart}
              heatMode={heatMode}
              selectionMode={selectionMode}
              touchMode={touchMode}
              onPaintPointerDown={handlePaintPointerDown}
              onPaintPointerEnter={handlePaintPointerEnter}
              onRangeClick={handleRangeClick}
              onToggleTouchDate={toggleTouchDate}
              onInspect={setSelectedDate}
            />
          </div>

          <DayInspector
            variant={variant}
            dateKey={selectedDate}
            members={playerMembers}
            availability={data?.availability ?? []}
            proposals={data?.proposals ?? []}
            currentUser={currentUser}
            busy={busy}
            onCreateProposal={createProposal}
          />
        </div>
      </section>

      <section className={`grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-5 ${theme.subtle}`}>
        <Legend label="Online" className="border-blue-500/30 bg-blue-500/10" />
        <Legend label="In person" className="border-emerald-500/30 bg-emerald-500/10" />
        <Legend label="Both" className="border-cyan-500/30 bg-gradient-to-r from-blue-500/10 to-emerald-500/10" />
        <Legend label="Unavailable" className="border-red-500/30 bg-red-500/10" />
        <Legend label="No response" className={theme.panelMuted} />
      </section>

      {(errorMessage || successMessage) && (
        <div
          role="status"
          className={`fixed right-3 top-20 z-[90] max-w-[calc(100vw-1.5rem)] rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-lg sm:right-6 sm:max-w-md ${
            errorMessage
              ? "border-red-500/40 bg-red-950/95 text-red-100"
              : "border-green-500/35 bg-green-950/95 text-green-100"
          }`}
        >
          {errorMessage ?? successMessage}
        </div>
      )}

      <MobileSelectionDock
        variant={variant}
        selectedCount={selectedTouchDates.size}
        busy={busy}
        onApply={(mode) => void applyTouchSelection(mode)}
        onCancel={() => setSelectedTouchDates(new Set())}
      />
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
