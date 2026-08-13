"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AzzimosPricePanel } from "@/components/session/AzzimosPricePanel";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_SESSION_MESSAGE,
  type CampaignSessionSettings,
  type CampaignSessionStatus,
} from "@/lib/campaign/sessionTypes";

type SessionControlsProps = {
  initialSettings: CampaignSessionSettings;
  campaignSlug: string;
};

const MAX_DEBUFFS = 12;
const MAX_DEBUFF_LENGTH = 280;

function toLocalInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatPublishedDate(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeDebuffs(debuffs: string[]) {
  return debuffs.map((debuff) => debuff.trim()).filter(Boolean);
}

export function SessionControls({
  initialSettings,
  campaignSlug,
}: SessionControlsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<CampaignSessionStatus>(
    initialSettings.status,
  );
  const [dateTime, setDateTime] = useState(
    toLocalInputValue(initialSettings.nextSessionAt),
  );
  const [message, setMessage] = useState(initialSettings.message);
  const [debuffs, setDebuffs] = useState<string[]>(initialSettings.debuffs);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const previewDate = useMemo(() => {
    if (status !== "scheduled" || !dateTime) {
      return null;
    }

    const parsed = new Date(dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }, [dateTime, status]);

  const previewDebuffs = useMemo(() => normalizeDebuffs(debuffs), [debuffs]);

  function updateDebuff(index: number, value: string) {
    setDebuffs((current) =>
      current.map((debuff, currentIndex) =>
        currentIndex === index ? value : debuff,
      ),
    );
  }

  function removeDebuff(index: number) {
    setDebuffs((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function addDebuff() {
    setDebuffs((current) =>
      current.length >= MAX_DEBUFFS ? current : [...current, ""],
    );
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (status === "scheduled" && !previewDate) {
      setError("Choose a valid date and time for the next session.");
      return;
    }

    if (previewDebuffs.length > MAX_DEBUFFS) {
      setError(`You can publish at most ${MAX_DEBUFFS} debuffs.`);
      return;
    }

    if (previewDebuffs.some((debuff) => debuff.length > MAX_DEBUFF_LENGTH)) {
      setError(`Each debuff may contain at most ${MAX_DEBUFF_LENGTH} characters.`);
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { error: saveError } = await supabase.rpc("set_campaign_session", {
        p_campaign_slug: campaignSlug,
        p_status: status,
        p_next_session_at: status === "scheduled" ? previewDate : null,
        p_message:
          status === "tba"
            ? message.trim() || DEFAULT_SESSION_MESSAGE
            : message.trim() || null,
        p_debuffs: previewDebuffs,
      });

      if (saveError) {
        throw saveError;
      }

      setDebuffs(previewDebuffs);
      setSuccess("Session settings and Azzimo's price are now published.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not publish the session settings.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleStatusChange(event: ChangeEvent<HTMLInputElement>) {
    setStatus(event.target.value as CampaignSessionStatus);
    setSuccess(null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <form
        onSubmit={saveSettings}
        className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5 sm:p-6"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-500/80">
            Publication
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-100">
            Next Session Controls
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Publish the next session date, a short note and any price owed to
            Azzimo. Campaign members see the result on the Command Center.
          </p>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-slate-200">Status</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border p-4 transition ${
                status === "scheduled"
                  ? "border-yellow-500/50 bg-yellow-500/10"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="session-status"
                value="scheduled"
                checked={status === "scheduled"}
                onChange={handleStatusChange}
                className="sr-only"
              />
              <span className="font-semibold text-slate-100">Scheduled</span>
              <span className="mt-1 block text-xs text-slate-400">
                Publish a concrete date and time.
              </span>
            </label>

            <label
              className={`cursor-pointer rounded-xl border p-4 transition ${
                status === "tba"
                  ? "border-yellow-500/50 bg-yellow-500/10"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="session-status"
                value="tba"
                checked={status === "tba"}
                onChange={handleStatusChange}
                className="sr-only"
              />
              <span className="font-semibold text-slate-100">To be announced</span>
              <span className="mt-1 block text-xs text-slate-400">
                Keep the date open while the group decides.
              </span>
            </label>
          </div>
        </fieldset>

        {status === "scheduled" ? (
          <label className="mt-5 block">
            <span className="text-sm font-semibold text-slate-200">
              Date and time
            </span>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(event) => setDateTime(event.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-yellow-500/50"
            />
          </label>
        ) : null}

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-slate-200">
            Additional note
          </span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={280}
            rows={4}
            placeholder="Optional note for the party..."
            className="mt-2 w-full resize-y rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500/50"
          />
          <span className="mt-1 block text-right text-xs text-slate-600">
            {message.length}/280
          </span>
        </label>

        <section className="mt-6 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-purple-950/45 via-slate-950/80 to-rose-950/30 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-fuchsia-300/80">
                Special deployment debt
              </p>
              <h3 className="mt-1 text-lg font-bold text-rose-100">
                ☠ Azzimo's Price
              </h3>
              <p className="mt-1 max-w-xl text-sm text-slate-400">
                Add the debuffs agreed with the players for the next session.
                Every published entry will be visible to campaign members.
              </p>
            </div>
            <span className="rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200">
              {previewDebuffs.length}/{MAX_DEBUFFS} active
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {debuffs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-fuchsia-500/20 bg-black/10 px-4 py-5 text-center text-sm text-slate-500">
                No debt is currently assigned to the next session.
              </div>
            ) : (
              debuffs.map((debuff, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-fuchsia-500/15 bg-black/15 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300/70">
                      Debuff {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDebuff(index)}
                      className="text-xs font-semibold text-rose-300/80 transition hover:text-rose-200"
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={debuff}
                    onChange={(event) => updateDebuff(index, event.target.value)}
                    maxLength={MAX_DEBUFF_LENGTH}
                    rows={2}
                    placeholder="Describe the agreed debuff..."
                    className="mt-2 w-full resize-y rounded-lg border border-fuchsia-500/15 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-fuchsia-500/40"
                  />
                  <span className="mt-1 block text-right text-[0.7rem] text-slate-600">
                    {debuff.length}/{MAX_DEBUFF_LENGTH}
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={addDebuff}
            disabled={debuffs.length >= MAX_DEBUFFS}
            className="mt-4 inline-flex items-center rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2 text-sm font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add Debuff
          </button>
        </section>

        {!initialSettings.databaseReady ? (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            The campaign session schema is not ready. Apply
            <code className="mx-1 rounded bg-black/25 px-1.5 py-0.5">
              supabase/campaign-session-controls-v2.sql
            </code>
            before publishing these settings.
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSaving || !initialSettings.databaseReady}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-yellow-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Publishing..." : "Publish Session Settings"}
        </button>
      </form>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Live Preview
          </p>

          <div className="mt-4 rounded-2xl border border-yellow-500/15 bg-slate-900/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-500/80">
              Next Session
            </p>

            {status === "scheduled" && previewDate ? (
              <>
                <p className="mt-2 text-xl font-bold text-slate-100">
                  {formatPublishedDate(previewDate)}
                </p>
                {message.trim() ? (
                  <p className="mt-2 text-sm text-slate-400">{message.trim()}</p>
                ) : null}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    ["--", "Days"],
                    ["--", "Hours"],
                    ["--", "Min"],
                    ["--", "Sec"],
                  ].map(([value, label]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-center"
                    >
                      <p className="font-bold text-slate-100">{value}</p>
                      <p className="text-[0.65rem] uppercase tracking-wide text-slate-600">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-xl font-bold text-slate-100">
                  Date to be announced
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {message.trim() || DEFAULT_SESSION_MESSAGE}
                </p>
              </>
            )}
          </div>

          <div className="mt-4">
            <AzzimosPricePanel debuffs={previewDebuffs} compact />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Current Publication
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="mt-1 font-semibold text-slate-200">
                {initialSettings.status === "scheduled" ? "Scheduled" : "TBA"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Date</dt>
              <dd className="mt-1 text-slate-300">
                {formatPublishedDate(initialSettings.nextSessionAt)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Message</dt>
              <dd className="mt-1 text-slate-300">
                {initialSettings.message || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Updated</dt>
              <dd className="mt-1 text-slate-300">
                {initialSettings.updatedAt
                  ? formatPublishedDate(initialSettings.updatedAt)
                  : "Unknown"}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <AzzimosPricePanel debuffs={initialSettings.debuffs} compact />
          </div>
        </section>
      </aside>
    </div>
  );
}
