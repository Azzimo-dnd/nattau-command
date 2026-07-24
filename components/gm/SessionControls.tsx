"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_SESSION_MESSAGE,
  type CampaignSessionSettings,
  type CampaignSessionStatus,
} from "@/lib/campaign/sessionTypes";

type SessionControlsProps = {
  initialSettings: CampaignSessionSettings;
};

function toLocalInputValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatPublishedDate(value: string | null) {
  if (!value) return "No date published";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No date published";

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function SessionControls({ initialSettings }: SessionControlsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<CampaignSessionStatus>(
    initialSettings.status
  );
  const [dateTime, setDateTime] = useState(
    toLocalInputValue(initialSettings.nextSessionAt)
  );
  const [message, setMessage] = useState(initialSettings.message);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const previewDate = useMemo(() => {
    if (status !== "scheduled" || !dateTime) return null;

    const date = new Date(dateTime);
    if (!Number.isFinite(date.getTime())) return null;
    return date.toISOString();
  }, [dateTime, status]);

  function changeStatus(nextStatus: CampaignSessionStatus) {
    setStatus(nextStatus);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (nextStatus === "tba" && !message.trim()) {
      setMessage(DEFAULT_SESSION_MESSAGE);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (status === "scheduled" && !previewDate) {
      setErrorMessage("Choose a valid date and time for the next session.");
      return;
    }

    setIsSaving(true);

    const supabase = createClient();
    const { error } = await supabase.rpc("set_campaign_session", {
      p_status: status,
      p_next_session_at: status === "scheduled" ? previewDate : null,
      p_message:
        status === "tba"
          ? message.trim() || DEFAULT_SESSION_MESSAGE
          : message.trim() || null,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    setSuccessMessage(
      status === "scheduled"
        ? "The next session date is now visible to every player."
        : "Players will now see that the next session has not yet been announced."
    );
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <form
        onSubmit={saveSettings}
        className="rounded-3xl border border-yellow-500/15 bg-slate-900/70 p-5 sm:p-7"
      >
        <p className="text-xs uppercase tracking-[0.34em] text-yellow-500">
          Session Announcement
        </p>
        <h2 className="mt-3 text-3xl font-black text-slate-100">
          What should the expedition see?
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Publish a precise date and time or temporarily replace the countdown
          with a message that the next gathering has not yet been announced.
        </p>

        {!initialSettings.databaseReady && (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
            The session settings table is not available yet. Run
            <strong> supabase/session-scheduling.sql</strong> before saving.
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1.5">
          <button
            type="button"
            onClick={() => changeStatus("scheduled")}
            className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
              status === "scheduled"
                ? "bg-yellow-500 text-slate-950"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            Session scheduled
          </button>
          <button
            type="button"
            onClick={() => changeStatus("tba")}
            className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
              status === "tba"
                ? "bg-yellow-500 text-slate-950"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            Not announced
          </button>
        </div>

        {status === "scheduled" && (
          <div className="mt-6">
            <label
              htmlFor="session-date"
              className="text-sm font-semibold text-slate-200"
            >
              Date and time
            </label>
            <input
              id="session-date"
              type="datetime-local"
              required
              value={dateTime}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setDateTime(event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition [color-scheme:dark] focus:border-yellow-500"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              The browser uses your local time zone and Supabase stores the
              exact moment safely.
            </p>
          </div>
        )}

        <div className="mt-6">
          <label
            htmlFor="session-message"
            className="text-sm font-semibold text-slate-200"
          >
            {status === "scheduled"
              ? "Additional note (optional)"
              : "Message for players"}
          </label>
          <textarea
            id="session-message"
            value={message}
            maxLength={280}
            rows={4}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setMessage(event.target.value)
            }
            placeholder={
              status === "scheduled"
                ? "For example: We meet on Discord ten minutes earlier."
                : DEFAULT_SESSION_MESSAGE
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500"
          />
          <div className="mt-2 flex justify-between gap-4 text-xs text-slate-500">
            <span>
              {status === "tba"
                ? "This replaces the countdown on the Command Center."
                : "The note appears beneath the published date."}
            </span>
            <span>{message.length} / 280</span>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving || !initialSettings.databaseReady}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-yellow-500 px-5 py-3 font-black text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isSaving
            ? "Publishing..."
            : status === "scheduled"
              ? "Publish Session Date"
              : "Publish Waiting Message"}
        </button>
      </form>

      <aside className="space-y-6">
        <section className="rounded-3xl border border-purple-500/20 bg-purple-500/5 p-5 sm:p-7">
          <p className="text-xs uppercase tracking-[0.32em] text-purple-300">
            Live Preview
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-100">
            Command Center Card
          </h2>

          <div className="mt-5 rounded-2xl border border-slate-700/80 bg-slate-950/60 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Next Session
            </p>

            {status === "scheduled" && previewDate ? (
              <>
                <p className="mt-3 text-xl font-black text-yellow-300">
                  {formatPublishedDate(previewDate)}
                </p>
                {message.trim() && (
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {message.trim()}
                  </p>
                )}
                <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                  {["-- days", "-- hours", "-- min", "-- sec"].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl bg-slate-900 px-2 py-3 text-xs text-slate-500"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-yellow-300">
                  ?
                </span>
                <div>
                  <p className="font-bold text-slate-100">Not announced yet</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {message.trim() || DEFAULT_SESSION_MESSAGE}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">
            Current Publication
          </p>
          <p className="mt-3 text-lg font-bold text-slate-100">
            {initialSettings.status === "scheduled"
              ? formatPublishedDate(initialSettings.nextSessionAt)
              : "No session date announced"}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {initialSettings.message}
          </p>
          <p className="mt-4 text-xs text-slate-600">
            {initialSettings.updatedAt
              ? `Last updated ${formatPublishedDate(initialSettings.updatedAt)}`
              : "No database update recorded yet."}
          </p>
        </section>
      </aside>
    </div>
  );
}
