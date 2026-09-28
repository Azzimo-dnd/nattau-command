"use client";

import { useMemo, useState } from "react";
import { getCampaignAdminPresentation } from "@/lib/campaigns/campaignAdminPresentation";
import type { CampaignAdminMember } from "./adminTypes";

function generatePassword() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function responseErrorMessage(body: unknown, fallback: string) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }

  return fallback;
}

export function CampaignPasswordReset({
  campaignId,
  campaignSlug,
  companionName,
  themeKey,
  members,
}: {
  campaignId: string;
  campaignSlug: string;
  companionName: string;
  themeKey: string;
  members: CampaignAdminMember[];
}) {
  const theme = getCampaignAdminPresentation(
    campaignSlug,
    themeKey,
    companionName
  );
  const activeMembers = useMemo(
    () => members.filter((member) => member.isActive),
    [members]
  );
  const [userId, setUserId] = useState(activeMembers[0]?.userId ?? "");
  const [password, setPassword] = useState("");
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const selected = activeMembers.find((member) => member.userId === userId);

  async function resetPassword() {
    setMessage(null);

    if (!userId) {
      setMessage({ kind: "error", text: "Choose a campaign member." });
      return;
    }
    if (password.length < 10) {
      setMessage({
        kind: "error",
        text: "Password must contain at least 10 characters.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/campaigns/${encodeURIComponent(campaignSlug)}/gm/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignSlug,
            campaignId,
            userId,
            password,
            requirePasswordChange,
          }),
        }
      );

      const body = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setMessage({
          kind: "error",
          text: responseErrorMessage(body, "Password could not be reset."),
        });
        return;
      }

      setMessage({
        kind: "success",
        text: requirePasswordChange
          ? `Password updated for ${selected?.displayName ?? "campaign member"}. They will be forced to choose a new password after signing in.`
          : `Password updated for ${selected?.displayName ?? "campaign member"}.`,
      });
      setPassword("");
    } catch {
      setMessage({
        kind: "error",
        text: "The password service could not be reached. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={`${theme.panel} p-5 sm:p-6`}>
      <p
        className={`text-xs font-bold uppercase tracking-[0.28em] ${theme.accentText}`}
      >
        Auth administration
      </p>
      <h2 className={`mt-3 font-serif text-2xl font-black ${theme.mainText}`}>
        Reset member password
      </h2>
      <p className={`mt-2 max-w-2xl text-sm leading-6 ${theme.mutedText}`}>
        Set a new password directly for an existing campaign member. This uses
        Supabase Admin Auth on the server; the password is never written to the
        campaign database.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className={`text-sm font-semibold ${theme.mainText}`}>
            Campaign member
          </span>
          <select
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value);
              setMessage(null);
            }}
            className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none ${theme.input}`}
          >
            {activeMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
                {member.email ? ` · ${member.email}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={`text-sm font-semibold ${theme.mainText}`}>
            New password
          </span>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={10}
              autoComplete="off"
              placeholder="At least 10 characters"
              className={`min-w-0 flex-1 rounded-xl border px-4 py-3 font-mono outline-none ${theme.input}`}
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs font-bold ${theme.secondaryButton}`}
            >
              Generate
            </button>
          </div>
        </label>
      </div>

      <label
        className={`mt-4 flex items-start justify-between gap-4 rounded-2xl border p-4 ${theme.panelSoft}`}
      >
        <span>
          <span className={`block text-sm font-semibold ${theme.mainText}`}>
            Require password change on next login
          </span>
          <span className={`mt-1 block text-xs leading-5 ${theme.mutedText}`}>
            Turn this on for a temporary password. Leave it off for test accounts
            such as Pippo when you want the new password to remain valid.
          </span>
        </span>
        <input
          type="checkbox"
          checked={requirePasswordChange}
          onChange={(event) => setRequirePasswordChange(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-current"
        />
      </label>

      {message && (
        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            message.kind === "success"
              ? "border-emerald-800/50 bg-emerald-950/25 text-emerald-200"
              : "border-red-800/50 bg-red-950/25 text-red-300"
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        type="button"
        disabled={isSaving || !userId}
        onClick={() => void resetPassword()}
        className={`mt-5 min-h-12 rounded-xl border px-5 text-sm font-black disabled:opacity-50 ${theme.primaryButton}`}
      >
        {isSaving ? "Updating password…" : "Set new password"}
      </button>
    </section>
  );
}
