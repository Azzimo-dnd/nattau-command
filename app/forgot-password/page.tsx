"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "recovery_link_invalid") {
      setErrorMessage(
        "That recovery link is invalid or has expired. Request a new one below.",
      );
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/confirm?next=/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setIsSubmitting(false);

    if (error) {
      if (error.status === 429) {
        setErrorMessage(
          "Too many recovery requests. Wait a little and try again.",
        );
      } else {
        setErrorMessage(
          "We could not send the recovery email right now. Please try again.",
        );
      }
      return;
    }

    // Keep this deliberately generic so the UI never confirms whether an
    // email address exists in Supabase Auth.
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Nattau Command
          </p>

          <h1 className="mt-3 text-3xl font-bold">Reset password</h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Enter the email address used for your player account. If the account
            exists, we will send you a secure password recovery link.
          </p>
        </div>

        {sent ? (
          <div className="mt-8">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm leading-6 text-emerald-200">
              If an account exists for <strong>{email.trim()}</strong>, a recovery
              email has been sent. Check your inbox and spam folder.
            </div>

            <button
              type="button"
              onClick={() => {
                setSent(false);
                setErrorMessage(null);
              }}
              className="mt-4 w-full rounded-xl border border-slate-700 px-4 py-3 font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
            >
              Send another recovery email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-300"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500"
                placeholder="player@example.com"
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Send recovery email"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-400 transition hover:text-yellow-400"
          >
            ← Back to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
