"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCampaignAdminPresentation } from "@/lib/campaigns/campaignAdminPresentation";
import type {
  CampaignInvitePreview,
  RedeemedCampaignInvite,
} from "./adminTypes";

type InviteExperienceProps = {
  code: string;
  preview: CampaignInvitePreview;
  initiallyAuthenticated: boolean;
  initialDisplayName: string | null;
  autoRedeem: boolean;
};

type AuthMode = "signup" | "signin";

function formatExpiry(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function readRedeemedInvite(data: unknown): RedeemedCampaignInvite | null {
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const campaignId = String(row.campaign_id ?? "");
  const campaignSlug = String(row.campaign_slug ?? "");
  const companionName = String(row.companion_name ?? "");
  if (!campaignId || !campaignSlug || !companionName) return null;
  return {
    campaignId,
    campaignSlug,
    companionName,
    membershipCreated: row.membership_created === true,
  };
}

export function InviteExperience({
  code,
  preview,
  initiallyAuthenticated,
  initialDisplayName,
  autoRedeem,
}: InviteExperienceProps) {
  const router = useRouter();
  const theme = getCampaignAdminPresentation(
    preview.campaignSlug ?? "",
    preview.themeKey ?? "",
    preview.companionName ?? preview.campaignName ?? "Campaign Companion"
  );
  const [mode, setMode] = useState<AuthMode>("signup");
  const [authenticated, setAuthenticated] = useState(initiallyAuthenticated);
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [isPending, startTransition] = useTransition();
  const autoRedeemStarted = useRef(false);

  async function redeemInvite() {
    setNotice(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("redeem_campaign_invite", {
      p_code: code,
    } as never);

    if (error) {
      setNotice(error.message);
      return;
    }

    const redeemed = readRedeemedInvite(data);
    if (!redeemed) {
      setNotice(
        "The invitation was accepted, but the campaign destination could not be read."
      );
      router.push("/campaigns");
      router.refresh();
      return;
    }

    router.replace(`/campaigns/${redeemed.campaignSlug}`);
    router.refresh();
  }

  useEffect(() => {
    if (!authenticated || !autoRedeem || autoRedeemStarted.current) return;
    autoRedeemStarted.current = true;
    startTransition(() => redeemInvite());
  }, [authenticated, autoRedeem]);

  async function signInAndJoin() {
    setNotice(null);
    if (!email.trim() || !password) {
      setNotice("Enter your email address and password.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setNotice(error.message);
      return;
    }

    setAuthenticated(true);
    await redeemInvite();
  }

  async function signUpAndJoin() {
    setNotice(null);
    if (displayName.trim().length < 2) {
      setNotice("Choose a display name with at least two characters.");
      return;
    }
    if (!email.trim()) {
      setNotice("Enter your email address.");
      return;
    }
    if (password.length < 8) {
      setNotice("Use a password with at least eight characters.");
      return;
    }
    if (password !== confirmPassword) {
      setNotice("The passwords do not match.");
      return;
    }

    const supabase = createClient();
    const confirmationUrl = new URL("/auth/confirm", window.location.origin);
    confirmationUrl.searchParams.set(
      "next",
      `/campaign-invite/${encodeURIComponent(code)}?redeem=1`
    );

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: confirmationUrl.toString(),
        data: {
          display_name: displayName.trim(),
          full_name: displayName.trim(),
        },
      },
    });

    if (error) {
      setNotice(error.message);
      return;
    }

    if (data.session) {
      setAuthenticated(true);
      await redeemInvite();
      return;
    }

    setCheckEmail(true);
    setNotice(
      "Your account was created. Confirm the email address using the message from Supabase. You will return here and join this campaign automatically."
    );
  }

  if (!preview.valid) {
    return (
      <InviteFrame preview={preview}>
        <div className="rounded-[24px] border border-red-900/45 bg-red-950/20 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-400">
            Invitation unavailable
          </p>
          <h2 className={`mt-3 font-serif text-2xl font-black ${theme.mainText}`}>
            This invitation cannot be used
          </h2>
          <p className={`mt-3 text-sm leading-6 ${theme.mutedText}`}>
            {preview.reason ||
              "The code is invalid, expired, revoked or has reached its usage limit."}
          </p>
        </div>
      </InviteFrame>
    );
  }

  return (
    <InviteFrame preview={preview}>
      {authenticated ? (
        <div className={`rounded-[24px] border p-5 text-center sm:p-6 ${theme.panelSoft}`}>
          <p className={`text-xs uppercase tracking-[0.22em] ${theme.accentText}`}>
            Signed in{initialDisplayName ? ` as ${initialDisplayName}` : ""}
          </p>
          <h2 className={`mt-3 font-serif text-2xl font-black ${theme.mainText}`}>
            Accept the invitation
          </h2>
          <p className={`mt-3 text-sm leading-6 ${theme.mutedText}`}>
            This adds only {preview.companionName || preview.campaignName} to your existing account. It does not change your password or access to other campaigns.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => redeemInvite())}
            className={`mt-6 min-h-12 w-full rounded-xl border px-5 text-sm font-black disabled:opacity-50 ${theme.primaryButton}`}
          >
            {isPending
              ? theme.joiningLabel
              : `Join ${preview.companionName || preview.campaignName}`}
          </button>
        </div>
      ) : (
        <div>
          <div className={`flex rounded-2xl border bg-black/20 p-1 ${theme.border}`}>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setNotice(null);
              }}
              className={`min-h-11 flex-1 rounded-xl text-sm font-bold ${
                mode === "signup" ? theme.tabActive : theme.tabInactive
              }`}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setNotice(null);
              }}
              className={`min-h-11 flex-1 rounded-xl text-sm font-bold ${
                mode === "signin" ? theme.tabActive : theme.tabInactive
              }`}
            >
              I have an account
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className={`text-sm font-semibold ${theme.mainText}`}>
                  Display name
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="nickname"
                  maxLength={80}
                  placeholder="How the party will know you"
                  className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none ${theme.input}`}
                />
              </label>
            )}

            <label className="block">
              <span className={`text-sm font-semibold ${theme.mainText}`}>
                Email address
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none ${theme.input}`}
              />
            </label>

            <label className="block">
              <span className={`text-sm font-semibold ${theme.mainText}`}>
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                placeholder={
                  mode === "signup" ? "At least 8 characters" : "Your password"
                }
                className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none ${theme.input}`}
              />
            </label>

            {mode === "signup" && (
              <label className="block">
                <span className={`text-sm font-semibold ${theme.mainText}`}>
                  Repeat password
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none ${theme.input}`}
                />
              </label>
            )}

            <button
              type="button"
              disabled={isPending || checkEmail}
              onClick={() =>
                startTransition(() =>
                  mode === "signup" ? signUpAndJoin() : signInAndJoin()
                )
              }
              className={`min-h-12 w-full rounded-xl border px-5 text-sm font-black disabled:opacity-50 ${theme.primaryButton}`}
            >
              {isPending
                ? mode === "signup"
                  ? "Creating account…"
                  : "Signing in…"
                : mode === "signup"
                  ? "Create account and join"
                  : "Sign in and join"}
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p className={`mt-5 rounded-xl border px-4 py-3 text-sm ${theme.notice}`}>
          {notice}
        </p>
      )}
    </InviteFrame>
  );
}

function InviteFrame({
  preview,
  children,
}: {
  preview: CampaignInvitePreview;
  children: ReactNode;
}) {
  const companionName =
    preview.companionName || preview.campaignName || "Campaign Companion";
  const theme = getCampaignAdminPresentation(
    preview.campaignSlug ?? "",
    preview.themeKey ?? "",
    companionName
  );
  const expiry = formatExpiry(preview.expiresAt);
  const background =
    theme.key === "barovia"
      ? "bg-[#08070a]"
      : theme.key === "nattau"
        ? "bg-slate-950"
        : "bg-[#080b14]";
  const glow =
    theme.key === "barovia"
      ? "bg-[radial-gradient(circle_at_50%_10%,rgba(103,28,49,0.3),transparent_36%),linear-gradient(180deg,transparent,rgba(0,0,0,0.55))]"
      : theme.key === "nattau"
        ? "bg-[radial-gradient(circle_at_50%_10%,rgba(234,179,8,0.13),transparent_36%),linear-gradient(180deg,transparent,rgba(0,0,0,0.48))]"
        : "bg-[radial-gradient(circle_at_50%_10%,rgba(99,102,241,0.16),transparent_36%),linear-gradient(180deg,transparent,rgba(0,0,0,0.5))]";

  return (
    <main
      className={`relative min-h-screen overflow-hidden px-4 py-10 ${background} ${theme.pageText}`}
    >
      <div className={`pointer-events-none absolute inset-0 ${glow}`} />
      <div className="relative mx-auto w-full max-w-2xl">
        <header className="text-center">
          <p
            className={`text-xs font-bold uppercase tracking-[0.32em] ${theme.accentText}`}
          >
            Campaign Companion Invitation
          </p>
          <p className={`mt-4 text-xs uppercase tracking-[0.22em] ${theme.faintText}`}>
            {preview.valid
              ? preview.subtitle || "Private campaign"
              : "Private campaign invitation"}
          </p>
          <h1
            className={`mt-3 font-serif text-4xl font-black sm:text-5xl ${theme.mainText}`}
          >
            {preview.valid ? companionName : "Campaign Invitation"}
          </h1>
          <p className={`mx-auto mt-4 max-w-xl text-sm leading-6 ${theme.mutedText}`}>
            {preview.valid
              ? "You have been invited to a private campaign. No other campaign will be shown unless your account already has access to it."
              : "Open a valid invitation link supplied by the Game Master."}
          </p>
          {(preview.label || expiry) && (
            <div className={`mt-5 flex flex-wrap justify-center gap-2 text-xs ${theme.mutedText}`}>
              {preview.label && (
                <span className={`rounded-full border bg-black/20 px-3 py-1.5 ${theme.border}`}>
                  {preview.label}
                </span>
              )}
              {expiry && (
                <span className={`rounded-full border bg-black/20 px-3 py-1.5 ${theme.border}`}>
                  Valid until {expiry}
                </span>
              )}
            </div>
          )}
        </header>

        <section className={`mt-8 rounded-[30px] p-5 sm:p-8 ${theme.panel}`}>
          {children}
        </section>
      </div>
    </main>
  );
}
