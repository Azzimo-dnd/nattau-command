"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 10;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`,
      );
      return;
    }

    if (password !== confirmation) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsSubmitting(false);
      router.replace("/forgot-password?error=recovery_link_invalid");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setIsSubmitting(false);
      setErrorMessage(updateError.message);
      return;
    }

    // A password recovery should also terminate old refresh-token sessions.
    // Supabase access-token JWTs may live until their normal expiry, but no
    // revoked session can refresh afterwards.
    await supabase.auth.signOut({ scope: "global" });

    router.replace("/login?reset=success");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Campaign Companion
          </p>

          <h1 className="mt-3 text-3xl font-bold">Choose a new password</h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Set a new password for your player account. For security, resetting it
            will sign the account out on every device.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-300"
            >
              New password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              autoFocus
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500"
              placeholder="At least 10 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirmation"
              className="text-sm font-medium text-slate-300"
            >
              Confirm new password
            </label>

            <input
              id="confirmation"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500"
              placeholder="Repeat the new password"
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
            {isSubmitting ? "Updating password..." : "Set new password"}
          </button>
        </form>
      </section>
    </main>
  );
}
